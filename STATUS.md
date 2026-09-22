# Status

How to use this file: each task gets checked off `[x]` when actually done and verified (build passes / feature works), not when merely attempted. Keep "Current focus" pointed at the single next task so a new agent/session knows exactly where to pick up. Add dated notes under a phase when something meaningful changes (a decision, a blocker, a scope cut).

## Current focus

Profile builder (CV upload → parse → canonical profile) is working end-to-end against real services (Groq + R2 + local Postgres). Next task: **clarifying-questions flow (AI asks 3-6 targeted questions post-CV-parse) and job preferences UI with AI-suggested defaults from the parsed CV.**

---

## Phase 1 — Foundations: auth, profile, wallets (no billing yet), admin skeleton

- [x] Scaffold monorepo structure (Next.js app, NestJS worker service, shared packages: `db`, `ai`, `types`) — 2026-09-22. pnpm workspace at repo root; `apps/web` (Next.js 16, App Router, Tailwind), `apps/worker` (NestJS 12); `packages/db`, `packages/ai`, `packages/types` linked via `workspace:*`. Web + worker both build clean.
- [x] Postgres + Drizzle set up, initial migration for core tables (§3 of ARCHITECTURE.md) — 2026-09-22. 17 tables migrated to local Postgres (14 domain tables + Better Auth's `users`/`session`/`account`/`verification`, since `users` does double duty — see below).
- [x] Local dev DB/Redis — 2026-09-22. No Docker locally; `.env` points at Postgres/Redis run via DBngin. Root `docker-compose.yml` removed — Docker is deploy-only now, see `deploy/`.
- [x] Deployment pipeline scaffolded — 2026-09-22. `deploy/docker-compose.yml` (postgres, redis, web, worker, caddy — pulls prebuilt images, never builds from source), `deploy/Caddyfile` (placeholder domain, needs real subdomain before first deploy), `deploy/.env.example`, `apps/web/Dockerfile` + `apps/worker/Dockerfile`, `.github/workflows/deploy.yml` (builds+pushes images to GHCR, rsyncs only compose+Caddyfile to the server, remote `docker compose pull && up -d` over SSH). Server `.env` is provisioned separately (Doppler or manual SSH), CI never touches it. Full model: ARCHITECTURE.md §11. Not yet run against a real server — needs `SSH_HOST`/`SSH_USER`/`SSH_KEY`/`DEPLOY_PATH` repo secrets and a provisioned VPS.
- [x] Auth (Better Auth) — signup/login, user role field — 2026-09-22. `apps/web/src/lib/auth.ts` (server config, Drizzle adapter mapped onto our own `users`/`session`/`account`/`verification` tables rather than Better Auth's defaults — `users` carries `role`/`clusterId` as `additionalFields`, exposed read-only via `input: false`), `apps/web/src/app/api/auth/[...all]/route.ts` (handler), `apps/web/src/lib/auth-client.ts` (client), minimal `/signup`, `/login`, `/dashboard` pages. Verified live against local Postgres: signup, login, and get-session all return 200 with correct `role`/`clusterId` on the user object. Note: `advanced.database.generateId: false` is required since our tables use Postgres `defaultRandom()` uuids, not Better Auth's default nanoid strings — don't remove it.
- [x] Profile builder UI: CV upload (R2), parse to structured JSON via AI, linkedin/links fields, about-me textarea — 2026-09-22. `/profile` page; `POST /api/profile/cv` (upload → R2 via `packages/storage` → `pdf-parse`/`mammoth` text extraction → AI parse to `ParsedCv` JSON); `GET/POST /api/profile` (links + about-me, triggers resynthesis). Verified live: uploaded a real .docx CV, got back correctly structured skills/experience/education/suggestedRoles, and a coherent canonical profile narrative that correctly incorporated later about-me edits on resave.
- [x] Canonical profile synthesis (AI call that produces `canonical_profile_text`) — 2026-09-22. `apps/web/src/lib/profile-ai.ts::synthesizeCanonicalProfile`, re-run on both CV upload and profile save.
- [ ] Clarifying-questions flow (AI asks 3-6 targeted questions post-CV-parse, answers merge into profile)
- [ ] Job preferences UI, AI-suggested defaults from CV, user-editable
- [ ] Wallet scaffolding: `wallets` + `wallet_ledger` tables, balance display in UI, admin grant endpoint (no real payment yet)
- [ ] Admin panel skeleton: list users, view/grant wallet balance, create cluster, add/remove cluster members
- [x] AI provider abstraction (`packages/ai`) supporting Anthropic now, interface ready for Ollama swap — 2026-09-22. Also verified live against Groq's free OpenAI-compatible endpoint (`AI_PROVIDER=openai`, `AI_BASE_URL=https://api.groq.com/openai/v1`, `AI_MODEL=openai/gpt-oss-120b`) — this is what the profile builder testing above actually ran against. Note: Groq's model catalog changes; if a model 404s, check `GET https://api.groq.com/openai/v1/models`.

## Phase 2 — The actual agent: Tier A + Tier B + scheduling

- [ ] Job source adapters: at least 2-3 of (Greenhouse public JSON, Lever public JSON, RemoteOK/WeWorkRemotely feed) — structured sourcing, no scraping yet
- [ ] `job_postings` ingestion + crawl_runs logging + content-hash dedup on ingest
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
- 2026-09-22: VPS sizing plan set — see ARCHITECTURE.md §9. Start at 4vCPU/8GB, scale to 8vCPU/16GB, split services beyond ~300 users.
- 2026-09-22: Monorepo scaffolded (pnpm workspace, Next.js web, NestJS worker, db/ai/types packages). AI provider abstraction implemented (`packages/ai`) supporting Anthropic and any OpenAI-compatible endpoint (Ollama) via `AI_PROVIDER`/`AI_MODEL`/`AI_BASE_URL` env vars — no code changes needed to switch. Full Drizzle schema for the data model in ARCHITECTURE.md §3 written in `packages/db/src/schema.ts`, not yet migrated to a running database.
- 2026-09-22: No Docker locally — local dev uses Postgres/Redis via DBngin directly. Docker is deploy-only. Deployment model set: the server never receives source code, only `deploy/docker-compose.yml` + `deploy/Caddyfile` + a Doppler/manual-SSH-provisioned `.env`. CI (`.github/workflows/deploy.yml`) builds `apps/web`/`apps/worker` into images, pushes to GHCR, rsyncs only the two config files to the server, then triggers a remote `docker compose pull && up -d`. See ARCHITECTURE.md §11.
- 2026-09-22: Auth uses Better Auth mapped onto our own `users` table (extended with `emailVerified`/`name`/`image`/`updatedAt`) rather than letting it own a separate table — keeps `role`/`clusterId` colocated with the rest of the user record. `passwordHash` was dropped from `users`; Better Auth stores credentials in its own `account` table instead.
- 2026-09-22: No paid AI subscription available yet — using Groq's free tier (OpenAI-compatible endpoint) as the working provider during development instead of Anthropic. Zero code changes needed since `packages/ai` already abstracts this; switch to `AI_PROVIDER=anthropic` whenever real budget exists. Added `packages/storage` (R2/S3-compatible client) following the same shared-package convention as `db`/`ai`/`types`.
