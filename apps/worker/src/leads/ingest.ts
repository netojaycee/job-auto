import { eq } from "drizzle-orm";
import { getDb, fundingArticles } from "@job-auto/db";
import { FUNDING_FEEDS, fetchFundingFeed } from "./adapters";

/** Pulls raw articles from funding-news feeds — no AI involved, just fetch + dedup on URL. */
export async function ingestFundingArticles(): Promise<{ found: number; new: number }> {
  const db = getDb();
  let found = 0;
  let newCount = 0;

  for (const feed of FUNDING_FEEDS) {
    try {
      const items = await fetchFundingFeed(feed);
      found += items.length;
      for (const item of items) {
        if (!item.link) continue;
        const [existing] = await db
          .select()
          .from(fundingArticles)
          .where(eq(fundingArticles.url, item.link))
          .limit(1);
        if (existing) continue;

        await db.insert(fundingArticles).values({
          sourceFeed: feed.key,
          title: item.title,
          url: item.link,
          description: item.description,
          publishedAt: item.pubDate,
        });
        newCount += 1;
      }
      console.log(`[leads] ${feed.key}: found ${items.length}`);
    } catch (err) {
      console.error(`[leads] ${feed.key} failed:`, err);
    }
  }

  return { found, new: newCount };
}
