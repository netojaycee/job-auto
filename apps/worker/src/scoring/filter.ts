import type { jobPostings, jobPreferences } from "@job-auto/db";

type JobPosting = typeof jobPostings.$inferSelect;
type JobPreferences = typeof jobPreferences.$inferSelect;

function includesAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => n.trim() && lower.includes(n.toLowerCase()));
}

function looksRemote(location: string | null): boolean {
  return Boolean(location && location.toLowerCase().includes("remote"));
}

/**
 * Cheap keyword/location filter applied before any LLM call. Deliberately
 * permissive on location matching — we don't have a real location taxonomy,
 * so a strict match would silently drop too many legitimate candidates.
 * Only excludedCompanies/excludedKeywords are treated as hard excludes.
 */
export function structuredFilter(postings: JobPosting[], prefs: JobPreferences): JobPosting[] {
  return postings.filter((posting) => {
    if (includesAny(posting.company, prefs.excludedCompanies ?? [])) return false;
    if (includesAny(`${posting.title} ${posting.description}`, prefs.excludedKeywords ?? []))
      return false;

    if (prefs.roles && prefs.roles.length > 0 && !includesAny(posting.title, prefs.roles)) {
      return false;
    }

    if (prefs.remotePref === "onsite" && looksRemote(posting.location)) return false;
    if (prefs.remotePref === "remote" && posting.location && !looksRemote(posting.location)) {
      // Allow through if no location string at all (some feeds omit it) —
      // only exclude when we positively know it's NOT remote.
      return false;
    }

    if (
      prefs.remotePref !== "remote" &&
      prefs.locations &&
      prefs.locations.length > 0 &&
      posting.location &&
      !looksRemote(posting.location) &&
      !includesAny(posting.location, prefs.locations)
    ) {
      return false;
    }

    return true;
  });
}
