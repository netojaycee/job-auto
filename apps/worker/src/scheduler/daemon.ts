import * as dotenv from "dotenv";
dotenv.config();
import { runAgentForUser } from "../agent/run-agent-for-user";
import { createAgentRunWorker } from "@job-auto/queue";
import { syncSchedules } from "./sync-schedules";

const RESYNC_INTERVAL_MS = 60 * 60 * 1000; // re-read preferences hourly

async function main() {
  const count = await syncSchedules();
  console.log(`[scheduler] registered ${count} user schedule(s)`);

  const worker = createAgentRunWorker(async (userId) => {
    console.log(`[scheduler] running agent for user ${userId}`);
    await runAgentForUser(userId);
  });

  worker.on("failed", (job, err: Error) => {
    console.error(`[scheduler] job ${job?.id} failed:`, err);
  });

  setInterval(() => {
    syncSchedules()
      .then((n) => console.log(`[scheduler] resynced ${n} schedule(s)`))
      .catch((err) => console.error("[scheduler] resync failed:", err));
  }, RESYNC_INTERVAL_MS);

  console.log("[scheduler] daemon running");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
