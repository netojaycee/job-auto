import { eq } from "drizzle-orm";
import { getAiProvider } from "@job-auto/ai";
import { getDb, fundingArticles, fundingLeads } from "@job-auto/db";
import { bestEmailGuess, guessDomainFromCompanyName } from "./email-guess";

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

interface ExtractedLead {
  isFundingNews: boolean;
  companyName?: string;
  domain?: string;
  fundingAmount?: string;
  summary?: string;
}

async function extractLeadFromArticle(title: string, description: string): Promise<ExtractedLead> {
  const provider = getAiProvider();
  const result = await provider.complete({
    system:
      'You extract structured data from startup-funding news articles. Output ONLY JSON: {"isFundingNews": boolean, "companyName": string, "domain": string (your best guess at the company\'s own website domain, e.g. "acme.com" — not the news site), "fundingAmount": string, "summary": string (1 sentence, what they do + the round)}. Set isFundingNews to false for anything that isn\'t reporting a specific company\'s funding round (e.g. opinion pieces, "how to raise money" guides, daily digests) — in that case the other fields can be omitted. Identify the COMPANY THAT RECEIVED the funding, not an investor mentioned in the headline (e.g. in "Acme leads a $5m round in Foo", the company is Foo, not Acme).',
    prompt: `Title: ${title}\nDescription: ${description}`,
    // Some free-tier reasoning models (e.g. Groq's gpt-oss) spend part of
    // the token budget on hidden reasoning before the JSON answer — 300
    // truncated ~15% of responses in testing.
    maxTokens: 700,
    temperature: 0,
  });

  const json = extractJson(result.text);
  return JSON.parse(json) as ExtractedLead;
}

const MAX_ARTICLES_PER_RUN = 30;

/** Processes unprocessed funding_articles into funding_leads. Needs a real AI call per article — see the quota caveat in STATUS.md. */
export async function extractLeadsFromArticles(): Promise<{ processed: number; leadsCreated: number }> {
  const db = getDb();
  const unprocessed = await db
    .select()
    .from(fundingArticles)
    .where(eq(fundingArticles.processed, false))
    .limit(MAX_ARTICLES_PER_RUN);

  let leadsCreated = 0;
  for (const article of unprocessed) {
    try {
      const extracted = await extractLeadFromArticle(article.title, article.description ?? "");
      if (extracted.isFundingNews && extracted.companyName) {
        const domain = extracted.domain || guessDomainFromCompanyName(extracted.companyName);
        await db.insert(fundingLeads).values({
          articleId: article.id,
          companyName: extracted.companyName,
          domain,
          fundingAmount: extracted.fundingAmount ?? null,
          summary: extracted.summary ?? null,
          guessedEmail: bestEmailGuess(domain),
        });
        leadsCreated += 1;
      }
    } catch (err) {
      console.error(`[leads] failed to extract from article ${article.id}:`, err);
      continue; // leave unprocessed=false so a retry can pick it up later
    }
    await db.update(fundingArticles).set({ processed: true }).where(eq(fundingArticles.id, article.id));
  }

  return { processed: unprocessed.length, leadsCreated };
}
