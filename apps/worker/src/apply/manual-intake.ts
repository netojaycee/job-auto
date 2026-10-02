import { randomUUID, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, jobSources, jobPostings, applications, profiles, users } from "@job-auto/db";
import { getAiProvider } from "@job-auto/ai";
import { uploadObject, downloadObject } from "@job-auto/storage";
import { hasSufficientBalance, debitCredits } from "@job-auto/wallet";
import type { ParsedCv } from "@job-auto/types";
import { generateCoverLetter, tailorCvVerified } from "./tailor";
import { sendApplicationEmail } from "./gmail-send";
import { renderCvPdf } from "./pdf";

const CREDIT_COST_PER_APPLICATION = 1;

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

interface ParsedManualPosting {
  title: string;
  company: string;
  description: string;
  applicationEmail: string | null;
}

/**
 * Structures a raw pasted job listing — title/company/description, plus an
 * application email IF the listing explicitly gives one (never guessed; a
 * null here means portal-only, so the manual-apply flow won't attempt to
 * send). See ARCHITECTURE.md's manual-intake section.
 */
async function parseManualJobPosting(rawText: string): Promise<ParsedManualPosting> {
  const provider = getAiProvider();
  const result = await provider.complete({
    system:
      'Extract structured fields from a raw pasted job listing. Output ONLY JSON: {"title": string, "company": string, "description": string (the listing\'s content, cleaned up), "applicationEmail": string|null — an email address ONLY if the listing explicitly says to apply/send your CV to it; null if it points to an online application form/portal or gives no explicit email}.',
    prompt: rawText.slice(0, 6000),
    maxTokens: 1500,
    temperature: 0,
  });
  const parsed = JSON.parse(extractJson(result.text)) as ParsedManualPosting;
  return parsed;
}

async function getOrCreateManualSource(): Promise<string> {
  const db = getDb();
  const [existing] = await db.select().from(jobSources).where(eq(jobSources.adapterKey, "manual")).limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(jobSources)
    .values({
      name: "Manually pasted",
      type: "html",
      baseUrl: "manual",
      adapterKey: "manual",
      robotsNotes: "User-submitted listings, not crawled.",
    })
    .returning();
  return created.id;
}

export interface ManualApplyResult {
  applicationId: string;
  sent: boolean;
}

/**
 * Takes a raw pasted job listing, tailors a CV (+ always a cover letter,
 * since for the email channel it doubles as the message body), and — only
 * if the listing gave a real application email and AGENT_ALLOW_REAL_APPLY is
 * set — sends it for real via the user's Gmail. Portal-only listings (no
 * email) are tailored and left ready for the user to submit themselves; see
 * CLAUDE.md — there is no generic auto-submit-to-any-portal here, only the
 * hand-built Greenhouse/Lever adapters do that, and only for known sites.
 */
export async function submitManualApplication(
  userId: string,
  rawText: string,
  applicationEmailOverride: string | null,
): Promise<ManualApplyResult> {
  const db = getDb();

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile?.parsedCvJson || !profile.canonicalProfileText) {
    throw new Error(`User ${userId} has no parsed CV/profile to tailor from`);
  }

  const parsedPosting = await parseManualJobPosting(rawText);
  const applicationEmail = applicationEmailOverride || parsedPosting.applicationEmail || null;

  const sourceId = await getOrCreateManualSource();
  const contentHash = createHash("sha256").update(rawText).digest("hex");
  const [posting] = await db
    .insert(jobPostings)
    .values({
      sourceId,
      externalId: randomUUID(),
      url: "manual",
      title: parsedPosting.title,
      company: parsedPosting.company,
      description: parsedPosting.description,
      contentHash,
      applicationEmail,
    })
    .returning();

  const [application] = await db
    .insert(applications)
    .values({ userId, jobPostingId: posting.id, status: "shortlisted" })
    .returning();

  const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRow) throw new Error(`Unknown user: ${userId}`);

  const canAfford = await hasSufficientBalance(userRow, CREDIT_COST_PER_APPLICATION);
  if (!canAfford) {
    await db.update(applications).set({ status: "failed" }).where(eq(applications.id, application.id));
    throw new Error(`Insufficient credits for user ${userId}`);
  }

  const job = { title: parsedPosting.title, company: parsedPosting.company, description: parsedPosting.description };

  try {
    const tailoredCvText = await tailorCvVerified(profile.parsedCvJson as ParsedCv, job, userRow.email);
    const tailoredCvPdf = await renderCvPdf(tailoredCvText, `${parsedPosting.title} — CV`);
    const tailoredCvRef = `applications/${userId}/${application.id}/cv.pdf`;
    await uploadObject(tailoredCvRef, tailoredCvPdf, "application/pdf");

    // Always write a cover letter here (unlike the crawled-posting path) —
    // for the email channel it IS the message body, and it costs nothing
    // extra to have one ready for the portal case too.
    const coverLetterText = await generateCoverLetter(profile.canonicalProfileText, job);
    const coverLetterRef = `applications/${userId}/${application.id}/cover-letter.txt`;
    await uploadObject(coverLetterRef, Buffer.from(coverLetterText, "utf-8"), "text/plain");

    await debitCredits(userRow, CREDIT_COST_PER_APPLICATION, `manual-apply:${application.id}`);

    const method = applicationEmail ? "email" : "ats_portal";
    let sent = false;

    if (applicationEmail && process.env.AGENT_ALLOW_REAL_APPLY === "true") {
      const cvBuffer = await downloadObject(tailoredCvRef);
      await sendApplicationEmail(userId, {
        to: applicationEmail,
        subject: `Application for ${parsedPosting.title} at ${parsedPosting.company}`,
        bodyText: coverLetterText,
        attachments: [{ filename: "cv.pdf", content: cvBuffer, mimeType: "application/pdf" }],
      });
      sent = true;
    }

    await db
      .update(applications)
      .set({
        status: sent ? "applied" : "tailoring",
        method,
        tailoredCvRef,
        coverLetterRef,
        appliedAt: sent ? new Date() : null,
      })
      .where(eq(applications.id, application.id));

    return { applicationId: application.id, sent };
  } catch (err) {
    await db.update(applications).set({ status: "failed" }).where(eq(applications.id, application.id));
    throw err;
  }
}
