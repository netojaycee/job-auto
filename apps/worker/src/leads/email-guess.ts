import { getAiProvider } from "@job-auto/ai";

/**
 * Pure pattern-guessing — no verification service. Accuracy is inherently
 * limited: this guesses a plausible address, it does not confirm one
 * exists. "careers@" is tried first since it's the convention most likely
 * to be monitored for job inquiries; the full candidate list is kept on the
 * lead record so a human (or a future verification step) can review/pick
 * a different one before anything is sent.
 */
const PREFIXES_BY_LIKELIHOOD = ["careers", "jobs", "talent", "hr", "hello", "contact", "info"];

export function guessEmailCandidates(domain: string): string[] {
  return PREFIXES_BY_LIKELIHOOD.map((prefix) => `${prefix}@${domain}`);
}

export function bestEmailGuess(domain: string): string {
  return guessEmailCandidates(domain)[0];
}

/** Crude fallback when no real domain is known — slugified company name + .com. */
export function guessDomainFromCompanyName(companyName: string): string {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
  return `${slug}.com`;
}

function domainFromUrl(url: string): string {
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return new URL(withScheme).hostname.replace(/^www\./, "");
}

/**
 * Resolves a company's real domain when the user hasn't given one — asks the
 * AI for its best guess (same technique already used in leads/extract.ts,
 * where it's produced correct real domains from just a company name/summary
 * in testing), falling back to the crude slugify heuristic if that fails or
 * comes back empty. Still a guess, not a lookup — no external verification.
 */
export async function resolveCompanyDomain(companyName: string, context?: string): Promise<string> {
  try {
    const provider = getAiProvider();
    const result = await provider.complete({
      system:
        'Give your best guess at a company\'s real website domain from its name (and optional context). Output ONLY JSON: {"domain": string|null} — a bare domain like "acme.com", no protocol/path; null if you genuinely don\'t know (don\'t invent an implausible one).',
      prompt: `Company: ${companyName}${context ? `\nContext: ${context}` : ""}`,
      maxTokens: 300,
      temperature: 0,
    });
    const fenced = result.text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const parsed = JSON.parse((fenced ? fenced[1] : result.text).trim()) as { domain: string | null };
    if (parsed.domain) return parsed.domain;
  } catch {
    // fall through to the crude heuristic below
  }
  return guessDomainFromCompanyName(companyName);
}

export interface ResolvedCompanyEmail {
  contactEmail: string;
  candidates: string[];
}

/**
 * Full resolution path for the manual cold-email flow: use a given website
 * if the user provided one (most reliable), otherwise ask the AI to guess
 * the domain, then apply the same prefix-guessing as the funding-lead
 * pipeline. Always returns a "best guess" plus the full candidate list for
 * transparency/override — never a verified address.
 */
export async function resolveCompanyEmail(
  companyName: string,
  website?: string | null,
  context?: string,
): Promise<ResolvedCompanyEmail> {
  const domain = website ? domainFromUrl(website) : await resolveCompanyDomain(companyName, context);
  const candidates = guessEmailCandidates(domain);
  return { contactEmail: candidates[0], candidates };
}
