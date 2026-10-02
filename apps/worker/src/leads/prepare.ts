import { eq } from "drizzle-orm";
import { getDb, speculativeApplications, fundingLeads, profiles, users } from "@job-auto/db";
import { uploadObject } from "@job-auto/storage";
import type { ParsedCv } from "@job-auto/types";
import {
  generateSpeculativeCoverLetter,
  speculativeJobContext,
  tailorCvVerified,
} from "../apply/tailor";
import { renderCvPdf } from "../apply/pdf";

export interface PreparedSpeculativeApplication {
  speculativeApplicationId: string;
  tailoredCvRef: string;
  coverLetterRef: string;
}

/**
 * Generates a tailored CV + cold-outreach cover letter for a shortlisted
 * speculative lead and uploads them to R2. Reuses apply/tailor.ts's
 * fabrication-audited generation — same risk, same guard, adapted for a
 * "no specific JD" context (see ARCHITECTURE.md §13). Unlike job-board
 * applications, a cover letter is always generated here: it IS the outreach
 * itself, not an optional extra for postings that ask for one.
 */
export async function prepareSpeculativeApplication(
  speculativeApplicationId: string,
  targetRole: string,
): Promise<PreparedSpeculativeApplication> {
  const db = getDb();

  const [application] = await db
    .select()
    .from(speculativeApplications)
    .where(eq(speculativeApplications.id, speculativeApplicationId))
    .limit(1);
  if (!application) throw new Error(`Unknown speculative application: ${speculativeApplicationId}`);

  let leadForOutreach: { companyName: string; summary: string | null; fundingAmount: string | null };
  if (application.leadId) {
    const [lead] = await db.select().from(fundingLeads).where(eq(fundingLeads.id, application.leadId)).limit(1);
    if (!lead) throw new Error(`Unknown funding lead: ${application.leadId}`);
    leadForOutreach = { companyName: lead.companyName, summary: lead.summary, fundingAmount: lead.fundingAmount };
  } else {
    // User-submitted cold email — no funding lead, company/context came
    // directly from the form (see leads/manual-outreach.ts).
    if (!application.companyName) throw new Error(`Speculative application ${speculativeApplicationId} has neither a leadId nor a companyName`);
    leadForOutreach = { companyName: application.companyName, summary: application.context, fundingAmount: null };
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, application.userId))
    .limit(1);
  if (!profile?.parsedCvJson || !profile.canonicalProfileText) {
    throw new Error(`User ${application.userId} has no parsed CV/profile to tailor from`);
  }

  const [userRow] = await db.select().from(users).where(eq(users.id, application.userId)).limit(1);
  if (!userRow) throw new Error(`Unknown user: ${application.userId}`);

  const jobContext = speculativeJobContext(leadForOutreach, targetRole);

  const tailoredCvText = await tailorCvVerified(profile.parsedCvJson as ParsedCv, jobContext, userRow.email);
  const tailoredCvPdf = await renderCvPdf(tailoredCvText, `${leadForOutreach.companyName} — CV`);
  const tailoredCvRef = `speculative/${application.userId}/${application.id}/cv.pdf`;
  await uploadObject(tailoredCvRef, tailoredCvPdf, "application/pdf");

  const coverLetterText = await generateSpeculativeCoverLetter(
    profile.canonicalProfileText,
    leadForOutreach,
    targetRole,
  );
  const coverLetterRef = `speculative/${application.userId}/${application.id}/cover-letter.txt`;
  await uploadObject(coverLetterRef, Buffer.from(coverLetterText, "utf-8"), "text/plain");

  await db
    .update(speculativeApplications)
    .set({ status: "tailoring", tailoredCvRef, coverLetterRef })
    .where(eq(speculativeApplications.id, application.id));

  return { speculativeApplicationId: application.id, tailoredCvRef, coverLetterRef };
}
