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
5. If there isn't enough source material to fill out a typical CV section well, write a shorter section rather than inventing content to pad it.
6. Never include placeholder, bracketed, or "omitted" annotation text (e.g. "[LinkedIn / GitHub – optional]", "[phone number]", "Phone omitted", "LinkedIn omitted") for contact details, links, or anything else — if a detail isn't given to you, the line must not mention it at all, not announce that it's missing.`;

/**
 * Reframes/reorders REAL experience for this specific job — never invents
 * skills, employers, or achievements. See ARCHITECTURE.md §7/§12.
 *
 * NOTE: weaker/free-tier models have been observed inventing entire
 * "Projects" sections with fabricated metrics despite instructions not to —
 * this is verified post-generation by verifyNoFabrication, not trusted from
 * the prompt alone. Do not remove that verification step.
 */
export async function tailorCv(parsedCv: ParsedCv, job: JobForTailoring, contactEmail: string): Promise<string> {
  const provider = getAiProvider();
  const result = await provider.complete({
    system: `You tailor a candidate's CV for a specific job posting. ${NO_FABRICATION_RULES} Output a complete, plain-text CV ready to send, not commentary about the tailoring.`,
    prompt: `Candidate's parsed CV data (the ONLY source of truth for their experience):
${JSON.stringify(parsedCv, null, 2)}

Candidate's real email address, confirmed true and safe to use even though it's not in the JSON above: ${contactEmail}
Include it once in the header line. No phone number or LinkedIn URL is known — leave both out of the header entirely, with no mention of them at all.

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
  contactEmail: string,
): Promise<FabricationCheckResult> {
  const provider = getAiProvider();
  const result = await provider.complete({
    system:
      'You audit a tailored CV against a candidate\'s source CV data for fabricated content — any employer, project, title, tool, or quantified claim (percentages, dollar amounts, team sizes, etc.) that does not appear in the source data. Rephrasing or reordering existing facts is fine and not a violation. The candidate\'s real email address is separately confirmed true and is NOT a fabrication even though it is not in the source data — do not flag it. Flag any OTHER email, phone number, or handle that appears, since those would be invented. Also flag any placeholder/"omitted" annotation text (e.g. "Phone omitted", "[LinkedIn]") as a violation. Output ONLY JSON: {"fabricatedClaims": string[]} — empty array if none found.',
    prompt: `Source CV data (ground truth):
${JSON.stringify(parsedCv, null, 2)}

Candidate's confirmed-true real email (not a fabrication if present): ${contactEmail}

Tailored CV to audit:
${tailoredCvText}

List any claims in the tailored CV not grounded in the source data or the confirmed email above.`,
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

/**
 * Tailors a CV with up to 3 regeneration attempts against verifyNoFabrication,
 * throwing (never returning an unverified CV) if all attempts fail. Shared by
 * job-board applications (apply/prepare.ts) and speculative outreach
 * (leads/prepare.ts) — same fabrication risk, same guard, one implementation.
 */
export async function tailorCvVerified(parsedCv: ParsedCv, job: JobForTailoring, contactEmail: string): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const text = await tailorCv(parsedCv, job, contactEmail);
    const check = await verifyNoFabrication(text, parsedCv, contactEmail);
    if (check.ok) return text;
    console.warn(
      `[tailorCvVerified] attempt ${attempt} contained fabricated claims, ${attempt < 3 ? "retrying" : "giving up"}:`,
      check.fabricatedClaims,
    );
  }
  throw new Error(
    "Tailored CV failed the fabrication check 3 times — refusing to send a CV with invented content.",
  );
}

export async function generateCoverLetter(
  canonicalProfileText: string,
  job: JobForTailoring,
): Promise<string> {
  const provider = getAiProvider();
  const result = await provider.complete({
    system:
      "You write a concise, specific cover letter (3-4 short paragraphs) grounded strictly in the candidate's real profile. Never invent experience. No generic filler — reference concrete things from the candidate's background that are actually relevant to this specific role. Sign off with the candidate's name (and city, if it's in the profile) only — never invent an email address or phone number; the real send channel already carries that information.",
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

export interface LeadForOutreach {
  companyName: string;
  summary: string | null;
  fundingAmount: string | null;
}

/**
 * Synthesizes a JobForTailoring context for a lead with no posted opening —
 * lets tailorCv/tailorCvVerified be reused unchanged for speculative
 * outreach. See ARCHITECTURE.md §13. `fundingAmount` is specific to the
 * funding-news lead pipeline; manual cold-email targets (§15) have none, so
 * the funding framing only appears when it's actually true.
 */
export function speculativeJobContext(lead: LeadForOutreach, targetRole: string): JobForTailoring {
  const reasonNote = lead.fundingAmount
    ? `${lead.companyName} recently raised ${lead.fundingAmount}.`
    : `${lead.companyName}.`;
  return {
    title: targetRole,
    company: lead.companyName,
    description: `${reasonNote} ${lead.summary ?? ""} No specific job posting exists yet — this is speculative outreach ahead of an opening, tailor toward a ${targetRole}-shaped role there.`,
  };
}

/**
 * Cold-outreach email, not a reply to a posting — introduces the candidate
 * and expresses interest in a specific type of role, rather than responding
 * to a posting's requirements. Only references funding news as the reason
 * for reaching out when `fundingAmount` is actually set (the funding-lead
 * pipeline, §13) — a manual cold-email target (§15) has none, so the prompt
 * falls back to whatever real context the user gave instead of inventing a
 * funding reason that isn't true. Same no-fabrication grounding as
 * generateCoverLetter.
 */
export async function generateSpeculativeCoverLetter(
  canonicalProfileText: string,
  lead: LeadForOutreach,
  targetRole: string,
): Promise<string> {
  const provider = getAiProvider();
  const reasonForOutreach = lead.fundingAmount
    ? `their recent funding (${lead.fundingAmount}) as the reason for reaching out`
    : "the context given below as the reason for reaching out — do not mention funding or investment unless that context actually says so";
  const result = await provider.complete({
    system: `You write a concise, specific speculative-outreach email (3-4 short paragraphs) from a candidate to a company that has no posted job opening. Ground everything strictly in the candidate's real profile — never invent experience. Reference ${reasonForOutreach}, express genuine interest in a specific type of role there, and ask whether they're hiring or planning to — do not write as if replying to a job ad. Sign off with the candidate's name (and city, if it's in the profile) only — never invent an email address or phone number; the real send channel already carries that information.`,
    prompt: `Candidate profile:
${canonicalProfileText}

Company: ${lead.companyName}
Context: ${lead.summary ?? "unknown"}
Role the candidate is interested in: ${targetRole}

Write the outreach email now — plain text, ready to send.`,
    maxTokens: 800,
    temperature: 0.4,
  });
  return result.text.trim();
}
