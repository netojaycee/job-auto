import * as dotenv from "dotenv";
dotenv.config();
import { seedJobSources } from "./seed-sources";
import { ingestAllSources } from "./ingest";

async function main() {
  await seedJobSources();
  await ingestAllSources();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
