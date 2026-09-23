const LEVEL_WORDS = new Set([
  "senior", "sr", "junior", "jr", "lead", "staff", "principal", "entry",
  "mid", "i", "ii", "iii", "iv", "v", "associate", "intermediate",
]);

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !LEVEL_WORDS.has(word))
    .join(" ")
    .trim();
}

export interface PastApplication {
  company: string;
  title: string;
  createdAt: Date;
}

/**
 * Catches the same job reposted under a different source/external_id — the
 * hard unique constraint on (user_id, job_posting_id) can't see across rows.
 */
export function isFuzzyDuplicate(
  candidate: { company: string; title: string },
  pastApplications: PastApplication[],
  windowDays = 14,
): boolean {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const candidateTitle = normalizeTitle(candidate.title);
  const candidateCompany = candidate.company.toLowerCase().trim();

  return pastApplications.some(
    (past) =>
      past.createdAt.getTime() >= cutoff &&
      past.company.toLowerCase().trim() === candidateCompany &&
      normalizeTitle(past.title) === candidateTitle,
  );
}
