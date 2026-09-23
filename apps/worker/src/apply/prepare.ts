import { eq } from "drizzle-orm";
import { getDb, applications, jobPostings, profiles } from "@job-auto/db";
import { uploadObject } from "@job-auto/storage";
import type { ParsedCv } from "@job-auto/types";
import { generateCoverLetter, needsCoverLetter, tailorCv, verifyNoFabrication } from "./tailor";

async function tailorCvVerified(parsedCv: ParsedCv, job: Parameters<typeof tailorCv>[1]): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const text = await tailorCv(parsedCv, job);
    const check = await verifyNoFabrication(text, parsedCv);
    if (check.ok) return text;
    console.warn(
      `[prepare] tailored CV attempt ${attempt} contained fabricated claims, ${attempt < 3 ? "retrying" : "giving up"}:`,
      check.fabricatedClaims,
    );
  }
  throw new Error(
    "Tailored CV failed the fabrication check 3 times — refusing to send a CV with invented content.",
  );
}

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

  const job = { title: posting.title, company: posting.company, description: posting.description };

  const tailoredCvText = await tailorCvVerified(profile.parsedCvJson as ParsedCv, job);
  const tailoredCvRef = `applications/${application.userId}/${application.id}/cv.txt`;
  await uploadObject(tailoredCvRef, Buffer.from(tailoredCvText, "utf-8"), "text/plain");

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
