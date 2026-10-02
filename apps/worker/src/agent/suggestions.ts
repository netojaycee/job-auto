import { getAiProvider } from "@job-auto/ai";
import { getDb, profileFeedback } from "@job-auto/db";

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

interface LowScoredJob {
  title: string;
  company: string;
  score: number;
  reasoning: string;
}

/**
 * Diffs low-scoring candidates against the profile and proposes concrete
 * additions (skills, certs, portfolio pieces) — surfaced to the user for
 * review, never auto-applied to the profile. See ARCHITECTURE.md §7.
 */
export async function generateProfileSuggestions(
  userId: string,
  canonicalProfileText: string,
  lowScoredJobs: LowScoredJob[],
): Promise<string[]> {
  if (lowScoredJobs.length === 0) return [];

  const provider = getAiProvider();
  const result = await provider.complete({
    system:
      "You identify concrete, specific gaps in a candidate's profile based on jobs they scored poorly against. Output ONLY a JSON array of 1-4 short, actionable suggestion strings — no prose, no markdown fences. Be specific (name real skills/certs), never generic ('improve your resume').",
    prompt: `Candidate profile:
${canonicalProfileText}

Jobs this candidate scored low on:
${lowScoredJobs.map((j) => `- [${j.score}] ${j.title} @ ${j.company}: ${j.reasoning}`).join("\n")}

What specific additions to their profile would most improve future match scores?`,
    // Same hidden-reasoning truncation risk as score-job.ts/extract.ts on
    // Groq's gpt-oss-120b — 400 was observed silently truncating to an
    // empty suggestion list in live testing.
    maxTokens: 700,
    temperature: 0.3,
  });

  const json = extractJson(result.text);
  let suggestions: string[];
  try {
    suggestions = JSON.parse(json);
    if (!Array.isArray(suggestions)) throw new Error("not an array");
  } catch {
    return [];
  }

  const db = getDb();
  for (const suggestion of suggestions) {
    await db.insert(profileFeedback).values({ userId, suggestionText: suggestion });
  }

  return suggestions;
}
