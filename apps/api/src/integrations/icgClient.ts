import mssql from "mssql";
import { config } from "../config.js";

export type IcgCustomer = {
  code: string;
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
        trustServerCertificate: true,
        encrypt: false
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

  return {
    code: String(result.recordset[0].CodigoCliente ?? "")
  };
}
