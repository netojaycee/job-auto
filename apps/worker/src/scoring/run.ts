import * as dotenv from "dotenv";
dotenv.config();
import { eq } from "drizzle-orm";
import { getDb, users } from "@job-auto/db";
import { shortlistJobsForUser } from "./shortlist";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: pnpm --filter @job-auto/worker score:run -- <email>");
    process.exit(1);
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  const results = await shortlistJobsForUser(user.id);
  console.log(`Shortlisted ${results.length} job(s):`);
  for (const r of results) {
    console.log(`  [${r.score}] ${r.title} @ ${r.company} — ${r.reasoning}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
