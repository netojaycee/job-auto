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
