import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  publicBaseUrl: required("PUBLIC_BASE_URL"),
  qrSessionTtlMinutes: Number(process.env.QR_SESSION_TTL_MINUTES ?? 15),
  consentTokenTtlHours: Number(process.env.CONSENT_TOKEN_TTL_HOURS ?? 24),
  adminDefaultUser: required("ADMIN_DEFAULT_USER"),
  adminDefaultPassword: required("ADMIN_DEFAULT_PASSWORD"),
  appDb: {
    host: required("APP_SQLSERVER_HOST"),
    port: Number(process.env.APP_SQLSERVER_PORT ?? 1433),
    database: required("APP_SQLSERVER_DATABASE"),
    user: required("APP_SQLSERVER_USER"),
    password: required("APP_SQLSERVER_PASSWORD"),
    encrypt: process.env.APP_SQLSERVER_ENCRYPT === "true"
  },
  icg: {
    host: required("ICG_SQLSERVER_HOST"),
    port: Number(process.env.ICG_SQLSERVER_PORT ?? 1433),
    database: required("ICG_SQLSERVER_DATABASE"),
    user: required("ICG_SQLSERVER_USER"),
    password: required("ICG_SQLSERVER_PASSWORD"),
    encrypt: process.env.ICG_SQLSERVER_ENCRYPT === "true",
    customerQuery: required("ICG_CUSTOMER_QUERY")
  },
  sap: {
    baseUrl: required("SAP_SL_BASE_URL").replace(/\/+$/, ""),
    companyDb: required("SAP_SL_COMPANY_DB"),
    username: required("SAP_SL_USERNAME"),
    password: required("SAP_SL_PASSWORD"),
    rejectUnauthorized: process.env.SAP_SL_REJECT_UNAUTHORIZED !== "false"
  },
  smtp: {
    host: required("SMTP_HOST"),
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user: required("SMTP_USER"),
    password: required("SMTP_PASSWORD"),
    fromName: required("SMTP_FROM_NAME"),
    fromEmail: required("SMTP_FROM_EMAIL")
  }
};
