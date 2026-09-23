import { eq } from "drizzle-orm";
import { getDb, users, profiles, agentRuns, applications } from "@job-auto/db";
import { hasSufficientBalance, debitCredits } from "@job-auto/wallet";
import { shortlistJobsForUser } from "../scoring/shortlist";
import { prepareApplication } from "../apply/prepare";
import { generateProfileSuggestions } from "./suggestions";
import { sendDailyDigest } from "./digest";

/** Internal credit cost per application actually shortlisted+tailored this run. */
const CREDIT_COST_PER_APPLICATION = 1;

/**
 * SAFETY GATE — do not remove without a deliberate decision. Actually
 * sending an email or submitting a portal form has a real-world effect on a
 * third party (an employer). Everything through "tailoring" is side-effect
 * free (AI calls + our own DB/storage); this env var is the one thing that
 * turns the pipeline from "prepare applications for review" into "actually
 * contact employers." Default is unset (dry run) — see ARCHITECTURE.md §12.
 */
function realApplyAllowed(): boolean {
  return process.env.AGENT_ALLOW_REAL_APPLY === "true";
}

export async function runAgentForUser(userId: string): Promise<void> {
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error(`Unknown user: ${userId}`);

  const [run] = await db.insert(agentRuns).values({ userId, status: "running" }).returning();

  try {
    const shortlisted = await shortlistJobsForUser(userId);

    let tailored = 0;
    for (const item of shortlisted) {
      const canAfford = await hasSufficientBalance(user, CREDIT_COST_PER_APPLICATION);
      if (!canAfford) {
        console.warn(`[agent] ${user.email}: insufficient credits, stopping after ${tailored} tailored`);
        break;
      }

      const [applicationRow] = await db
        .select()
        .from(applications)
        .where(eq(applications.jobPostingId, item.jobPostingId))
        .limit(1);
      if (!applicationRow) continue;

      try {
        await prepareApplication(applicationRow.id);
        await debitCredits(user, CREDIT_COST_PER_APPLICATION, `tailor:${applicationRow.id}`);
        tailored += 1;

        if (realApplyAllowed()) {
          // Actual send/submit is intentionally not wired to a specific
          // channel here — see apply/gmail-send.ts and
          // apply/greenhouse-portal.ts, which are built but require a
          // per-posting decision about which channel applies and are not
          // invoked automatically. This keeps the "real apply" surface
          // small and deliberate rather than a blanket auto-send.
          console.log(`[agent] AGENT_ALLOW_REAL_APPLY is set but no channel dispatch is wired yet`);
        }
      } catch (err) {
        console.error(`[agent] failed to prepare application ${applicationRow.id}:`, err);
        await db
          .update(applications)
          .set({ status: "failed" })
          .where(eq(applications.id, applicationRow.id));
      }
    }

    const lowScored = shortlisted
      .filter((s) => s.score < 75)
      .map((s) => ({ title: s.title, company: s.company, score: s.score, reasoning: s.reasoning }));
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    const suggestions =
      profile?.canonicalProfileText && lowScored.length
        ? await generateProfileSuggestions(userId, profile.canonicalProfileText, lowScored)
        : [];

    await sendDailyDigest(user.email, shortlisted, suggestions);

    await db
      .update(agentRuns)
      .set({
        finishedAt: new Date(),
        status: "completed",
        jobsSeen: shortlisted.length,
        jobsShortlisted: shortlisted.length,
        jobsApplied: tailored,
      })
      .where(eq(agentRuns.id, run.id));
  } catch (err) {
    await db
      .update(agentRuns)
      .set({ finishedAt: new Date(), status: "failed", errorSummary: String(err) })
      .where(eq(agentRuns.id, run.id));
    throw err;
  }
}
