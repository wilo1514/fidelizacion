import mssql from "mssql";
import { getAppDbPool } from "../db.js";
import { updateBusinessPartnerByDocument } from "../integrations/sapServiceLayer.js";

export async function runSapSyncCycle() {
  const pool = await getAppDbPool();
  const result = await pool.request().query(`
    SELECT TOP 200
      sq.id AS queue_id,
      cu.id AS customer_update_id,
      cu.document_number,
      cu.full_name,
      cu.mobile_phone,
      cu.email,
      cu.address_line
    FROM dbo.sap_sync_queue sq
    INNER JOIN dbo.customer_updates cu ON cu.id = sq.customer_update_id
    WHERE sq.sync_status IN ('PENDING', 'RETRY_PENDING')
      AND (sq.next_attempt_at IS NULL OR sq.next_attempt_at <= SYSUTCDATETIME())
    ORDER BY sq.created_at
  `);

  for (const row of result.recordset) {
    try {
      const sapResult = await updateBusinessPartnerByDocument(row.document_number, {
        mobilePhone: row.mobile_phone,
        email: row.email,
        addressLine: row.address_line
      });

      if (!sapResult.found) {
        await pool.request()
          .input("queueId", mssql.UniqueIdentifier, row.queue_id)
          .query(`
            UPDATE dbo.sap_sync_queue
            SET sync_status = 'RETRY_PENDING',
                attempts = attempts + 1,
                last_attempt_at = SYSUTCDATETIME(),
                next_attempt_at = DATEADD(HOUR, 7, SYSUTCDATETIME()),
                last_error = 'Cliente no encontrado en SAP',
                updated_at = SYSUTCDATETIME()
            WHERE id = @queueId
          `);
        continue;
      }

      await pool.request()
        .input("queueId", mssql.UniqueIdentifier, row.queue_id)
        .query(`
          UPDATE dbo.sap_sync_queue
          SET sync_status = 'SYNCED',
              attempts = attempts + 1,
              last_attempt_at = SYSUTCDATETIME(),
              next_attempt_at = NULL,
              last_error = NULL,
              updated_at = SYSUTCDATETIME()
          WHERE id = @queueId
        `);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown SAP sync error";
      await pool.request()
        .input("queueId", mssql.UniqueIdentifier, row.queue_id)
        .input("lastError", mssql.NVarChar(mssql.MAX), message)
        .query(`
          UPDATE dbo.sap_sync_queue
          SET sync_status = 'RETRY_PENDING',
              attempts = attempts + 1,
              last_attempt_at = SYSUTCDATETIME(),
              next_attempt_at = DATEADD(HOUR, 7, SYSUTCDATETIME()),
              last_error = @lastError,
              updated_at = SYSUTCDATETIME()
          WHERE id = @queueId
        `);
    }
  }
}
