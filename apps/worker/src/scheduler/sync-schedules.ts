import { getDb, jobPreferences } from "@job-auto/db";
import { getAgentRunQueue } from "@job-auto/queue";

/**
 * Registers one BullMQ repeatable job per user, keyed so re-running this is
 * idempotent (old repeatable configs for the same user are replaced, not
 * duplicated). dailyRunTime is stored as HH:MM and treated as UTC — there's
 * no per-user timezone field yet, so "08:00" means 08:00 UTC for everyone.
 * That's a known simplification worth revisiting before this scales past a
 * single-timezone user base.
 */
export async function syncSchedules(): Promise<number> {
  const db = getDb();
  const allPrefs = await db.select().from(jobPreferences);
  const queue = await getAgentRunQueue();

  const existingRepeatables = await queue.getRepeatableJobs();
  for (const job of existingRepeatables) {
    await queue.removeRepeatableByKey(job.key);
  }

  for (const prefs of allPrefs) {
    const [hour, minute] = prefs.dailyRunTime.split(":").map(Number);
    await queue.add(
      "run-agent",
      { userId: prefs.userId },
      {
        repeat: { pattern: `${minute} ${hour} * * *` },
        jobId: `agent-run-${prefs.userId}`,
      },
    );
  }

  return allPrefs.length;
}
