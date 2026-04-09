import mssql from "mssql";
import { config } from "../config.js";

export type IcgCustomer = {
  code: string;
  fullName: string | null;
  documentNumber: string | null;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
};

let poolPromise: Promise<mssql.ConnectionPool> | null = null;

async function getPool() {
  if (!poolPromise) {
    poolPromise = new mssql.ConnectionPool({
      server: config.icg.host,
      port: config.icg.port,
      database: config.icg.database,
      user: config.icg.user,
      password: config.icg.password,
      options: {
        trustServerCertificate: !config.icg.encrypt,
        encrypt: config.icg.encrypt
      }
    }).connect();
  }

  return poolPromise;
}

export async function findCustomerInIcg(documentNumber: string): Promise<IcgCustomer | null> {
  const pool = await getPool();
  const request = pool.request();
  request.input("document", mssql.VarChar(50), documentNumber);
  const result = await request.query(config.icg.customerQuery);

  if (!result.recordset.length) {
    return null;
  }

  const row = result.recordset[0] as Record<string, string | null>;
  return {
    code: String(row.CODCLIENTE ?? ""),
    fullName: row.NOMBRECLIENTE ?? null,
    documentNumber: row.NIF20 ?? null,
    phone: row.TELEFONO1 ?? null,
    email: row.E_MAIL ?? null,
    addressLine: row.DIRECCION1 ?? null
  };
}
