import { getAiProvider } from "@job-auto/ai";

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

export interface JobScoreResult {
  score: number;
  reasoning: string;
}

export async function scoreJobAgainstProfile(
  canonicalProfileText: string,
  job: { title: string; company: string; description: string },
): Promise<JobScoreResult> {
  const provider = getAiProvider();
  const result = await provider.complete({
    system:
      "You score how well a candidate's profile fits a job posting. Output ONLY valid JSON on a single line: {\"score\": number 0-100, \"reasoning\": string, one short sentence, under 20 words}. Be discriminating — most postings are not a great fit; reserve 80+ for genuinely strong matches on both skills and seniority.",
    prompt: `Candidate profile:
${canonicalProfileText}

Job posting:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description.slice(0, 4000)}

Score the fit.`,
    // Some free-tier models (e.g. Groq's gpt-oss) spend part of the token
    // budget on hidden reasoning before the visible answer, truncating the
    // JSON if this is too tight — this failed at 200 in testing.
    maxTokens: 600,
    temperature: 0,
  });

  const json = extractJson(result.text);
  const parsed = JSON.parse(json) as JobScoreResult;
  return { score: Math.max(0, Math.min(100, Math.round(parsed.score))), reasoning: parsed.reasoning };
}
