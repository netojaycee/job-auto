import * as dotenv from "dotenv";
import * as nodePath from "path";
dotenv.config({ path: nodePath.resolve(__dirname, "../../../../.env") });
import { eq } from "drizzle-orm";
import { getDb, applications, users } from "@job-auto/db";
import { prepareApplication } from "./prepare";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: pnpm --filter @job-auto/worker prepare:run <email>");
    process.exit(1);
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  const [application] = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, user.id))
    .limit(1);
  if (!application) {
    console.error(`No shortlisted applications for ${email} — run score:run first.`);
    process.exit(1);
  }

  const result = await prepareApplication(application.id);
  console.log(result);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
