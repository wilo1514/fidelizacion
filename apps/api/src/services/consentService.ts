import crypto from "node:crypto";
import mssql from "mssql";
import { getAppDbPool } from "../db.js";
import { config } from "../config.js";
import { findCustomerInIcg } from "../integrations/icgClient.js";
import { sendConsentEmail } from "../integrations/emailService.js";
import { createPublicToken, hashToken } from "../utils/tokens.js";

type RegisterPayload = {
  token: string;
  fullName: string;
  documentNumber: string;
  mobilePhone: string;
  email: string;
  acceptedPolicyVersion: string;
  acceptedTermsVersion: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export async function registerCustomerUpdate(payload: RegisterPayload) {
  const pool = await getAppDbPool();
  const sessionResult = await pool.request()
    .input("sessionToken", mssql.NVarChar(120), payload.token)
    .query("SELECT id, expires_at FROM dbo.qr_sessions WHERE session_token = @sessionToken");

  const session = sessionResult.recordset[0];
  if (!session) {
    throw new Error("QR session not found");
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    throw new Error("QR session expired");
  }

  const icgCustomer = await findCustomerInIcg(payload.documentNumber);
  if (!icgCustomer?.code) {
    return { ok: false, message: "Verifique los datos ingresados" };
  }

  const customerUpdateId = crypto.randomUUID();
  const publicToken = createPublicToken();
  const tokenHash = hashToken(publicToken);
  const expiresAt = new Date(Date.now() + config.consentTokenTtlHours * 60 * 60 * 1000);

  const transaction = new mssql.Transaction(pool);
  await transaction.begin();

  try {
    await new mssql.Request(transaction)
      .input("qrSessionId", mssql.UniqueIdentifier, session.id)
      .input("customerUpdateId", mssql.UniqueIdentifier, customerUpdateId)
      .input("icgCode", mssql.NVarChar(100), icgCustomer.code)
      .input("fullName", mssql.NVarChar(200), payload.fullName)
      .input("documentNumber", mssql.NVarChar(50), payload.documentNumber)
      .input("mobilePhone", mssql.NVarChar(30), payload.mobilePhone)
      .input("email", mssql.NVarChar(200), payload.email)
      .input("acceptedPolicyVersion", mssql.NVarChar(20), payload.acceptedPolicyVersion)
      .input("acceptedTermsVersion", mssql.NVarChar(20), payload.acceptedTermsVersion)
      .input("ipAddress", mssql.NVarChar(64), payload.ipAddress)
      .input("userAgent", mssql.NVarChar(mssql.MAX), payload.userAgent)
      .query(`
        MERGE dbo.customer_updates AS target
        USING (SELECT @qrSessionId AS qr_session_id) AS source
        ON target.qr_session_id = source.qr_session_id
        WHEN MATCHED THEN
          UPDATE SET
            icg_customer_code = @icgCode,
            full_name = @fullName,
            document_number = @documentNumber,
            mobile_phone = @mobilePhone,
            email = @email,
            accepted_policy_version = @acceptedPolicyVersion,
            accepted_terms_version = @acceptedTermsVersion,
            ip_address = @ipAddress,
            user_agent = @userAgent,
            form_status = 'PENDING_EMAIL_CONFIRMATION',
            consent_status = 'PENDING',
            updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (id, qr_session_id, icg_customer_code, full_name, document_number, mobile_phone, email, accepted_policy_version, accepted_terms_version, ip_address, user_agent)
          VALUES (@customerUpdateId, @qrSessionId, @icgCode, @fullName, @documentNumber, @mobilePhone, @email, @acceptedPolicyVersion, @acceptedTermsVersion, @ipAddress, @userAgent);
      `);

    const currentUpdate = await new mssql.Request(transaction)
      .input("qrSessionId", mssql.UniqueIdentifier, session.id)
      .query("SELECT id FROM dbo.customer_updates WHERE qr_session_id = @qrSessionId");

    const effectiveUpdateId = currentUpdate.recordset[0].id;

    await new mssql.Request(transaction)
      .input("customerUpdateId", mssql.UniqueIdentifier, effectiveUpdateId)
      .input("tokenHash", mssql.NVarChar(128), tokenHash)
      .input("expiresAt", mssql.DateTime2, expiresAt)
      .query(`
        INSERT INTO dbo.consent_email_tokens (customer_update_id, token_hash, expires_at)
        VALUES (@customerUpdateId, @tokenHash, @expiresAt)
      `);

    await new mssql.Request(transaction)
      .input("sessionId", mssql.UniqueIdentifier, session.id)
      .query(`
        UPDATE dbo.qr_sessions
        SET status = 'EMAIL_SENT', last_status_at = SYSUTCDATETIME()
        WHERE id = @sessionId
      `);

    await new mssql.Request(transaction)
      .input("customerUpdateId", mssql.UniqueIdentifier, effectiveUpdateId)
      .input("ipAddress", mssql.NVarChar(64), payload.ipAddress)
      .input("userAgent", mssql.NVarChar(mssql.MAX), payload.userAgent)
      .query(`
        UPDATE dbo.customer_updates
        SET email_confirmation_sent_at = SYSUTCDATETIME()
        WHERE id = @customerUpdateId;

        INSERT INTO dbo.consent_audit_log (customer_update_id, event_type, event_detail, ip_address, user_agent)
        VALUES (@customerUpdateId, 'EMAIL_REQUESTED', 'Consent email generated after ICG validation', @ipAddress, @userAgent);
      `);

    await transaction.commit();

    const confirmUrl = `${config.publicBaseUrl}/api/public/consent/confirm?token=${publicToken}`;
    const mailResult = await sendConsentEmail(payload.email, payload.fullName, confirmUrl);

    await pool.request()
      .input("customerUpdateId", mssql.UniqueIdentifier, effectiveUpdateId)
      .input("recipientEmail", mssql.NVarChar(200), payload.email)
      .input("providerMessageId", mssql.NVarChar(200), String(mailResult.messageId ?? ""))
      .query(`
        INSERT INTO dbo.outbound_email_log (customer_update_id, recipient_email, email_type, delivery_status, provider_message_id, sent_at)
        VALUES (@customerUpdateId, @recipientEmail, 'CONSENT_CONFIRMATION', 'SENT', @providerMessageId, SYSUTCDATETIME())
      `);

    return { ok: true, message: "Se envio un correo de confirmacion al cliente" };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function confirmConsent(publicToken: string, ipAddress: string | null, userAgent: string | null) {
  const pool = await getAppDbPool();
  const tokenHash = hashToken(publicToken);
  const tokenResult = await pool.request()
    .input("tokenHash", mssql.NVarChar(128), tokenHash)
    .query(`
      SELECT cet.id, cet.customer_update_id, cet.expires_at, cet.used_at
      FROM dbo.consent_email_tokens cet
      WHERE cet.token_hash = @tokenHash
    `);

  const token = tokenResult.recordset[0];
  if (!token) {
    throw new Error("Invalid token");
  }

  if (token.used_at) {
    throw new Error("Token already used");
  }

  if (new Date(token.expires_at).getTime() < Date.now()) {
    throw new Error("Token expired");
  }

  const transaction = new mssql.Transaction(pool);
  await transaction.begin();

  try {
    await new mssql.Request(transaction)
      .input("tokenId", mssql.UniqueIdentifier, token.id)
      .input("customerUpdateId", mssql.UniqueIdentifier, token.customer_update_id)
      .input("ipAddress", mssql.NVarChar(64), ipAddress)
      .input("userAgent", mssql.NVarChar(mssql.MAX), userAgent)
      .query(`
        UPDATE dbo.consent_email_tokens SET used_at = SYSUTCDATETIME() WHERE id = @tokenId;

        UPDATE dbo.customer_updates
        SET consent_status = 'ACCEPTED',
            form_status = 'CONFIRMED',
            email_confirmed_at = SYSUTCDATETIME(),
            ip_address = COALESCE(@ipAddress, ip_address),
            user_agent = COALESCE(@userAgent, user_agent),
            updated_at = SYSUTCDATETIME()
        WHERE id = @customerUpdateId;

        MERGE dbo.sap_sync_queue AS target
        USING (SELECT @customerUpdateId AS customer_update_id) AS source
        ON target.customer_update_id = source.customer_update_id
        WHEN MATCHED THEN
          UPDATE SET sync_status = 'PENDING', next_attempt_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (customer_update_id, sync_status, next_attempt_at)
          VALUES (@customerUpdateId, 'PENDING', SYSUTCDATETIME());

        UPDATE dbo.qr_sessions
        SET status = 'CONFIRMED', last_status_at = SYSUTCDATETIME()
        WHERE id = (SELECT qr_session_id FROM dbo.customer_updates WHERE id = @customerUpdateId);

        INSERT INTO dbo.consent_audit_log (customer_update_id, event_type, event_detail, ip_address, user_agent)
        VALUES (@customerUpdateId, 'CONSENT_ACCEPTED', 'Customer confirmed via email link', @ipAddress, @userAgent);
      `);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
