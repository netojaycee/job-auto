import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb, users, sessions, accounts, verifications } from "@job-auto/db";

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
      clusterId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  secret: process.env.AUTH_SECRET,
  advanced: {
    database: {
      // All our tables use Postgres `defaultRandom()` uuid primary keys —
      // let the DB generate ids instead of Better Auth's default nanoid.
      generateId: false,
    },
  },
});
