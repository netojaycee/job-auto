import { chromium } from "playwright";

export interface PortalApplicant {
  fullName: string;
  email: string;
  resumeFilePath: string;
  coverLetterFilePath?: string;
}

/**
 * Submits an application through a Greenhouse job board form.
 *
 * SAFETY: this sends a real application to a real employer. It must never
 * run against a live posting except when the user has deliberately chosen
 * to apply to that specific job — see apply/orchestrate.ts's
 * AGENT_ALLOW_REAL_APPLY gate. Do not invoke this against arbitrary scraped
 * postings during development/testing.
 *
 * Greenhouse's standard embedded application form has stable field names
 * (first_name/last_name/email/resume) across most boards, but custom
 * questions per posting vary — this covers the common fields and leaves
 * custom questions unanswered, which will cause submission to fail
 * validation rather than submit an incomplete application silently.
 */
export async function submitGreenhouseApplication(
  jobUrl: string,
  applicant: PortalApplicant,
): Promise<{ submitted: boolean; reason?: string }> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(jobUrl, { waitUntil: "domcontentloaded" });

    const firstName = applicant.fullName.split(" ")[0] ?? applicant.fullName;
    const lastName = applicant.fullName.split(" ").slice(1).join(" ") || firstName;

    await page.fill('input[name="first_name"]', firstName);
    await page.fill('input[name="last_name"]', lastName);
    await page.fill('input[name="email"]', applicant.email);

    const resumeInput = page.locator('input[type="file"]').first();
    await resumeInput.setInputFiles(applicant.resumeFilePath);

    if (applicant.coverLetterFilePath) {
      const coverInput = page.locator('input[type="file"]').nth(1);
      if (await coverInput.count()) {
        await coverInput.setInputFiles(applicant.coverLetterFilePath);
      }
    }

    // Custom per-posting questions are not handled — bail rather than
    // submit an application we can't confirm is complete and accurate.
    const requiredUnhandled = await page
      .locator('[required]:not([name="first_name"]):not([name="last_name"]):not([name="email"])')
      .count();
    if (requiredUnhandled > 0) {
      return { submitted: false, reason: `${requiredUnhandled} unhandled required field(s)` };
    }

    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForLoadState("networkidle");

    return { submitted: true };
  } finally {
    await browser.close();
  }
}
