import { desc, eq } from "drizzle-orm";
import { getDb, jobSources, crawlRuns } from "@job-auto/db";

const CONSECUTIVE_FAILURE_THRESHOLD = 3;
const RUNS_TO_CHECK = 5;

export interface UnhealthySource {
  sourceId: string;
  name: string;
  consecutiveFailures: number;
  lastError: string | null;
}

/**
 * Flags sources whose last several crawl_runs were all failures — usually
 * means the source's form/API shape drifted (adapter needs updating), not a
 * one-off network blip. Call this after ingestAllSources, or on its own
 * from a scheduled check.
 */
export async function checkAdapterHealth(): Promise<UnhealthySource[]> {
  const db = getDb();
  const sources = await db.select().from(jobSources).where(eq(jobSources.enabled, true));

  const unhealthy: UnhealthySource[] = [];
  for (const source of sources) {
    const recentRuns = await db
      .select()
      .from(crawlRuns)
      .where(eq(crawlRuns.sourceId, source.id))
      .orderBy(desc(crawlRuns.startedAt))
      .limit(RUNS_TO_CHECK);

    if (recentRuns.length < CONSECUTIVE_FAILURE_THRESHOLD) continue;

    let consecutiveFailures = 0;
    for (const run of recentRuns) {
      if (run.status === "failed") consecutiveFailures += 1;
      else break;
    }

    if (consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
      unhealthy.push({
        sourceId: source.id,
        name: source.name,
        consecutiveFailures,
        lastError: recentRuns[0]?.errorSummary ?? null,
      });
    }
  }

  return unhealthy;
}
