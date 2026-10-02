import { eq } from "drizzle-orm";
import { getDb, applications, jobPostings, profiles, users } from "@job-auto/db";
import { uploadObject } from "@job-auto/storage";
import type { ParsedCv } from "@job-auto/types";
import { generateCoverLetter, needsCoverLetter, tailorCvVerified } from "./tailor";
import { renderCvPdf } from "./pdf";

export interface PreparedApplication {
  applicationId: string;
  tailoredCvRef: string;
  coverLetterRef: string | null;
}

/**
 * Generates the tailored CV (+ cover letter if the posting asks for one) for
 * a shortlisted application and uploads them to R2. Moves the application to
 * status "tailoring" — the last stop before the actual send/submit step,
 * which is a separate, deliberately gated action (see apply/send.ts).
 */
export async function prepareApplication(applicationId: string): Promise<PreparedApplication> {
  const db = getDb();

  const [application] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, applicationId))
    .limit(1);
  if (!application) throw new Error(`Unknown application: ${applicationId}`);

  const [posting] = await db
    .select()
    .from(jobPostings)
    .where(eq(jobPostings.id, application.jobPostingId))
    .limit(1);
  if (!posting) throw new Error(`Unknown job posting: ${application.jobPostingId}`);

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

  const job = { title: posting.title, company: posting.company, description: posting.description };

  const tailoredCvText = await tailorCvVerified(profile.parsedCvJson as ParsedCv, job, userRow.email);
  const tailoredCvPdf = await renderCvPdf(tailoredCvText, `${posting.title} — CV`);
  const tailoredCvRef = `applications/${application.userId}/${application.id}/cv.pdf`;
  await uploadObject(tailoredCvRef, tailoredCvPdf, "application/pdf");

  let coverLetterRef: string | null = null;
  if (needsCoverLetter(job)) {
    const coverLetterText = await generateCoverLetter(profile.canonicalProfileText, job);
    coverLetterRef = `applications/${application.userId}/${application.id}/cover-letter.txt`;
    await uploadObject(coverLetterRef, Buffer.from(coverLetterText, "utf-8"), "text/plain");
  }

  await db
    .update(applications)
    .set({ status: "tailoring", tailoredCvRef, coverLetterRef })
    .where(eq(applications.id, application.id));

  return { applicationId: application.id, tailoredCvRef, coverLetterRef };
}
