import nodemailer from "nodemailer";
import { config } from "../config.js";
const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
        user: config.smtp.user,
        pass: config.smtp.password
    }
});
export async function sendConsentEmail(to, fullName, confirmUrl) {
    return transporter.sendMail({
        from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
        to,
        subject: "Confirma tu aceptacion de terminos y proteccion de datos",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="color:#0b7a36;">Mega Tienda del Sur</h2>
        <p>Estimado cliente ${fullName},</p>
        <p>Al pulsar en el siguiente enlace usted esta aceptando todos nuestros terminos y condiciones expuestos en la pantalla anterior y nuestra politica de proteccion de datos personales.</p>
        <p>Para mas informacion dirigirse a <a href="https://megatiendadelsur.com.ec">megatiendadelsur.com.ec</a>.</p>
        <p><a href="${confirmUrl}" style="background:#d71920;color:#ffffff;padding:14px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Confirmar aceptacion</a></p>
      </div>
    `
    });
}
