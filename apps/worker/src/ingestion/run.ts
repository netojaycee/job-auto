import * as dotenv from "dotenv";
import * as nodePath from "path";
dotenv.config({ path: nodePath.resolve(__dirname, "../../../../.env") });
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
