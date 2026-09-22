import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const walletOwnerTypeEnum = pgEnum("wallet_owner_type", ["user", "cluster"]);
export const applicationStatusEnum = pgEnum("application_status", [
  "shortlisted",
  "tailoring",
  "applied",
  "failed",
  "skipped_dedup",
]);
export const applicationMethodEnum = pgEnum("application_method", ["email", "ats_portal"]);
export const jobSourceTypeEnum = pgEnum("job_source_type", ["api", "feed", "html"]);

export const clusters = pgTable("clusters", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerAdminId: uuid("owner_admin_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Doubles as Better Auth's "user" model (see apps/web/src/lib/auth.ts) — name,
// emailVerified, image, updatedAt exist for Better Auth's benefit; credentials
// themselves live in `accounts`, not here.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name"),
  image: text("image"),
  role: userRoleEnum("role").notNull().default("user"),
  clusterId: uuid("cluster_id").references(() => clusters.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Better Auth core tables — session/account/verification. Kept singular to
// match Better Auth's defaults; only `users` above is remapped to plural.
export const sessions = pgTable("session", {
  id: uuid("id").primaryKey().defaultRandom(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("account", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable("verification", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clusterMembers = pgTable(
  "cluster_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    clusterId: uuid("cluster_id").notNull().references(() => clusters.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("cluster_members_user_cluster_idx").on(table.userId, table.clusterId)],
);

export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerType: walletOwnerTypeEnum("owner_type").notNull(),
  ownerId: uuid("owner_id").notNull(),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const walletLedger = pgTable("wallet_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").notNull().references(() => wallets.id),
  delta: numeric("delta", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  refId: uuid("ref_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id),
  rawCvFileRef: text("raw_cv_file_ref"),
  parsedCvJson: jsonb("parsed_cv_json"),
  linkedinUrl: text("linkedin_url"),
  otherLinks: jsonb("other_links").$type<string[]>().default([]),
  aboutMeText: text("about_me_text"),
  canonicalProfileText: text("canonical_profile_text"),
  canonicalProfileUpdatedAt: timestamp("canonical_profile_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobPreferences = pgTable("job_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id),
  roles: jsonb("roles").$type<string[]>().default([]),
  locations: jsonb("locations").$type<string[]>().default([]),
  remotePref: varchar("remote_pref", { length: 20 }).default("any"),
  salaryFloor: integer("salary_floor"),
  industries: jsonb("industries").$type<string[]>().default([]),
  excludedCompanies: jsonb("excluded_companies").$type<string[]>().default([]),
  excludedKeywords: jsonb("excluded_keywords").$type<string[]>().default([]),
  dailyRunTime: varchar("daily_run_time", { length: 5 }).notNull().default("08:00"),
  maxApplicationsPerDay: integer("max_applications_per_day").notNull().default(10),
});

export const jobSources = pgTable("job_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: jobSourceTypeEnum("type").notNull(),
  baseUrl: text("base_url").notNull(),
  adapterKey: text("adapter_key").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  robotsNotes: text("robots_notes"),
});

export const jobPostings = pgTable(
  "job_postings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id").notNull().references(() => jobSources.id),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    location: text("location"),
    description: text("description").notNull(),
    contentHash: text("content_hash").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("job_postings_source_external_idx").on(table.sourceId, table.externalId)],
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    jobPostingId: uuid("job_posting_id").notNull().references(() => jobPostings.id),
    status: applicationStatusEnum("status").notNull().default("shortlisted"),
    method: applicationMethodEnum("method"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    tailoredCvRef: text("tailored_cv_ref"),
    coverLetterRef: text("cover_letter_ref"),
    matchScore: integer("match_score"),
    matchReasoning: text("match_reasoning"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("applications_user_job_posting_idx").on(table.userId, table.jobPostingId),
  ],
);

export const applicationChannels = pgTable("application_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  provider: varchar("provider", { length: 20 }).notNull().default("gmail"),
  oauthTokens: jsonb("oauth_tokens"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profileFeedback = pgTable("profile_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  suggestionText: text("suggestion_text").notNull(),
  sourceApplicationIds: jsonb("source_application_ids").$type<string[]>().default([]),
});

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: varchar("status", { length: 20 }).notNull().default("running"),
  jobsSeen: integer("jobs_seen").notNull().default(0),
  jobsShortlisted: integer("jobs_shortlisted").notNull().default(0),
  jobsApplied: integer("jobs_applied").notNull().default(0),
  tokensSpent: integer("tokens_spent").notNull().default(0),
  errorSummary: text("error_summary"),
});

export const crawlRuns = pgTable("crawl_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").notNull().references(() => jobSources.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  postingsFound: integer("postings_found").notNull().default(0),
  postingsNew: integer("postings_new").notNull().default(0),
});
