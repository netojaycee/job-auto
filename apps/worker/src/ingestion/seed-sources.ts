import { getDb, jobSources } from "@job-auto/db";
import { eq } from "drizzle-orm";

const SEED_SOURCES = [
  {
    name: "Greenhouse - GitLab",
    type: "api" as const,
    baseUrl: "gitlab",
    adapterKey: "greenhouse",
  },
  {
    name: "Lever - Palantir",
    type: "api" as const,
    baseUrl: "palantir",
    adapterKey: "lever",
  },
  {
    name: "RemoteOK",
    type: "feed" as const,
    baseUrl: "https://remoteok.com/api",
    adapterKey: "remoteok",
    robotsNotes: "Free API; ToS requires attribution linking back to remoteok.com",
  },
];

export async function seedJobSources(): Promise<void> {
  const db = getDb();
  for (const source of SEED_SOURCES) {
    const [existing] = await db
      .select()
      .from(jobSources)
      .where(eq(jobSources.name, source.name))
      .limit(1);
    if (!existing) {
      await db.insert(jobSources).values(source);
      console.log(`[seed] created source: ${source.name}`);
    }
  }
}
