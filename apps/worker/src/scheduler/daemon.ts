import * as dotenv from "dotenv";
import * as nodePath from "path";
dotenv.config({ path: nodePath.resolve(__dirname, "../../../../.env") });
import { runAgentForUser } from "../agent/run-agent-for-user";
import { submitManualApplication } from "../apply/manual-intake";
import { submitManualOutreach } from "../leads/manual-outreach";
import { createAgentRunWorker, createManualApplyWorker, createManualOutreachWorker } from "@job-auto/queue";
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

  const manualApplyWorker = createManualApplyWorker(async (data) => {
    console.log(`[scheduler] manual apply for user ${data.userId}`);
    await submitManualApplication(data.userId, data.rawText, data.applicationEmail);
  });
  manualApplyWorker.on("failed", (job, err: Error) => {
    console.error(`[scheduler] manual apply job ${job?.id} failed:`, err);
  });

  const manualOutreachWorker = createManualOutreachWorker(async (data) => {
    console.log(`[scheduler] manual outreach for user ${data.userId}`);
    await submitManualOutreach(data.userId, data);
  });
  manualOutreachWorker.on("failed", (job, err: Error) => {
    console.error(`[scheduler] manual outreach job ${job?.id} failed:`, err);
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
