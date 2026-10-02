import * as dotenv from "dotenv";
import * as nodePath from "path";
dotenv.config({ path: nodePath.resolve(__dirname, "../../../../.env") });
import { eq } from "drizzle-orm";
import { getDb, users } from "@job-auto/db";
import { runAgentForUser } from "./run-agent-for-user";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: pnpm --filter @job-auto/worker agent:run <email>");
    process.exit(1);
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  await runAgentForUser(user.id);
  console.log(`Agent run complete for ${email}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
