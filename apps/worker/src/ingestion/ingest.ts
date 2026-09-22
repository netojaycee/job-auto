import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, jobSources, jobPostings, crawlRuns } from "@job-auto/db";
import { ADAPTERS } from "./adapters/index.js";
import type { NormalizedPosting } from "./types.js";

function contentHash(posting: NormalizedPosting): string {
  return createHash("sha256")
    .update(`${posting.title}\n${posting.company}\n${posting.description}`)
    .digest("hex");
}

export async function ingestSource(sourceId: string): Promise<{ found: number; new: number }> {
  const db = getDb();
  const [source] = await db.select().from(jobSources).where(eq(jobSources.id, sourceId)).limit(1);
  if (!source) throw new Error(`Unknown job source: ${sourceId}`);

  const adapter = ADAPTERS[source.adapterKey];
  if (!adapter) throw new Error(`No adapter registered for key: ${source.adapterKey}`);

  const [crawlRun] = await db.insert(crawlRuns).values({ sourceId }).returning();

  let postings: NormalizedPosting[] = [];
  try {
    postings = await adapter({ id: source.id, baseUrl: source.baseUrl });
  } catch (err) {
    await db
      .update(crawlRuns)
      .set({ finishedAt: new Date(), postingsFound: 0, postingsNew: 0 })
      .where(eq(crawlRuns.id, crawlRun.id));
    throw err;
  }

  let newCount = 0;
  for (const posting of postings) {
    const hash = contentHash(posting);
    const [existing] = await db
      .select()
      .from(jobPostings)
      .where(and(eq(jobPostings.sourceId, source.id), eq(jobPostings.externalId, posting.externalId)))
      .limit(1);

    if (!existing) {
      newCount += 1;
      await db.insert(jobPostings).values({
        sourceId: source.id,
        externalId: posting.externalId,
        url: posting.url,
        title: posting.title,
        company: posting.company,
        location: posting.location,
        description: posting.description,
        contentHash: hash,
        postedAt: posting.postedAt,
      });
    } else if (existing.contentHash !== hash) {
      // Re-listed/edited posting — update content but keep firstSeenAt so
      // dedup against `applications` still refers to the same row.
      await db
        .update(jobPostings)
        .set({
          url: posting.url,
          title: posting.title,
          location: posting.location,
          description: posting.description,
          contentHash: hash,
          postedAt: posting.postedAt,
        })
        .where(eq(jobPostings.id, existing.id));
    }
  }

  await db
    .update(crawlRuns)
    .set({ finishedAt: new Date(), postingsFound: postings.length, postingsNew: newCount })
    .where(eq(crawlRuns.id, crawlRun.id));

  return { found: postings.length, new: newCount };
}

export async function ingestAllSources(): Promise<void> {
  const db = getDb();
  const sources = await db.select().from(jobSources).where(eq(jobSources.enabled, true));

  for (const source of sources) {
    try {
      const result = await ingestSource(source.id);
      console.log(`[ingest] ${source.name}: found ${result.found}, new ${result.new}`);
    } catch (err) {
      console.error(`[ingest] ${source.name} failed:`, err);
    }
  }
}
