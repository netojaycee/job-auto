import * as dotenv from "dotenv";
dotenv.config();
import { ingestFundingArticles } from "./ingest";
import { extractLeadsFromArticles } from "./extract";

async function main() {
  const ingestResult = await ingestFundingArticles();
  console.log(`[leads] ingested: found ${ingestResult.found}, new ${ingestResult.new}`);

  const extractResult = await extractLeadsFromArticles();
  console.log(
    `[leads] extracted: processed ${extractResult.processed} article(s), created ${extractResult.leadsCreated} lead(s)`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
