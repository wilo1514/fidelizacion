import QRCode from "qrcode";
import mssql from "mssql";
import { getAppDbPool } from "../db.js";
import { config } from "../config.js";
import { findCustomerInIcg } from "../integrations/icgClient.js";
import { createPublicToken } from "../utils/tokens.js";

export async function createQrSession(documentNumber: string) {
  const pool = await getAppDbPool();
  const icgCustomer = await findCustomerInIcg(documentNumber);

  if (!icgCustomer?.code) {
    throw new Error("Verifique los datos ingresados");
  }

  const token = createPublicToken();
  const expiresAt = new Date(Date.now() + config.qrSessionTtlMinutes * 60 * 1000);
  const result = await pool.request()
    .input("sessionToken", mssql.NVarChar(120), token)
    .input("documentNumber", mssql.NVarChar(50), documentNumber)
    .input("expiresAt", mssql.DateTime2, expiresAt)
    .query(`
      INSERT INTO dbo.qr_sessions (session_token, document_number, expires_at)
      OUTPUT inserted.id, inserted.session_token, inserted.document_number, inserted.expires_at, inserted.status
      VALUES (@sessionToken, @documentNumber, @expiresAt)
    `);

  const row = result.recordset[0];
  const url = `${config.publicBaseUrl}/cliente.html?token=${row.session_token}&document=${encodeURIComponent(row.document_number)}`;
  const qrDataUrl = await QRCode.toDataURL(url);

  return {
    id: row.id,
    token: row.session_token,
    url,
    expiresAt: row.expires_at,
    status: row.status,
    qrDataUrl
  };
}

export async function getSessionStatus(token: string) {
  const pool = await getAppDbPool();
  const result = await pool.request()
    .input("sessionToken", mssql.NVarChar(120), token)
    .query(`
      SELECT qs.id, qs.status, qs.document_number, qs.expires_at, cu.form_status, cu.consent_status, cu.full_name, cu.document_number AS customer_document_number, cu.email
      FROM dbo.qr_sessions qs
      LEFT JOIN dbo.customer_updates cu ON cu.qr_session_id = qs.id
      WHERE qs.session_token = @sessionToken
    `);

  return result.recordset[0] ?? null;
}

export async function getPublicSessionData(token: string) {
  const pool = await getAppDbPool();
  const result = await pool.request()
    .input("sessionToken", mssql.NVarChar(120), token)
    .query(`
      SELECT TOP 1 id, document_number, expires_at, status
      FROM dbo.qr_sessions
      WHERE session_token = @sessionToken
    `);

  const session = result.recordset[0];
  if (!session) {
    throw new Error("QR session not found");
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    throw new Error("QR session expired");
  }

  const icgCustomer = await findCustomerInIcg(session.document_number);
  if (!icgCustomer?.code) {
    throw new Error("Verifique los datos ingresados");
  }

  return {
    token,
    documentNumber: session.document_number,
    fullName: icgCustomer.fullName ?? "",
    mobilePhone: icgCustomer.phone ?? "",
    email: icgCustomer.email ?? "",
    addressLine: icgCustomer.addressLine ?? ""
  };
}
