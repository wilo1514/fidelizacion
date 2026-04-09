import argon2 from "argon2";
import mssql from "mssql";
import { getAppDbPool } from "../db.js";
import { config } from "../config.js";
export async function seedDefaultAdmin() {
    const pool = await getAppDbPool();
    const existing = await pool.request()
        .input("username", mssql.NVarChar(100), config.adminDefaultUser)
        .query("SELECT id FROM dbo.admin_users WHERE username = @username");
    if (existing.recordset.length > 0) {
        return;
    }
    const passwordHash = await argon2.hash(config.adminDefaultPassword);
    await pool.request()
        .input("username", mssql.NVarChar(100), config.adminDefaultUser)
        .input("passwordHash", mssql.NVarChar(mssql.MAX), passwordHash)
        .query("INSERT INTO dbo.admin_users (username, password_hash) VALUES (@username, @passwordHash)");
}
export async function verifyAdminCredentials(username, password) {
    const pool = await getAppDbPool();
    const result = await pool.request()
        .input("username", mssql.NVarChar(100), username)
        .query("SELECT TOP 1 password_hash, is_active FROM dbo.admin_users WHERE username = @username");
    const row = result.recordset[0];
    if (!row || !row.is_active) {
        return false;
    }
    return argon2.verify(String(row.password_hash), password);
}
