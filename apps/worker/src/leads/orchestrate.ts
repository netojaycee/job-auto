import { eq, notInArray } from "drizzle-orm";
import { getDb, users, profiles, jobPreferences, fundingLeads, speculativeApplications } from "@job-auto/db";
import { hasSufficientBalance, debitCredits } from "@job-auto/wallet";
import type { ParsedCv } from "@job-auto/types";
import { scoreLeadAgainstProfile } from "./score";
import { prepareSpeculativeApplication } from "./prepare";
import { sendSpeculativeOutreach } from "./send";

const SCORE_THRESHOLD = 60;
/** Cap LLM calls per run, same reasoning as scoring/shortlist.ts. */
const MAX_LEADS_TO_SCORE = 20;
/**
 * Deliberately smaller and separate from preferences.maxApplicationsPerDay —
 * this is a distinct, higher-risk channel (guessed recipient, no posted
 * opening, see ARCHITECTURE.md §13) and shouldn't inherit the job-board
 * volume cap by accident.
 */
const MAX_OUTREACH_PER_RUN = 5;
const CREDIT_COST_PER_OUTREACH = 1;

export interface OutreachResult {
  speculativeApplicationId: string;
  companyName: string;
  score: number;
  reasoning: string;
  sent: boolean;
}

function inferTargetRole(prefs: { roles: string[] | null } | undefined, parsedCv: ParsedCv): string {
  return prefs?.roles?.[0] ?? parsedCv.suggestedRoles?.[0] ?? "a relevant role";
}

/**
 * Scores unprocessed funding_leads against a user's profile, tailors a CV +
 * speculative cover letter for the best-fitting ones, and — only if both
 * safety gates in leads/send.ts are set — sends them. Mirrors
 * agent/run-agent-for-user.ts's shape (shortlist -> prepare -> gated send)
 * but is its own function, not folded into runAgentForUser: this is a
 * distinct pipeline with its own risk profile and is invoked separately.
 */
export async function runOutreachForUser(userId: string): Promise<OutreachResult[]> {
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error(`Unknown user: ${userId}`);

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile?.canonicalProfileText || !profile.parsedCvJson) {
    throw new Error(`User ${userId} has no parsed CV/profile yet`);
  }

  const [prefs] = await db.select().from(jobPreferences).where(eq(jobPreferences.userId, userId)).limit(1);
  const targetRole = inferTargetRole(prefs, profile.parsedCvJson as ParsedCv);

  const alreadyTargeted = await db
    .select({ leadId: speculativeApplications.leadId })
    .from(speculativeApplications)
    .where(eq(speculativeApplications.userId, userId));
  const excludedLeadIds = alreadyTargeted.map((a) => a.leadId).filter((id): id is string => id !== null);

  const candidateLeads = excludedLeadIds.length
    ? await db.select().from(fundingLeads).where(notInArray(fundingLeads.id, excludedLeadIds))
    : await db.select().from(fundingLeads);

  const scored: { leadId: string; companyName: string; score: number; reasoning: string }[] = [];
  for (const lead of candidateLeads.slice(0, MAX_LEADS_TO_SCORE)) {
    try {
      const { score, reasoning } = await scoreLeadAgainstProfile(profile.canonicalProfileText, {
        companyName: lead.companyName,
        summary: lead.summary,
        fundingAmount: lead.fundingAmount,
      });
      if (score >= SCORE_THRESHOLD) {
        scored.push({ leadId: lead.id, companyName: lead.companyName, score, reasoning });
      }
    } catch (err) {
      console.error(`[leads] failed to score lead ${lead.id}:`, err);
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const topLeads = scored.slice(0, MAX_OUTREACH_PER_RUN);

  const results: OutreachResult[] = [];
  for (const item of topLeads) {
    const canAfford = await hasSufficientBalance(user, CREDIT_COST_PER_OUTREACH);
    if (!canAfford) {
      console.warn(`[leads] ${user.email}: insufficient credits, stopping outreach run`);
      break;
    }

    const [inserted] = await db
      .insert(speculativeApplications)
      .values({
        userId,
        leadId: item.leadId,
        status: "shortlisted",
        matchScore: item.score,
        matchReasoning: item.reasoning,
      })
      .onConflictDoNothing()
      .returning();
    if (!inserted) continue; // already targeted this lead (race/rerun)

    try {
      await prepareSpeculativeApplication(inserted.id, targetRole);
      await debitCredits(user, CREDIT_COST_PER_OUTREACH, `outreach:${inserted.id}`);
      const sent = await sendSpeculativeOutreach(inserted.id);
      results.push({
        speculativeApplicationId: inserted.id,
        companyName: item.companyName,
        score: item.score,
        reasoning: item.reasoning,
        sent,
      });
    } catch (err) {
      console.error(`[leads] failed to prepare/send outreach ${inserted.id}:`, err);
      await db
        .update(speculativeApplications)
        .set({ status: "failed" })
        .where(eq(speculativeApplications.id, inserted.id));
    }
  }

  return results;
}
