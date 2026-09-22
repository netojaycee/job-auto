# Status

How to use this file: each task gets checked off `[x]` when actually done and verified (build passes / feature works), not when merely attempted. Keep "Current focus" pointed at the single next task so a new agent/session knows exactly where to pick up. Add dated notes under a phase when something meaningful changes (a decision, a blocker, a scope cut).

## Current focus

Job source adapters + ingestion + crawl logging + content-hash dedup are done and verified against three live job boards. Next task: **structured preference filter (role/location/remote/salary) before any LLM call, then the LLM scoring pass** — i.e. start consuming the 600+ real job postings now sitting in the local DB.

---

## Phase 1 — Foundations: auth, profile, wallets (no billing yet), admin skeleton

- [x] Scaffold monorepo structure (Next.js app, NestJS worker service, shared packages: `db`, `ai`, `types`) — 2026-09-22. pnpm workspace at repo root; `apps/web` (Next.js 16, App Router, Tailwind), `apps/worker` (NestJS 12); `packages/db`, `packages/ai`, `packages/types` linked via `workspace:*`. Web + worker both build clean.
- [x] Postgres + Drizzle set up, initial migration for core tables (§3 of ARCHITECTURE.md) — 2026-09-22. 17 tables migrated to local Postgres (14 domain tables + Better Auth's `users`/`session`/`account`/`verification`, since `users` does double duty — see below).
- [x] Local dev DB/Redis — 2026-09-22. No Docker locally; `.env` points at Postgres/Redis run via DBngin. Root `docker-compose.yml` removed — Docker is deploy-only now, see `deploy/`.
- [x] Deployment pipeline scaffolded — 2026-09-22. `deploy/docker-compose.yml` (postgres, redis, web, worker, caddy — pulls prebuilt images, never builds from source), `deploy/Caddyfile` (placeholder domain, needs real subdomain before first deploy), `deploy/.env.example`, `apps/web/Dockerfile` + `apps/worker/Dockerfile`, `.github/workflows/deploy.yml` (builds+pushes images to GHCR, rsyncs only compose+Caddyfile to the server, remote `docker compose pull && up -d` over SSH). Server `.env` is provisioned separately (Doppler or manual SSH), CI never touches it. Full model: ARCHITECTURE.md §11. Not yet run against a real server — needs `SSH_HOST`/`SSH_USER`/`SSH_KEY`/`DEPLOY_PATH` repo secrets and a provisioned VPS.
- [x] Auth (Better Auth) — signup/login, user role field — 2026-09-22. `apps/web/src/lib/auth.ts` (server config, Drizzle adapter mapped onto our own `users`/`session`/`account`/`verification` tables rather than Better Auth's defaults — `users` carries `role`/`clusterId` as `additionalFields`, exposed read-only via `input: false`), `apps/web/src/app/api/auth/[...all]/route.ts` (handler), `apps/web/src/lib/auth-client.ts` (client), minimal `/signup`, `/login`, `/dashboard` pages. Verified live against local Postgres: signup, login, and get-session all return 200 with correct `role`/`clusterId` on the user object. Note: `advanced.database.generateId: false` is required since our tables use Postgres `defaultRandom()` uuids, not Better Auth's default nanoid strings — don't remove it.
- [x] Profile builder UI: CV upload (R2), parse to structured JSON via AI, linkedin/links fields, about-me textarea — 2026-09-22. `/profile` page; `POST /api/profile/cv` (upload → R2 via `packages/storage` → `pdf-parse`/`mammoth` text extraction → AI parse to `ParsedCv` JSON); `GET/POST /api/profile` (links + about-me, triggers resynthesis). Verified live: uploaded a real .docx CV, got back correctly structured skills/experience/education/suggestedRoles, and a coherent canonical profile narrative that correctly incorporated later about-me edits on resave.
- [x] Canonical profile synthesis (AI call that produces `canonical_profile_text`) — 2026-09-22. `apps/web/src/lib/profile-ai.ts::synthesizeCanonicalProfile`, re-run on both CV upload and profile save.
- [x] Clarifying-questions flow (AI asks 3-6 targeted questions post-CV-parse, answers merge into profile) — 2026-09-22. `generateClarifyingQuestions` runs alongside CV parsing, stored as `profiles.clarifying_qa` (jsonb `{question, answer}[]`); `/profile` page renders unanswered ones; `POST /api/profile/clarify` saves answers and resynthesizes. Verified live: got 5 CV-specific (not generic) questions, answered them, and confirmed the answers (AWS services, Terraform, Spark version, remote/location preference) showed up correctly in the resynthesized canonical profile.
- [x] Job preferences UI, AI-suggested defaults from CV, user-editable — 2026-09-22. `/preferences` page against the existing `job_preferences` table; "Suggest from my CV" button calls `POST /api/preferences/suggest` (AI, grounded in parsed CV + canonical profile, prefills the form — doesn't save until the user submits). Verified live: suggestion correctly reflected an answered clarifying question ("remote only, Lagos, US/EU timezones") that postdated the original CV upload, confirming it reads the current profile state, not a stale snapshot.
- [x] Wallet scaffolding: `wallets` + `wallet_ledger` tables, balance display in UI, admin grant endpoint (no real payment yet) — 2026-09-22. `apps/web/src/lib/wallet.ts` (`getOrCreateWallet`, `getEffectiveWallet` — resolves to the cluster wallet if the user has a `clusterId`, else their own personal wallet, per the cluster-sharing model in ARCHITECTURE.md §6; `grantCredits` updates balance + writes a ledger row). `GET /api/wallet` (balance for the current session), `POST /api/admin/wallet/grant` (role==="admin" gated). Balance shown on `/dashboard`. Verified live: fresh user starts at 0, grant correctly 403s for a non-admin, works after promoting to admin via DB, and both `wallets.balance` and a matching `wallet_ledger` row update correctly.
- [x] Admin panel skeleton: list users, view/grant wallet balance, create cluster, add/remove cluster members — 2026-09-22. `/admin` page (client-side role gate + every API route independently gated via `requireAdminSession`, never trust the client-side check alone). `GET /api/admin/users` (email/role/cluster/effective balance, computed without side-effecting wallet creation), `GET/POST /api/admin/clusters`, `POST`/`DELETE /api/admin/clusters/[id]/members` (sets/clears `users.clusterId` and the `cluster_members` join row together). Verified live end-to-end: created a cluster, added a member, granted credits to the cluster wallet, confirmed the member's own `/api/wallet` correctly showed the shared balance, then removed them and confirmed it reverted to their own (0) personal wallet. Also confirmed a non-admin gets 403 from every admin route.
- [x] AI provider abstraction (`packages/ai`) supporting Anthropic now, interface ready for Ollama swap — 2026-09-22. Also verified live against Groq's free OpenAI-compatible endpoint (`AI_PROVIDER=openai`, `AI_BASE_URL=https://api.groq.com/openai/v1`, `AI_MODEL=openai/gpt-oss-120b`) — this is what the profile builder testing above actually ran against. Note: Groq's model catalog changes; if a model 404s, check `GET https://api.groq.com/openai/v1/models`.

## Phase 2 — The actual agent: Tier A + Tier B + scheduling

- [x] Job source adapters: at least 2-3 of (Greenhouse public JSON, Lever public JSON, RemoteOK/WeWorkRemotely feed) — structured sourcing, no scraping yet — 2026-09-22. `apps/worker/src/ingestion/adapters/{greenhouse,lever,remoteok}.ts`, all confirmed against real public endpoints (no auth needed): Greenhouse `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`, Lever `api.lever.co/v0/postings/{account}?mode=json`, RemoteOK `remoteok.com/api` (skip array element 0 — it's a ToS notice, not a posting; RemoteOK's terms require attribution linking back to remoteok.com, noted in `job_sources.robots_notes`). Adapter registry keyed by `job_sources.adapter_key` so adding a new source is just a new adapter file + a registry entry, no ingestion-logic changes.
- [x] `job_postings` ingestion + crawl_runs logging + content-hash dedup on ingest — 2026-09-22. `apps/worker/src/ingestion/ingest.ts` (`ingestSource`, `ingestAllSources`), seed script (`seed-sources.ts`) for the 3 sources above, runnable now via `pnpm --filter @job-auto/worker ingest:run` (this becomes the BullMQ job body once the scheduler task below is built — same function, no rewrite). Verified live: pulled 614 real postings (203 GitLab/Greenhouse, 312 Palantir/Lever, 99 RemoteOK) into local Postgres; re-running found 0 new (dedup on `(source_id, external_id)` works) and re-seeding didn't duplicate `job_sources` rows; `crawl_runs` correctly logged found/new counts and timing for both runs.
- [ ] Structured preference filter (role/location/remote/salary) before any LLM call
- [ ] LLM scoring pass: match_score + reasoning against canonical_profile
- [ ] Fuzzy dedup pass (company + normalized title within date window) on top of hard unique constraint
- [ ] CV tailoring generation (per shortlisted job)
- [ ] Cover letter generation (conditional on job requiring one)
- [ ] Gmail OAuth connection flow (per user)
- [ ] Tier A apply: send application email via Gmail API from user's account
- [ ] Greenhouse Playwright adapter (Tier B)
- [ ] Lever Playwright adapter (Tier B)
- [ ] `runAgentForUser` orchestration wired end-to-end (§4 of ARCHITECTURE.md)
- [ ] BullMQ scheduler: per-user repeatable job at their configured `daily_run_time` (default provided)
- [ ] Daily digest email via Resend (applied jobs, scores, suggestions)
- [ ] `agent_runs` audit trail visible in UI

## Phase 3 — Money, clusters, offline mode

- [ ] Stripe or Paystack integration for wallet top-ups / subscription plans
- [ ] Cluster wallet debit logic (cluster balance checked before personal balance)
- [ ] Admin UI: full cluster management (create, add/remove members, view shared ledger)
- [ ] Offline CLI (`pnpm agent:run --user <email>`) calling `runAgentForUser` directly
- [ ] Ollama local-model provider wired into the AI abstraction, env-var switchable
- [ ] Admin "run now for this user" button (same code path as CLI/scheduler)

## Phase 4 — Coverage expansion + feedback loop

- [ ] Additional ATS adapters (Ashby, Workable, others as needed)
- [ ] Adapter health monitoring (alert on rising failure rate per adapter — catches silent form drift)
- [ ] Profile-improvement suggestion generation from low-scoring application patterns
- [ ] In-app UI for reviewing/accepting suggested profile additions
- [ ] Revisit Tier C (LinkedIn/Indeed) — explicit opt-in design, risk disclosure UI, conservative pacing — only if decided worth pursuing

---

## Decisions log

- 2026-09-22: LinkedIn/Indeed Easy Apply automation deferred (Tier C) due to ToS/account-ban risk. Build Tier A (email via Gmail OAuth) and Tier B (ATS portal automation) first.
- 2026-09-22: Drizzle chosen over Prisma for the DB layer (lighter runtime, more SQL control for dedup/queue logic).
- 2026-09-22: VPS sizing plan set — see ARCHITECTURE.md §10. Start at 4vCPU/8GB, scale to 8vCPU/16GB, split services beyond ~300 users.
- 2026-09-22: Monorepo scaffolded (pnpm workspace, Next.js web, NestJS worker, db/ai/types packages). AI provider abstraction implemented (`packages/ai`) supporting Anthropic and any OpenAI-compatible endpoint (Ollama) via `AI_PROVIDER`/`AI_MODEL`/`AI_BASE_URL` env vars — no code changes needed to switch. Full Drizzle schema for the data model in ARCHITECTURE.md §3 written in `packages/db/src/schema.ts`, not yet migrated to a running database.
- 2026-09-22: No Docker locally — local dev uses Postgres/Redis via DBngin directly. Docker is deploy-only. Deployment model set: the server never receives source code, only `deploy/docker-compose.yml` + `deploy/Caddyfile` + a Doppler/manual-SSH-provisioned `.env`. CI (`.github/workflows/deploy.yml`) builds `apps/web`/`apps/worker` into images, pushes to GHCR, rsyncs only the two config files to the server, then triggers a remote `docker compose pull && up -d`. See ARCHITECTURE.md §11.
- 2026-09-22: Auth uses Better Auth mapped onto our own `users` table (extended with `emailVerified`/`name`/`image`/`updatedAt`) rather than letting it own a separate table — keeps `role`/`clusterId` colocated with the rest of the user record. `passwordHash` was dropped from `users`; Better Auth stores credentials in its own `account` table instead.
- 2026-09-22: No paid AI subscription available yet — using Groq's free tier (OpenAI-compatible endpoint) as the working provider during development instead of Anthropic. Zero code changes needed since `packages/ai` already abstracts this; switch to `AI_PROVIDER=anthropic` whenever real budget exists. Added `packages/storage` (R2/S3-compatible client) following the same shared-package convention as `db`/`ai`/`types`.
- 2026-09-22: **Gotcha for future sessions:** `apps/worker`'s `tsconfig.json` uses `nodenext` module resolution (NestJS default), which requires explicit `.js` extensions on relative imports even in `.ts` source files (e.g. `from "./ingest.js"` not `"./ingest"`) — `apps/web` doesn't need this (Bundler resolution). Also: when adding `drizzle-orm` as a *direct* dependency to a new package/app, pin it to the exact version already used by `packages/db` (currently `0.44.7`) — a bare `pnpm add drizzle-orm` grabs latest and two different drizzle-orm versions in the dependency tree produce confusing "SQL<unknown> is not assignable to SQL<unknown>" type errors since each version's internal types are structurally distinct.
