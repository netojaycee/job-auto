import "dotenv/config";
import { seedJobSources } from "./seed-sources.js";
import { ingestAllSources } from "./ingest.js";

async function main() {
  await seedJobSources();
  await ingestAllSources();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
