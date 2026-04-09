import Fastify from "fastify";
import cors from "@fastify/cors";
import formBody from "@fastify/formbody";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { seedDefaultAdmin, verifyAdminCredentials } from "./repositories/adminRepository.js";
import { createQrSession, getSessionStatus } from "./services/qrService.js";
import { confirmConsent, registerCustomerUpdate } from "./services/consentService.js";
import { startScheduler } from "./scheduler.js";
import { runSapSyncCycle } from "./services/sapSyncService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "../../web");

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(formBody);
await app.register(fastifyStatic, {
  root: webRoot,
  prefix: "/"
});

async function authenticateAdmin(request: any, reply: any) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Basic ")) {
    return reply.code(401).header("WWW-Authenticate", 'Basic realm="Admin"').send({ message: "Autenticacion requerida" });
  }

  const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");
  const username = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : "";
  const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";

  const ok = await verifyAdminCredentials(username, password);
  if (!ok) {
    return reply.code(401).header("WWW-Authenticate", 'Basic realm="Admin"').send({ message: "Credenciales invalidas" });
  }
}

app.get("/health", async () => ({ ok: true }));

app.post("/api/admin/qr-sessions", {
  preHandler: authenticateAdmin
}, async () => createQrSession());

app.get("/api/admin/qr-sessions/:token", {
  preHandler: authenticateAdmin
}, async (request, reply) => {
  const params = request.params as { token: string };
  const session = await getSessionStatus(params.token);

  if (!session) {
    return reply.code(404).send({ message: "Sesion no encontrada" });
  }

  return session;
});

app.post("/api/admin/sap-sync/run", {
  preHandler: authenticateAdmin
}, async (_request, reply) => {
  try {
    await runSapSyncCycle();
    return { ok: true, message: "Sincronizacion SAP ejecutada correctamente" };
  } catch (error) {
    return reply.code(500).send({
      ok: false,
      message: error instanceof Error ? error.message : "No fue posible ejecutar la sincronizacion SAP"
    });
  }
});

app.post("/api/public/register", async (request, reply) => {
  const body = request.body as {
    token: string;
    fullName: string;
    documentNumber: string;
    mobilePhone: string;
    email: string;
    addressLine: string;
    acceptedPolicyVersion: string;
    acceptedTermsVersion: string;
  };

  try {
    const result = await registerCustomerUpdate({
      ...body,
      ipAddress: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null
    });

    if (!result.ok) {
      return reply.code(400).send(result);
    }

    return result;
  } catch (error) {
    return reply.code(400).send({
      message: error instanceof Error ? error.message : "No fue posible procesar la solicitud"
    });
  }
});

app.get("/api/public/consent/confirm", async (request, reply) => {
  const query = request.query as { token?: string };
  if (!query.token) {
    return reply.code(400).type("text/html").send("<h1>Token no valido</h1>");
  }

  try {
    await confirmConsent(query.token, request.ip ?? null, request.headers["user-agent"] ?? null);
    return reply.type("text/html").send(`
      <html lang="es">
        <head><meta charset="utf-8"><title>Confirmacion exitosa</title></head>
        <body style="font-family: Arial, sans-serif; padding: 32px;">
          <h1>Gracias por confirmar</h1>
          <p>Tu aceptacion fue registrada correctamente. Ya puedes volver con el administrador para validar tu premio.</p>
        </body>
      </html>
    `);
  } catch (error) {
    return reply.code(400).type("text/html").send(`
      <html lang="es">
        <head><meta charset="utf-8"><title>Enlace no valido</title></head>
        <body style="font-family: Arial, sans-serif; padding: 32px;">
          <h1>No fue posible registrar tu aceptacion</h1>
          <p>${error instanceof Error ? error.message : "Token no valido"}</p>
        </body>
      </html>
    `);
  }
});

await seedDefaultAdmin();
startScheduler();
await app.listen({ port: config.port, host: "0.0.0.0" });
