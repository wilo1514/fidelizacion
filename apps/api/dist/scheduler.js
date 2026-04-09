import cron from "node-cron";
import { runSapSyncCycle } from "./services/sapSyncService.js";
export function startScheduler() {
    cron.schedule("0 22 * * *", async () => {
        await runSapSyncCycle();
    }, { timezone: "America/Guayaquil" });
    cron.schedule("0 5 * * *", async () => {
        await runSapSyncCycle();
    }, { timezone: "America/Guayaquil" });
}
