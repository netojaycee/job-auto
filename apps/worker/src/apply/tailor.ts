import { getAiProvider } from "@job-auto/ai";
import type { ParsedCv } from "@job-auto/types";

export interface JobForTailoring {
  title: string;
  company: string;
  description: string;
}

export function needsCoverLetter(job: JobForTailoring): boolean {
  return /cover letter/i.test(job.description);
}

const NO_FABRICATION_RULES = `Hard rules — violating any of these makes the output unusable:
1. This is a CLOSED-BOOK task. Every employer, job title, date, project name, tool, skill, and metric/number in your output MUST already appear in the source JSON below. If it's not in the JSON, it does not exist for this candidate.
2. Do NOT add a "Projects", "Selected Contributions", "Achievements", or similar section unless the source JSON's experience entries already describe distinct named projects. Summarizing/rephrasing an existing experience bullet is fine; inventing a new named project is not.
3. Do NOT invent quantified claims (percentages, dollar amounts, team sizes, etc.) that are not present in the source JSON, even if plausible-sounding.
4. You MAY: reorder sections/bullets, rephrase wording, choose which existing bullets to emphasize or condense, and write a new summary paragraph that only recombines facts already in the source JSON.
5. If there isn't enough source material to fill out a typical CV section well, write a shorter section rather than inventing content to pad it.`;

/**
 * Reframes/reorders REAL experience for this specific job — never invents
 * skills, employers, or achievements. See ARCHITECTURE.md §7/§12.
 *
 * NOTE: weaker/free-tier models have been observed inventing entire
 * "Projects" sections with fabricated metrics despite instructions not to —
 * this is verified post-generation by verifyNoFabrication, not trusted from
 * the prompt alone. Do not remove that verification step.
 */
export async function tailorCv(parsedCv: ParsedCv, job: JobForTailoring): Promise<string> {
  const provider = getAiProvider();
  const result = await provider.complete({
    system: `You tailor a candidate's CV for a specific job posting. ${NO_FABRICATION_RULES} Output a complete, plain-text CV ready to send, not commentary about the tailoring.`,
    prompt: `Candidate's parsed CV data (the ONLY source of truth for their experience):
${JSON.stringify(parsedCv, null, 2)}

Job posting:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description.slice(0, 4000)}

Write the tailored CV now.`,
    maxTokens: 2000,
    temperature: 0.2,
  });
  return result.text.trim();
}

export interface FabricationCheckResult {
  ok: boolean;
  fabricatedClaims: string[];
}

/**
 * Independent second pass that checks a tailored CV against the source data
 * for invented content. Deliberately a separate call rather than trusting
 * the generation prompt — see the note on tailorCv above for why.
 */
export async function verifyNoFabrication(
  tailoredCvText: string,
  parsedCv: ParsedCv,
): Promise<FabricationCheckResult> {
  const provider = getAiProvider();
  const result = await provider.complete({
    system:
      'You audit a tailored CV against a candidate\'s source CV data for fabricated content — any employer, project, title, tool, or quantified claim (percentages, dollar amounts, team sizes, etc.) that does not appear in the source data. Rephrasing or reordering existing facts is fine and not a violation. Output ONLY JSON: {"fabricatedClaims": string[]} — empty array if none found.',
    prompt: `Source CV data (ground truth):
${JSON.stringify(parsedCv, null, 2)}

Tailored CV to audit:
${tailoredCvText}

List any claims in the tailored CV not grounded in the source data.`,
    maxTokens: 1200,
    temperature: 0,
  });

  const fenced = result.text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const json = (fenced ? fenced[1] : result.text).trim();
  try {
    const parsed = JSON.parse(json) as { fabricatedClaims: string[] };
    return { ok: parsed.fabricatedClaims.length === 0, fabricatedClaims: parsed.fabricatedClaims };
  } catch {
    // If the auditor's own output doesn't parse, fail closed — don't ship
    // an unverified CV.
    console.error("[verifyNoFabrication] failed to parse auditor output:", result.text.slice(0, 500));
    return { ok: false, fabricatedClaims: ["fabrication check itself failed to produce valid output"] };
  }
}

export async function generateCoverLetter(
  canonicalProfileText: string,
  job: JobForTailoring,
): Promise<string> {
  const provider = getAiProvider();
  const result = await provider.complete({
    system:
      "You write a concise, specific cover letter (3-4 short paragraphs) grounded strictly in the candidate's real profile. Never invent experience. No generic filler — reference concrete things from the candidate's background that are actually relevant to this specific role.",
    prompt: `Candidate profile:
${canonicalProfileText}

Job posting:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description.slice(0, 4000)}

Write the cover letter now — plain text, ready to send.`,
    maxTokens: 800,
    temperature: 0.4,
  });
  return result.text.trim();
}
