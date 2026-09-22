import { getAiProvider } from "@job-auto/ai";
import type { ParsedCv } from "@job-auto/types";

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
}): Promise<string> {
  const provider = getAiProvider();
  const result = await provider.complete({
    system:
      "You write a concise, factual 'master profile' narrative for a job-seeker, grounded strictly in the information given. Never invent skills, employers, or achievements. This profile will be used to score job fit and tailor applications, so it must be accurate and specific, not generic praise.",
    prompt: `Write a canonical profile (3-5 short paragraphs) synthesizing the following into a single coherent narrative: who this person is professionally, their core skills and strongest experience, and what kind of roles they're suited for. Plain text, no markdown headers.

Parsed CV data:
${JSON.stringify(input.parsedCv, null, 2)}

About me (in their own words): ${input.aboutMeText ?? "(not provided)"}

LinkedIn: ${input.linkedinUrl ?? "(not provided)"}
Other links: ${input.otherLinks.length ? input.otherLinks.join(", ") : "(none)"}`,
    maxTokens: 1200,
    temperature: 0.3,
  });

  return result.text.trim();
}
