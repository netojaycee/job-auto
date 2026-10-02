import { eq } from "drizzle-orm";
import { getDb, speculativeApplications, fundingLeads } from "@job-auto/db";
import { downloadObject } from "@job-auto/storage";
import { sendApplicationEmail } from "../apply/gmail-send";

/**
 * SAFETY GATE — deliberately stricter than AGENT_ALLOW_REAL_APPLY. Per
 * ARCHITECTURE.md §13, speculative outreach carries more third-party risk
 * than a job-board application: there's no posted opening and the recipient
 * address is a pattern guess, not a confirmed one. Sending here requires
 * BOTH AGENT_ALLOW_REAL_APPLY (the general real-apply gate) AND this
 * dedicated flag — flipping the general gate on for Tier A/B email/portal
 * applies must not silently also start emailing guessed addresses.
 */
function speculativeSendAllowed(): boolean {
  return process.env.AGENT_ALLOW_REAL_APPLY === "true" && process.env.AGENT_ALLOW_SPECULATIVE_SEND === "true";
}

/**
 * Sends a prepared speculative outreach email via the user's own Gmail
 * account, to the lead's guessed email. No-op (returns false) unless both
 * safety gates above are set — never called by default.
 */
export async function sendSpeculativeOutreach(speculativeApplicationId: string): Promise<boolean> {
  if (!speculativeSendAllowed()) {
    console.log(
      `[leads] AGENT_ALLOW_SPECULATIVE_SEND not set — skipping send for ${speculativeApplicationId} (prepared, not sent)`,
    );
    return false;
  }

  const db = getDb();
  const [application] = await db
    .select()
    .from(speculativeApplications)
    .where(eq(speculativeApplications.id, speculativeApplicationId))
    .limit(1);
  if (!application) throw new Error(`Unknown speculative application: ${speculativeApplicationId}`);
  if (!application.tailoredCvRef || !application.coverLetterRef) {
    throw new Error(`Speculative application ${speculativeApplicationId} has not been prepared yet`);
  }

  let toEmail: string;
  let companyName: string;
  if (application.leadId) {
    const [lead] = await db.select().from(fundingLeads).where(eq(fundingLeads.id, application.leadId)).limit(1);
    if (!lead?.guessedEmail) throw new Error(`Lead ${application.leadId} has no guessed email`);
    toEmail = lead.guessedEmail;
    companyName = lead.companyName;
  } else {
    if (!application.contactEmail || !application.companyName) {
      throw new Error(`Speculative application ${speculativeApplicationId} has no contact email/company`);
    }
    toEmail = application.contactEmail;
    companyName = application.companyName;
  }

  const [cvBuffer, coverLetterBuffer] = await Promise.all([
    downloadObject(application.tailoredCvRef),
    downloadObject(application.coverLetterRef),
  ]);

  await sendApplicationEmail(application.userId, {
    to: toEmail,
    subject: `Interested in opportunities at ${companyName}`,
    bodyText: coverLetterBuffer.toString("utf-8"),
    attachments: [{ filename: "cv.pdf", content: cvBuffer, mimeType: "application/pdf" }],
  });

  await db
    .update(speculativeApplications)
    .set({ status: "applied", appliedAt: new Date() })
    .where(eq(speculativeApplications.id, application.id));

  return true;
}
