import mssql from "mssql";
import { config } from "./config.js";
let appPoolPromise = null;
export async function getAppDbPool() {
    if (!appPoolPromise) {
        appPoolPromise = new mssql.ConnectionPool({
            server: config.appDb.host,
            port: config.appDb.port,
            database: config.appDb.database,
            user: config.appDb.user,
            password: config.appDb.password,
            pool: {
                max: 20,
                min: 0,
                idleTimeoutMillis: 30000
            },
            options: {
                encrypt: config.appDb.encrypt,
                trustServerCertificate: !config.appDb.encrypt
            }
        }).connect();
    }
    return appPoolPromise;
}
