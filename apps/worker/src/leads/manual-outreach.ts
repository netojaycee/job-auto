import { eq } from "drizzle-orm";
import { getDb, users, profiles, jobPreferences, speculativeApplications } from "@job-auto/db";
import { hasSufficientBalance, debitCredits } from "@job-auto/wallet";
import type { ParsedCv } from "@job-auto/types";
import { prepareSpeculativeApplication } from "./prepare";
import { sendSpeculativeOutreach } from "./send";
import { resolveCompanyEmail } from "./email-guess";

const CREDIT_COST_PER_OUTREACH = 1;

export interface ManualOutreachInput {
  companyName: string;
  /** Omit to have job-auto guess one — see email-guess.ts's resolveCompanyEmail. */
  contactEmail?: string;
  /** Optional company website — improves the domain guess when contactEmail is omitted. */
  website?: string;
  context: string;
  /** Overrides the inferred role (job_preferences.roles[0] / CV's suggestedRoles[0]) for this one pitch. */
  targetRole?: string;
}

export interface ManualOutreachResult {
  speculativeApplicationId: string;
  sent: boolean;
}

/**
 * User-submitted cold email — same tailoring/audit/gating as the
 * funding-lead pipeline (orchestrate.ts), but the target company/contact/
 * context come directly from the user instead of a scored lead. Reuses
 * prepareSpeculativeApplication/sendSpeculativeOutreach, which both handle a
 * null leadId by reading companyName/contactEmail/context off this row.
 */
export async function submitManualOutreach(
  userId: string,
  input: ManualOutreachInput,
): Promise<ManualOutreachResult> {
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error(`Unknown user: ${userId}`);

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile?.canonicalProfileText || !profile.parsedCvJson) {
    throw new Error(`User ${userId} has no parsed CV/profile yet`);
  }

  const [prefs] = await db.select().from(jobPreferences).where(eq(jobPreferences.userId, userId)).limit(1);
  const parsedCv = profile.parsedCvJson as ParsedCv;
  const targetRole = input.targetRole || prefs?.roles?.[0] || parsedCv.suggestedRoles?.[0] || "a relevant role";

  const canAfford = await hasSufficientBalance(user, CREDIT_COST_PER_OUTREACH);
  if (!canAfford) throw new Error(`Insufficient credits for user ${userId}`);

  let contactEmail = input.contactEmail;
  let contactEmailGuessed = false;
  let emailCandidates: string[] | undefined;
  if (!contactEmail) {
    const resolved = await resolveCompanyEmail(input.companyName, input.website, input.context);
    contactEmail = resolved.contactEmail;
    emailCandidates = resolved.candidates;
    contactEmailGuessed = true;
  }

  const [application] = await db
    .insert(speculativeApplications)
    .values({
      userId,
      leadId: null,
      companyName: input.companyName,
      contactEmail,
      contactEmailGuessed,
      emailCandidates,
      context: input.context,
      status: "shortlisted",
    })
    .returning();

  try {
    await prepareSpeculativeApplication(application.id, targetRole);
    await debitCredits(user, CREDIT_COST_PER_OUTREACH, `manual-outreach:${application.id}`);
    const sent = await sendSpeculativeOutreach(application.id);
    return { speculativeApplicationId: application.id, sent };
  } catch (err) {
    await db.update(speculativeApplications).set({ status: "failed" }).where(eq(speculativeApplications.id, application.id));
    throw err;
  }
}
