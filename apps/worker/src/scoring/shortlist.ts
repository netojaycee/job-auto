import { eq, notInArray } from "drizzle-orm";
import { getDb, applications, jobPostings, jobPreferences, profiles } from "@job-auto/db";
import { structuredFilter } from "./filter";
import { scoreJobAgainstProfile } from "./score-job";

const SCORE_THRESHOLD = 60;
/** Cap LLM calls per run — real production sizing lives in ARCHITECTURE.md §9/§10. */
const MAX_CANDIDATES_TO_SCORE = 30;

export interface ShortlistResult {
  jobPostingId: string;
  title: string;
  company: string;
  score: number;
  reasoning: string;
}

export async function shortlistJobsForUser(userId: string): Promise<ShortlistResult[]> {
  const db = getDb();

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile?.canonicalProfileText) {
    throw new Error(`User ${userId} has no canonical profile yet — upload a CV first.`);
  }

  let [prefs] = await db.select().from(jobPreferences).where(eq(jobPreferences.userId, userId)).limit(1);
  prefs ??= {
    id: "",
    userId,
    roles: [],
    locations: [],
    remotePref: "any",
    salaryFloor: null,
    industries: [],
    excludedCompanies: [],
    excludedKeywords: [],
    dailyRunTime: "08:00",
    maxApplicationsPerDay: 10,
  };

  const existingApplications = await db
    .select({ jobPostingId: applications.jobPostingId })
    .from(applications)
    .where(eq(applications.userId, userId));
  const alreadyAppliedIds = existingApplications.map((a) => a.jobPostingId);

  const allPostings = alreadyAppliedIds.length
    ? await db.select().from(jobPostings).where(notInArray(jobPostings.id, alreadyAppliedIds))
    : await db.select().from(jobPostings);

  const filtered = structuredFilter(allPostings, prefs).slice(0, MAX_CANDIDATES_TO_SCORE);

  const scored: ShortlistResult[] = [];
  for (const posting of filtered) {
    try {
      const { score, reasoning } = await scoreJobAgainstProfile(profile.canonicalProfileText, {
        title: posting.title,
        company: posting.company,
        description: posting.description,
      });
      if (score >= SCORE_THRESHOLD) {
        scored.push({ jobPostingId: posting.id, title: posting.title, company: posting.company, score, reasoning });
      }
    } catch (err) {
      console.error(`[shortlist] failed to score posting ${posting.id}:`, err);
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const topN = scored.slice(0, prefs.maxApplicationsPerDay);

  for (const result of topN) {
    await db
      .insert(applications)
      .values({
        userId,
        jobPostingId: result.jobPostingId,
        status: "shortlisted",
        matchScore: result.score,
        matchReasoning: result.reasoning,
      })
      .onConflictDoNothing();
  }

  return topN;
}
