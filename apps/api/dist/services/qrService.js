import QRCode from "qrcode";
import mssql from "mssql";
import { getAppDbPool } from "../db.js";
import { config } from "../config.js";
import { createPublicToken } from "../utils/tokens.js";
export async function createQrSession() {
    const pool = await getAppDbPool();
    const token = createPublicToken();
    const expiresAt = new Date(Date.now() + config.qrSessionTtlMinutes * 60 * 1000);
    const result = await pool.request()
        .input("sessionToken", mssql.NVarChar(120), token)
        .input("expiresAt", mssql.DateTime2, expiresAt)
        .query(`
      INSERT INTO dbo.qr_sessions (session_token, expires_at)
      OUTPUT inserted.id, inserted.session_token, inserted.expires_at, inserted.status
      VALUES (@sessionToken, @expiresAt)
    `);
    const row = result.recordset[0];
    const url = `${config.publicBaseUrl}/cliente.html?token=${row.session_token}`;
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
export async function getSessionStatus(token) {
    const pool = await getAppDbPool();
    const result = await pool.request()
        .input("sessionToken", mssql.NVarChar(120), token)
        .query(`
      SELECT qs.id, qs.status, qs.expires_at, cu.form_status, cu.consent_status, cu.full_name, cu.document_number, cu.email
      FROM dbo.qr_sessions qs
      LEFT JOIN dbo.customer_updates cu ON cu.qr_session_id = qs.id
      WHERE qs.session_token = @sessionToken
    `);
    return result.recordset[0] ?? null;
}
