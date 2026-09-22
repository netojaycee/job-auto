# Status

How to use this file: each task gets checked off `[x]` when actually done and verified (build passes / feature works), not when merely attempted. Keep "Current focus" pointed at the single next task so a new agent/session knows exactly where to pick up. Add dated notes under a phase when something meaningful changes (a decision, a blocker, a scope cut).

## Current focus

Nothing started yet. Next task: **Phase 1, Task 1 — scaffold the monorepo.**

---

## Phase 1 — Foundations: auth, profile, wallets (no billing yet), admin skeleton

- [ ] Scaffold monorepo structure (Next.js app, NestJS worker service, shared packages: `db`, `ai`, `types`)
- [ ] Postgres + Drizzle set up, initial migration for core tables (§3 of ARCHITECTURE.md)
- [ ] Docker Compose for local dev (Postgres, Redis)
- [ ] Auth (Better Auth) — signup/login, user role field
- [ ] Profile builder UI: CV upload (R2), parse to structured JSON via AI, linkedin/links fields, about-me textarea
- [ ] Canonical profile synthesis (AI call that produces `canonical_profile_text`)
- [ ] Clarifying-questions flow (AI asks 3-6 targeted questions post-CV-parse, answers merge into profile)
- [ ] Job preferences UI, AI-suggested defaults from CV, user-editable
- [ ] Wallet scaffolding: `wallets` + `wallet_ledger` tables, balance display in UI, admin grant endpoint (no real payment yet)
- [ ] Admin panel skeleton: list users, view/grant wallet balance, create cluster, add/remove cluster members
- [ ] AI provider abstraction (`packages/ai`) supporting Anthropic now, interface ready for Ollama swap

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
