import { getAiProvider } from "@job-auto/ai";
import type { ClarifyingQa, JobPreferencesSuggestion, ParsedCv } from "@job-auto/types";

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

export async function parseCvText(cvText: string): Promise<ParsedCv> {
  const provider = getAiProvider();
  const result = await provider.complete({
    system:
      "You extract structured data from CVs/resumes. Output ONLY valid JSON matching the exact schema given — no prose, no markdown fences. Never invent experience, skills, or dates that aren't in the source text.",
    prompt: `Extract structured data from this CV text and return it as JSON matching this shape:
{
  "fullName": string | omit,
  "summary": string (2-3 sentence neutral summary of the candidate),
  "skills": string[],
  "experience": [{ "company": string, "title": string, "startDate": string | omit, "endDate": string | omit, "summary": string }],
  "education": [{ "institution": string, "degree": string, "field": string | omit, "endDate": string | omit }],
  "totalYearsExperience": number (best estimate from the dates present),
  "suggestedRoles": string[] (3-6 job titles this person is qualified for, based only on their actual experience)
}

CV text:
"""
${cvText}
"""`,
    maxTokens: 3000,
    temperature: 0,
  });

  const json = extractJson(result.text);
  try {
    return JSON.parse(json) as ParsedCv;
  } catch {
    throw new Error(`AI returned non-JSON CV parse result: ${result.text.slice(0, 200)}`);
  }
}

export async function synthesizeCanonicalProfile(input: {
  parsedCv: ParsedCv;
  aboutMeText: string | null;
  linkedinUrl: string | null;
  otherLinks: string[];
  clarifyingQa?: ClarifyingQa[];
}): Promise<string> {
  const provider = getAiProvider();
  const answeredQa = (input.clarifyingQa ?? []).filter((qa) => qa.answer);
  const result = await provider.complete({
    system:
      "You write a concise, factual 'master profile' narrative for a job-seeker, grounded strictly in the information given. Never invent skills, employers, or achievements. This profile will be used to score job fit and tailor applications, so it must be accurate and specific, not generic praise.",
    prompt: `Write a canonical profile (3-5 short paragraphs) synthesizing the following into a single coherent narrative: who this person is professionally, their core skills and strongest experience, and what kind of roles they're suited for. Plain text, no markdown headers.

Parsed CV data:
${JSON.stringify(input.parsedCv, null, 2)}

About me (in their own words): ${input.aboutMeText ?? "(not provided)"}

${answeredQa.length ? `Follow-up questions and answers:\n${answeredQa.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join("\n\n")}\n` : ""}
LinkedIn: ${input.linkedinUrl ?? "(not provided)"}
Other links: ${input.otherLinks.length ? input.otherLinks.join(", ") : "(none)"}`,
    maxTokens: 1200,
    temperature: 0.3,
  });

  return result.text.trim();
}

export async function generateClarifyingQuestions(parsedCv: ParsedCv): Promise<string[]> {
  const provider = getAiProvider();
  const result = await provider.complete({
    system:
      "You ask sharp, specific follow-up questions to fill gaps in a parsed CV before it's used to match and tailor job applications. Output ONLY a JSON array of 3-6 question strings — no prose, no markdown fences.",
    prompt: `Based on this parsed CV, ask 3-6 targeted questions that would meaningfully improve job matching — e.g. ambiguous seniority, unclear specialization, remote/relocation openness, or notable gaps. Don't ask generic questions ("what are your strengths?") — ask things specific to THIS CV.

Parsed CV:
${JSON.stringify(parsedCv, null, 2)}`,
    maxTokens: 500,
    temperature: 0.4,
  });

  const json = extractJson(result.text);
  try {
    const questions = JSON.parse(json);
    if (!Array.isArray(questions)) throw new Error("not an array");
    return questions as string[];
  } catch {
    return [];
  }
}

export async function suggestJobPreferences(
  parsedCv: ParsedCv,
  canonicalProfileText: string,
): Promise<JobPreferencesSuggestion> {
  const provider = getAiProvider();
  const result = await provider.complete({
    system:
      "You suggest job search preferences based on a candidate's profile. Output ONLY valid JSON matching the exact schema given — no prose, no markdown fences. These are suggestions the user will review and edit, so prefer sensible defaults over narrow guesses.",
    prompt: `Suggest job preferences as JSON matching this shape:
{
  "roles": string[] (3-6 job titles to search for),
  "locations": string[] (best guess at relevant locations/regions; use ["Remote"] if unclear),
  "remotePref": "remote" | "hybrid" | "onsite" | "any",
  "salaryFloor": number | omit (only if inferable from seniority/role, in USD, omit if not confident),
  "industries": string[] (2-4 industries this person's experience fits)
}

Parsed CV:
${JSON.stringify(parsedCv, null, 2)}

Canonical profile:
${canonicalProfileText}`,
    // Some free-tier reasoning models spend part of the token budget on
    // hidden reasoning before the JSON answer — 500 was too tight and
    // truncated output often enough to matter in practice.
    maxTokens: 900,
    temperature: 0.2,
  });

  const json = extractJson(result.text);
  try {
    return JSON.parse(json) as JobPreferencesSuggestion;
  } catch {
    throw new Error("AI returned invalid preference suggestions — try again.");
  }
}
