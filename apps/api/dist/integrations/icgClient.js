import mssql from "mssql";
import { config } from "../config.js";
let poolPromise = null;
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
export async function findCustomerInIcg(documentNumber) {
    const pool = await getPool();
    const request = pool.request();
    request.input("document", mssql.VarChar(50), documentNumber);
    const result = await request.query(config.icg.customerQuery);
    if (!result.recordset.length) {
        return null;
    }
    const row = result.recordset[0];
    return {
        code: String(row.CODCLIENTE ?? ""),
        fullName: row.NOMBRECLIENTE ?? null,
        documentNumber: row.NIF20 ?? null,
        phone: row.TELEFONO1 ?? null,
        email: row.E_MAIL ?? null,
        addressLine: row.DIRECCION1 ?? null
    };
}
