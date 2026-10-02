import { chromium } from "playwright";
import { marked } from "marked";

const RESUME_CSS = `
  @page { margin: 18mm 16mm; }
  body {
    font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.5;
    color: #1a1a1a;
  }
  h1, h2, h3 { font-family: Georgia, "Times New Roman", serif; }
  h1 { font-size: 20pt; margin: 0 0 2pt; }
  h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.05em; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 2pt; margin: 16pt 0 8pt; }
  h3 { font-size: 11.5pt; margin: 10pt 0 2pt; }
  p { margin: 4pt 0; }
  ul { margin: 4pt 0; padding-left: 18pt; }
  li { margin: 2pt 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 10pt 0; }
  strong { font-weight: 600; }
  em { color: #555; }
`;

/**
 * Renders AI-generated markdown-ish CV text into a properly formatted PDF —
 * tailorCv's output was previously attached as a raw .txt file, which reads
 * as unpolished for something going directly to an employer. Reuses
 * Playwright (already a worker dependency for Tier B portal automation)
 * rather than adding a second PDF library.
 */
export async function renderCvPdf(markdownText: string, title = "CV"): Promise<Buffer> {
  // breaks:true so a single newline (e.g. name on one line, title on the
  // next, no blank line between) renders as a line break rather than
  // collapsing into one run-on line — the AI's tailored output isn't
  // always strict CommonMark.
  const bodyHtml = await marked.parse(markdownText, { breaks: true });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${RESUME_CSS}</style></head><body>${bodyHtml}</body></html>`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return pdf;
  } finally {
    await browser.close();
  }
}
