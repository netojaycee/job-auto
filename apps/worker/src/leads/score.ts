import { getAiProvider } from "@job-auto/ai";

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

export interface LeadScoreResult {
  score: number;
  reasoning: string;
}

/**
 * Scores a funding lead against a candidate's profile — there's no specific
 * job posting to match against, so this judges general fit (sector, stage,
 * likely hiring needs of a newly-funded company at this size) rather than
 * matching requirements line-by-line, per ARCHITECTURE.md §13.
 */
export async function scoreLeadAgainstProfile(
  canonicalProfileText: string,
  lead: { companyName: string; summary: string | null; fundingAmount: string | null },
): Promise<LeadScoreResult> {
  const provider = getAiProvider();
  const result = await provider.complete({
    system:
      'You score how promising a speculative job-outreach target is for a candidate. There is no specific job posting — judge general fit: does the company\'s sector/product/stage plausibly need someone with this candidate\'s skills soon, given its recent funding? Output ONLY valid JSON on a single line: {"score": number 0-100, "reasoning": string, one short sentence, under 20 words}. Be discriminating — reserve 80+ for genuinely strong sector/skill overlap.',
    prompt: `Candidate profile:
${canonicalProfileText}

Company: ${lead.companyName}
Recent funding: ${lead.fundingAmount ?? "unknown amount"}
What they do: ${lead.summary ?? "unknown"}

Score the fit for speculative outreach.`,
    // Same hidden-reasoning truncation risk as scoring/score-job.ts and
    // leads/extract.ts on free-tier reasoning models.
    maxTokens: 600,
    temperature: 0,
  });

  const json = extractJson(result.text);
  const parsed = JSON.parse(json) as LeadScoreResult;
  return { score: Math.max(0, Math.min(100, Math.round(parsed.score))), reasoning: parsed.reasoning };
}
