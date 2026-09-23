import { chromium } from "playwright";
import type { PortalApplicant } from "./greenhouse-portal";

/**
 * Submits an application through a Lever job board form.
 *
 * SAFETY: same rule as greenhouse-portal.ts — this sends a real application
 * to a real employer. Never invoke against a live posting except when the
 * user has deliberately chosen to apply to that specific job. Do not run
 * against arbitrary scraped postings during development/testing.
 *
 * Lever's standard application form uses name="name"/"email"/"resume"
 * fields across most boards; custom questions per posting vary and are not
 * handled here — same fail-closed behavior as the Greenhouse adapter.
 */
export async function submitLeverApplication(
  jobUrl: string,
  applicant: PortalApplicant,
): Promise<{ submitted: boolean; reason?: string }> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const applyUrl = jobUrl.endsWith("/apply") ? jobUrl : `${jobUrl}/apply`;
    await page.goto(applyUrl, { waitUntil: "domcontentloaded" });

    await page.fill('input[name="name"]', applicant.fullName);
    await page.fill('input[name="email"]', applicant.email);

    const resumeInput = page.locator('input[name="resume"], input[type="file"]').first();
    await resumeInput.setInputFiles(applicant.resumeFilePath);

    if (applicant.coverLetterFilePath) {
      const coverField = page.locator('textarea[name="comments"]');
      if (await coverField.count()) {
        const fs = await import("node:fs/promises");
        const coverText = await fs.readFile(applicant.coverLetterFilePath, "utf-8");
        await coverField.fill(coverText);
      }
    }

    const requiredUnhandled = await page
      .locator('[required]:not([name="name"]):not([name="email"]):not([name="resume"]):not([name="comments"])')
      .count();
    if (requiredUnhandled > 0) {
      return { submitted: false, reason: `${requiredUnhandled} unhandled required field(s)` };
    }

    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");

    return { submitted: true };
  } finally {
    await browser.close();
  }
}
