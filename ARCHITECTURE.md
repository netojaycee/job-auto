# Architecture — Job Automation Platform

Living technical reference. Update this file whenever a real architectural decision changes — don't let it drift from the code. Task-level progress lives in `STATUS.md`, not here.

## 1. Product summary

Users create an account, build a profile from a CV + LinkedIn/portfolio links + free-text "about me", and set job preferences (AI-suggested from the CV, user-editable). A daily background agent (no user presence required):

1. Crawls/fetches jobs from legitimate sources matching preferences.
2. Scores each job against the user's canonical profile.
3. Skips anything already applied to (hard dedup).
4. Tailors a CV + cover letter per job.
5. Applies via the appropriate channel (email or ATS portal — see §5).
6. Logs everything, sends a daily digest, and surfaces profile-improvement suggestions.

LinkedIn/Indeed-style Easy Apply automation is **explicitly out of scope for now** (ToS/ban risk to the user's personal account) — see §5, Tier C. Build and ship Tier A + Tier B first.

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Web app | Next.js 15 (App Router) | Auth pages, dashboard, profile builder, admin panel |
| Worker/agent service | NestJS (separate deployable) | Crawling, scoring, tailoring, applying — long-running, queue-driven, isolated from the web app |
| DB | Postgres + Drizzle | Schema-as-code, migrations, raw SQL where needed for dedup/queue logic |
| Queue | BullMQ (Redis) | Daily fan-out, per-user apply jobs, retries, per-source rate limiting |
| AI | Anthropic API — Haiku 4.5 for high-volume/cheap tasks (parsing, scoring), Sonnet for CV tailoring/cover letters. Local fallback via Ollama (see §8) for offline mode. | Provider swap must go through one interface — never call the Anthropic SDK directly from business logic |
| File storage | Cloudflare R2 | CVs, tailored CVs, generated cover letters |
| Email (notifications only) | Resend | Digest emails, alerts. **Never used to send applications** — see §5 |
| Email (applications) | Gmail API via OAuth (per user) | Applications sent from the user's real inbox, in their Sent folder, replies come to them |
| Browser automation | Playwright | ATS portals without usable form APIs |
| Auth | Better Auth (self-hosted) | Full control needed over roles (user/admin), wallets, clusters |
| Payments | Stripe or Paystack (decide based on user geography) | Wallet top-ups / subscriptions |
| Deployment | Docker Compose on a single VPS initially | See §9 for sizing |

## 3. Data model (core tables)

- `users` — auth, role (`user` | `admin`), `cluster_id` nullable
- `clusters` — name, owner_admin_id
- `cluster_members` — user_id ↔ cluster_id
- `wallets` — owner_type (`user`|`cluster`), owner_id, balance, currency of account
- `wallet_ledger` — wallet_id, delta, reason, ref (application_id / purchase_id / admin_grant), created_at
- `profiles` — user_id, raw_cv_file_ref (R2 key), parsed_cv_json, linkedin_url, other_links[], about_me_text, canonical_profile_text (AI-synthesized), canonical_profile_updated_at
- `job_preferences` — user_id, roles[], locations[], remote_pref, salary_floor, industries[], excluded_companies[], excluded_keywords[], daily_run_time (default provided), max_applications_per_day
- `job_sources` — id, name, type (`api`|`feed`|`html`), base_url, adapter_key, enabled, robots_notes
- `job_postings` — source_id, external_id, url, title, company, location, description, content_hash, posted_at, first_seen_at — unique on (source_id, external_id)
- `applications` — user_id, job_posting_id, status (`shortlisted`|`tailoring`|`applied`|`failed`|`skipped_dedup`), method (`email`|`ats_portal`), applied_at, tailored_cv_ref, cover_letter_ref, match_score, match_reasoning — **unique on (user_id, job_posting_id)**
- `application_channels` — user_id, provider (`gmail`), oauth_tokens (encrypted), connected_at
- `profile_feedback` — user_id, generated_at, suggestion_text, source_application_ids[]
- `agent_runs` — user_id, started_at, finished_at, status, jobs_seen, jobs_shortlisted, jobs_applied, tokens_spent, error_summary
- `crawl_runs` — source_id, started_at, finished_at, postings_found, postings_new

Dedup strategy: hard unique key on `(user_id, job_posting_id)`, plus a fuzzy pass at shortlist time (same company + near-identical normalized title within a ~14-day window) to catch reposts across different source IDs.

## 4. Agent pipeline (per user, scheduled)

```
runAgentForUser(userId):
  1. load profile + preferences + wallet balance
  2. if wallet balance < min threshold -> log + notify, stop
  3. fetch candidate postings (structured filter: role/location/remote/salary) — no LLM yet
  4. dedup against applications table + fuzzy match
  5. LLM score remaining candidates vs canonical_profile -> match_score + reasoning
  6. keep top N by score above threshold (N capped by preferences.max_applications_per_day AND wallet balance)
  7. for each: tailor CV, draft cover letter if required, debit wallet
  8. apply via channel adapter (Tier A/B — see §5)
  9. write application record, agent_run stats
  10. after run: generate profile_feedback from low-scoring gaps
  11. send digest email via Resend
```

This function is the single entry point used by (a) the BullMQ scheduler, (b) the admin "run now" button, and (c) the offline CLI (§8). Never duplicate this logic.

## 5. Application channels

**Tier A — Email applications (build first).**
User connects Gmail via OAuth (`gmail.send` scope). Worker sends through the Gmail API using the user's own token — no SMTP credentials stored, mail lives in their Sent folder, replies land in their inbox. This is the MVP channel and should cover a meaningful share of postings that list a direct application email.

**Tier B — Structured ATS portals (build second).**
Greenhouse, Lever, Ashby, Workable expose stable form structures (and some semi-public job JSON endpoints for sourcing). Build one Playwright adapter per ATS: fill name/email/phone/resume upload/cover letter/short-answer questions (LLM answers from canonical profile). Budget for adapter maintenance — these forms change.

**Tier C — LinkedIn/Indeed Easy Apply (deferred).**
Out of scope for now per explicit decision. ToS prohibits automated Easy Apply; risk is the user's personal account getting banned, not just ours. If revisited later: opt-in only, explicit risk disclosure, conservative human-like pacing, never default-on.

**Sourcing jobs:** prefer official/public feeds first — Greenhouse/Lever/Ashby public job JSON endpoints, RemoteOK/WeWorkRemotely/Wellfound feeds — before falling back to HTML scraping of public listing pages. Respect robots.txt and rate limits per source; a source getting the crawler blocked is a bug, treat it as one.

## 6. Token / wallet / cluster model

- Every AI-metered action (parse, score, tailor, cover letter) costs internal **credits**, not raw LLM tokens — lets pricing change without breaking user-facing numbers.
- `wallets` can belong to a user or a cluster. `cluster_members` links accounts an admin has grouped; application debits check the cluster wallet first if the user belongs to one, else the personal wallet.
- Admin panel: grant credits to any account/cluster, create/manage clusters, add/remove members, view ledger.
- Non-cluster ("stranger") accounts: must purchase credits or subscribe. No free tier beyond an initial trial grant, to prevent cheating shared resources.
- Daily application volume is naturally capped by both `preferences.max_applications_per_day` and wallet balance.

## 7. AI's role beyond applying

- Every application gets a stored **match score + reasoning** (not just an internal filter — surfaced to the user).
- After each run, an **improvement-suggestion pass** diffs low-scoring rejections against the canonical profile and proposes concrete, specific additions (skills, certs, portfolio pieces). Suggestions are surfaced in-app for the user to accept into their profile — never auto-applied.
- Tailoring must **reframe and reorder real experience only** — never fabricate skills or history. This is both a legal exposure (CV fraud) and a trust issue; enforce it in the tailoring prompt and spot-check.

## 8. Offline / local mode

- A CLI (`pnpm agent:run --user <email>`) that calls the exact same `runAgentForUser` used by the scheduler.
- LLM provider is behind one interface (`packages/ai/provider.ts`-style abstraction) supporting Anthropic **or** an OpenAI-compatible local endpoint. Switch via env var, not code change.
- **Local Ollama setup (for when there's no API budget):**
  1. Install: `brew install ollama`
  2. Start the daemon: `ollama serve` (or it auto-starts as a background service on macOS)
  3. Pull a model: `ollama pull qwen2.5:14b` (good balance of quality/speed on a laptop) or `ollama pull llama3.1:8b` for a lighter footprint
  4. Ollama exposes an OpenAI-compatible endpoint at `http://localhost:11434/v1` — point the worker's `AI_PROVIDER=ollama`, `AI_BASE_URL=http://localhost:11434/v1`, `AI_MODEL=qwen2.5:14b`
  5. Quality will be a notch below Claude for tailoring/cover letters — acceptable for occasional manual runs, not for daily production use at scale.
- This mode is also what backs the admin "run now for this user" button — same mechanism.

## 9. VPS sizing

Design assumption for v1: tens to low hundreds of active users, Tier A + Tier B only (Tier C deferred, so no heavy LinkedIn browser farms yet).

| Stage | Spec | Notes |
|---|---|---|
| **Launch** (up to ~50 active users) | 4 vCPU / 8GB RAM / 80GB SSD (e.g. Hetzner CPX31 or equivalent DO droplet) | Postgres + Redis + Next.js + NestJS worker + Playwright all on one box via Docker Compose. Cap Playwright worker concurrency to 2 (BullMQ concurrency setting) — each headless Chromium context costs ~300-500MB RAM under load |
| **Growth** (~50-300 active users) | 8 vCPU / 16GB RAM / 160GB SSD | Raise Playwright concurrency to 4-6. Consider moving Postgres to a managed instance (Neon/Supabase/managed Postgres) so worker restarts/deploys don't risk DB uptime |
| **Scale** (300+) | Split services: dedicated Playwright worker box(es), managed Postgres, managed Redis | At this point also revisit whether Tier C is worth the risk/engineering cost |

Disk stays light because CVs/cover letters/tailored docs live in R2, not local disk — local disk is mostly Postgres data, logs, and Playwright's browser binaries/cache.

Rule of thumb for concurrency: `max_concurrent_playwright_jobs ≈ (available_RAM_GB - 2GB_for_app_stack) / 0.5GB`.

## 11. Deployment model

**The server never receives the source code.** The only things that ever reach the VPS are:

- `deploy/docker-compose.yml` — the production stack definition
- `deploy/Caddyfile` — reverse proxy + automatic HTTPS for the subdomain
- a server-side `.env` — provisioned via Doppler (or an equivalent free secrets manager) or created by hand over SSH; CI never generates or transmits it

Everything else — the actual `web` and `worker` code — ships as **prebuilt Docker images**, built by CI from the repo and pushed to a registry (GHCR is the default: free with GitHub, no extra account needed). The server's compose file references images by tag and pulls, it never builds from source.

**Pipeline:**
1. On push to `main`: CI checks out the repo, builds `apps/web/Dockerfile` and `apps/worker/Dockerfile`, tags images with the git SHA, pushes both to the registry.
2. Deploy step: CI syncs **only** `deploy/docker-compose.yml` and `deploy/Caddyfile` to the server (scp/rsync over SSH), sets `IMAGE_TAG` to the new SHA, then runs `docker compose --env-file .env pull && docker compose --env-file .env up -d` over SSH.
3. The server's `.env` is a standing file that predates any given deploy — CI reads nothing from it and writes nothing to it. Rotate/update it out-of-band (Doppler sync or manual SSH edit) whenever a secret changes.

**Local dev is intentionally decoupled from all of this** — no Docker needed locally. Point the root `.env` at whatever Postgres/Redis you already have running (e.g. via DBngin) and run `pnpm dev:web` / `pnpm dev:worker` directly. `deploy/docker-compose.yml` is never invoked locally; it's a deploy-only artifact, hence living under `deploy/` rather than the repo root.

Before first deploy: replace the placeholder domain in `deploy/Caddyfile`, and provision `REGISTRY`, `POSTGRES_PASSWORD`, and every API key in the server's `.env` (see `deploy/.env.example` for the full list — that file documents the shape, it is not itself deployed).

## 12. Non-negotiables (revisit only with explicit discussion)

- LinkedIn/Indeed Easy Apply automation stays off by default; Tier C is deferred, not cancelled.
- Applications are sent from the user's own inbox (Gmail OAuth), never from a platform email address.
- Tailoring never fabricates experience.
- Dedup is enforced at the DB constraint level, not just application logic.
- One AI-provider interface, swappable between Anthropic and local Ollama without touching call sites.
- The server never receives application source code — only `deploy/docker-compose.yml`, `deploy/Caddyfile`, and a hand/Doppler-provisioned `.env`. CI/CD ships images and config, nothing else.
