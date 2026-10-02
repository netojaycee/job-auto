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
| AI | Anthropic API (target for prod) — Haiku 4.5 for high-volume/cheap tasks (parsing, scoring), Sonnet for CV tailoring/cover letters. **Currently developing against Groq's free tier** (no paid subscription yet — see §8.1). Local fallback via Ollama (see §8) for offline mode. | Provider swap must go through one interface — never call the Anthropic SDK/any provider SDK directly from business logic |
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
- `job_postings` — source_id, external_id, url, title, company, location, description, content_hash, application_email (nullable — set for manually-pasted or rare crawled postings that list a direct apply-by-email address), posted_at, first_seen_at — unique on (source_id, external_id)
- `applications` — user_id, job_posting_id, status (`shortlisted`|`tailoring`|`applied`|`failed`|`skipped_dedup`), method (`email`|`ats_portal`), applied_at, tailored_cv_ref, cover_letter_ref, match_score, match_reasoning — **unique on (user_id, job_posting_id)**
- `application_channels` — user_id, provider (`gmail`), oauth_tokens (encrypted), connected_at
- `profile_feedback` — user_id, generated_at, suggestion_text, source_application_ids[]
- `agent_runs` — user_id, started_at, finished_at, status, jobs_seen, jobs_shortlisted, jobs_applied, tokens_spent, error_summary
- `crawl_runs` — source_id, started_at, finished_at, postings_found, postings_new
- `speculative_applications` — user_id, lead_id (nullable — null for a user-submitted cold email, set for a funding-lead-sourced one), company_name/contact_email/context (populated directly when lead_id is null), status, match_score, match_reasoning, tailored_cv_ref, cover_letter_ref, applied_at — see §13/§15

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
User connects Gmail via OAuth (`gmail.send` scope, `/api/gmail/connect` linked from a "Connect Gmail" card on `/profile`). Worker sends through the Gmail API using the user's own token — no SMTP credentials stored, mail lives in their Sent folder, replies land in their inbox. This is the MVP channel — in practice, it's driven almost entirely by the manual-intake path (§15), not the crawl/score pipeline: of 686 real crawled postings across 4 sources, only 7 listed any application email at all, and none were engineering roles (see §15). Real Tier A volume today comes from postings the user finds and pastes in themselves.

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
- `tailorCv`'s prompt also forbids leaving placeholder/bracketed text (e.g. `[LinkedIn / GitHub – optional]`) for missing contact details — found live when a generated CV left that exact placeholder in; omit the line entirely if the source data doesn't have it.
- Both cover-letter generators (`generateCoverLetter`, `generateSpeculativeCoverLetter`) are instructed to sign off with name (+ city) only, never an invented email or phone number — found live when a real cold-email draft invented a plausible-looking but fake email/phone in the signature. This is the same underlying gap noted in §13/Phase 5: cover letters aren't run through `verifyNoFabrication` the way CVs are, so this class of mistake has to be caught by prompt instruction, not an independent audit — worth watching for recurrence.
- `speculativeJobContext`/`generateSpeculativeCoverLetter` only reference funding news as the reason for outreach when `fundingAmount` is actually set — found live when a manually-submitted cold-email target (no funding angle at all) got a draft that would have opened with a false "congrats on your funding" hook, inherited from code originally written only for the funding-lead pipeline (§13).

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

## 9. Free-tier cloud options (pre-launch development)

No paid AI subscription yet, so development currently runs against **Groq's free tier** — a real cloud model, OpenAI-compatible API, zero cost. Works with `packages/ai`'s existing `openai`-provider path, no code changes:

```
AI_PROVIDER=openai
AI_MODEL=openai/gpt-oss-120b
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=<groq key>
```

Groq's free-tier model catalog changes over time — if a model 404s, check `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $AI_API_KEY"` for what's currently available.

**Gemini** is the other viable free-tier option (Google AI Studio issues free API keys with a generous daily quota) and also exposes an OpenAI-compatible endpoint, so it drops into the same `AI_PROVIDER=openai` path:

```
AI_PROVIDER=openai
AI_MODEL=gemini-2.5-flash
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
AI_API_KEY=<gemini key>
```

**Before going live**, revisit the model choice deliberately rather than defaulting to whatever free tier was used during development — see the cost-tiering note below and confirm the final pick against then-current pricing/quality for both scoring (cheap, high-volume) and tailoring (fewer calls, higher quality bar, goes directly to employers).

Rough cost tiering once on a paid provider, for the two-call-tier design in §2 (cheap model for scoring, better model for tailoring):

| Tier | Candidates | Use |
|---|---|---|
| Cheap/high-volume | Gemini Flash, Claude Haiku 4.5 | CV parsing, per-job match scoring (called for every candidate job, every user, every day) |
| Higher-quality/low-volume | Claude Sonnet 5 | CV tailoring, cover letters (called only for shortlisted jobs, output goes directly to an employer) |

## 10. VPS sizing

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
- Tailoring never fabricates experience — enforced by a second AI call (`verifyNoFabrication`) that audits the tailored CV against the source data and fails closed (refuses to produce the CV) if it finds invented content, not just a prompt instruction. This was added after a real failure during development: a free-tier model invented an entire "Selected Projects" section with fabricated metrics despite being told not to. Do not remove the audit step and rely on the generation prompt alone.
- The actual send/submit step (Gmail email, ATS portal form) defaults to **dry run** — everything through CV/cover-letter tailoring runs automatically, but contacting a real employer requires `AGENT_ALLOW_REAL_APPLY=true` to be explicitly set, and even then no channel is auto-dispatched (see `apps/worker/src/agent/run-agent-for-user.ts`). This exists because the apply step has a real-world side effect on a third party that every earlier step (crawling, scoring, tailoring) does not — treat enabling it as a deliberate decision, not a config toggle to flip during testing.
- Dedup is enforced at the DB constraint level, not just application logic.
- One AI-provider interface, swappable between Anthropic and local Ollama without touching call sites.
- The server never receives application source code — only `deploy/docker-compose.yml`, `deploy/Caddyfile`, and a hand/Doppler-provisioned `.env`. CI/CD ships images and config, nothing else.

## 13. Speculative outreach to recently-funded companies

A second, distinct lead pipeline alongside job-board applications: instead of a posted opening, the source is a funding-news article, and the "contact" is a guessed email address rather than a confirmed application channel. This is meaningfully higher-risk than replying to a real job posting — there is no confirmed opening, and the recipient address is a guess — so it gets its own set of constraints, not just a variant of Tier A/B:

**Data sources (free scraping, by explicit choice over paid APIs like Crunchbase):**
- US: `https://techcrunch.com/tag/funding/feed/`
- Europe: `https://tech.eu/feed/`
- Nigeria/Africa: `https://techcabal.com/tag/funding/feed/`

All three are plain RSS feeds, parsed with a small regex-based parser (`apps/worker/src/leads/rss.ts`) rather than a full XML library dependency. Fetch/ingest (`ingest.ts`) has no AI involvement and is pure dedup-on-URL — cheap and safe to run frequently. Extraction into a structured lead (`extract.ts`) is a real AI call per article: it identifies whether an article is actually reporting a specific company's funding round (filtering out digests, retrospectives, and aggregate-stats pieces), and — this matters — identifies the company that *received* funding, not an investor named in the headline (e.g. "Terra Industries leads a $1m round in Aeon" → the lead is Aeon, not Terra Industries). Verified live: 38 real, correctly-filtered leads from 50 articles across all three regions, with plausible company/domain data (including cases where the model's own knowledge produced the *correct* real domain, not just a slugified guess).

**Contact discovery (pattern-guessing, by explicit choice over a paid verification service):** `apps/worker/src/leads/email-guess.ts` tries `careers@`, `jobs@`, `talent@`, `hr@`, `hello@`, `contact@`, `info@` against the company's domain, in that priority order, with no delivery verification. This has an inherently low and unmeasured hit rate — some guesses will bounce or go unread. All candidates are kept on the lead record, not just the top pick, so a human review step or a future verification integration can improve on this later. The same module now also resolves a domain from just a company name (`resolveCompanyDomain` — asks the AI for its best guess, falling back to a slugify heuristic) for the manual cold-email flow (§15), so a user doesn't need to already know the company's domain, let alone its email. Every guessed address — lead-sourced or manual — is flagged `contactEmailGuessed`/shown as "guessed, not verified" in the UI; this is never elevated to "confirmed" anywhere in the product.

**Scoring, tailoring, and sending** (`apps/worker/src/leads/{score,prepare,send,orchestrate}.ts`): `scoreLeadAgainstProfile` judges general fit (sector/stage/skills) since there's no posting to match line-by-line. `prepareSpeculativeApplication` reuses `tailorCvVerified` (lifted out of `apply/prepare.ts` into `apply/tailor.ts` so job-board and speculative pipelines share one fabrication-audited implementation) against a synthesized "no specific JD" job context, plus a dedicated `generateSpeculativeCoverLetter` written as cold outreach — references the funding news, asks whether the company is hiring, rather than replying to a job ad's requirements. `speculative_applications` rows move `shortlisted` → `tailoring` → (if sent) `applied`, same enum as `applications`.

**Sending gets a stricter, additional gate.** `sendSpeculativeOutreach` reuses `apply/gmail-send.ts` unchanged but requires **both** `AGENT_ALLOW_REAL_APPLY=true` *and* `AGENT_ALLOW_SPECULATIVE_SEND=true` — the guessed-recipient risk noted above means turning on general real-apply must not silently also start emailing pattern-guessed addresses. `runOutreachForUser` (`apps/worker/src/leads/orchestrate.ts`) mirrors `runAgentForUser`'s shape (score → shortlist → wallet-gated prepare → gated send) but is deliberately its own function and CLI (`pnpm --filter @job-auto/worker outreach:run <email>`), not folded into the job-board agent run, and caps outreach at a fixed 5/run independent of `job_preferences.maxApplicationsPerDay` so it doesn't inherit job-board volume tuning for a different-risk channel.

**Known gap, not yet fixed:** `verifyNoFabrication` only ever audits the tailored *CV*, never the cover letter, on both this pipeline and the original job-board one — live testing of the new speculative cover-letter generator produced a plausible but invented placeholder phone/email in the signature. Worth closing (extend the audit, or drop placeholder contact lines from the prompt) before either pipeline's cover letters reach a real employer.

## 14. UI/design system (`apps/web`)

- **Components**: shadcn/ui, `base-nova` preset — built on **Base UI** (`@base-ui/react`), not Radix. This matters for a few APIs that differ from typical shadcn docs/examples: `render={<Element />}` replaces `asChild` for polymorphic rendering (e.g. a `Button` that's actually a `next/link` `<Link>`), and `nativeButton` controls whether Base UI expects the render target to be a real `<button>` — our `Button` wrapper (`src/components/ui/button.tsx`) defaults `nativeButton` to `!render` so this is usually automatic, but don't hardcode `nativeButton={false}` on a `Button` that has no `render` prop of its own (a real bug hit during development: it broke the mobile nav trigger and the user-menu trigger, both of which render as plain `<button>`s).
- **Forms**: react-hook-form + zod (`@hookform/resolvers/zod`). Schemas live in `src/lib/validation/*.ts`, one file per domain, exporting both the schema and its inferred type. For a field that needs numeric validation but is edited as free text (e.g. `maxApplicationsPerDay`), keep it a `string` in the form and convert on submit — `z.coerce.number()` produces an input/output type mismatch against RHF's resolver typing in zod v4 that isn't worth fighting.
- **Non-native inputs with RHF**: Base UI's `Select` (and similar) aren't native form elements, so wire them with `Controller`, not `register()`. `SelectValue` renders the raw `value` as text by default — pass a `children` render function (`(value) => label`) when the value isn't already human-readable (a real bug: a cluster-assignment dropdown showed the literal sentinel `"__none__"` until fixed this way).
- **Server state**: TanStack Query. Query/mutation hooks live in `src/lib/queries/*.ts`, one file per domain (`wallet.ts`, `profile.ts`, `preferences.ts`, `runs.ts`, `admin.ts`) — a route's page component calls these hooks, never `fetch` directly. Mutations invalidate the relevant query key(s) on success rather than manually patching cached state.
- **Client UI state**: Zustand (`src/stores/*.ts`) — currently just `ui-store.ts` for the mobile nav open/closed flag. Reserve this for state that's genuinely UI-local and shared across components that aren't in a direct parent/child relationship; anything server-backed goes through TanStack Query instead.
- **Route protection**: `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`, exported function is `proxy` not `middleware` — this is a real, confirmed rename in this Next version's own docs, not a project-specific convention). Redirects signed-out users away from protected prefixes and signed-in users away from `/login`/`/signup`. This is the fast first line, not the only one — every protected page still lives under `src/app/(app)/layout.tsx`, a server component that calls `requireSession()` (in `src/lib/session.ts`) as defense-in-depth, and the `/admin` page additionally checks `role === "admin"` itself (both client-side for UI and server-side in every `/api/admin/*` route).
- **AI-backed API routes must catch their own AI-layer exceptions.** A route that calls into `profile-ai.ts` (CV parsing, preference suggestions, profile synthesis) without wrapping the call in try/catch lets an AI JSON-parse failure become an unhandled 500 that returns an HTML error page — the client's `res.json()` then throws a confusing, misattributed "Unexpected end of JSON input" instead of the real error. This was a real bug hit and fixed during development (`/api/preferences/suggest` and others now catch and return a proper `{ error }` JSON body). Any new AI-backed route should follow the same pattern.
- **Branding**: `src/app/icon.svg` (static favicon), `apple-icon.tsx` + `opengraph-image.tsx` (dynamic, via `next/og`'s `ImageResponse`) all share one inline SVG mark (`src/components/brand/logo-mark.tsx`). Brand color tokens (`--brand`, `--brand-soft`, `--success`, plus the indigo-shifted `--primary`/`--ring`/etc.) are defined in `globals.css` alongside the rest of shadcn's CSS-variable theme — see that file for the full palette rather than duplicating values here.
- **Layout**: `src/app/(app)/` route group holds every authenticated page (dashboard, profile, preferences, runs, admin) under one shared shell (`src/components/app/app-shell.tsx` — desktop sidebar, mobile sheet-based nav, wallet balance badge, user menu). `src/app/page.tsx` (marketing landing page), `/login`, `/signup` sit outside that group with their own layouts.
- **PDF parsing needs `serverExternalPackages`.** `pdf-parse` (via `pdfjs-dist`) resolves its worker script relative to its own module file at runtime; Turbopack's dev bundler rewrites that into a hashed chunk path that doesn't exist on disk, breaking every PDF upload with "Setting up fake worker failed" — a real bug that shipped unnoticed because only `.docx` had ever been tested live. Fixed via `serverExternalPackages: ["pdf-parse", "pdfjs-dist"]` in `next.config.ts`, which excludes them from bundling and leaves Node's native module resolution (which pdfjs already handles correctly) in place. If a future package hits the same "worker/native module can't resolve under Turbopack" class of error, try this before anything more custom.
- **Two separate `.env` files exist in local dev, not one.** `apps/web/.env.local` and the monorepo-root `.env` are independent — Next.js never reads the root file. A value added only to root `.env` (e.g. new OAuth credentials) silently won't reach `apps/web` until it's also added to `apps/web/.env.local` and the dev server restarted. `apps/worker`'s CLI scripts, by contrast, read the root `.env` via `dotenv.config()`. Keep this asymmetry in mind when adding new secrets locally.

## 15. Manual job/cold-email intake (`apps/worker/src/apply/manual-intake.ts`, `apps/worker/src/leads/manual-outreach.ts`)

A parallel entry point into the same tailoring/audit/send machinery as the crawl/score pipeline, for postings the user finds themselves (or a cold-outreach target they pick) rather than one job-auto crawled. Added after live testing showed the crawl/score pipeline currently yields ~zero real Tier A candidates (§5) — most people apply to jobs found manually anyway, so this has value beyond testing.

- **Job listing**: user pastes raw text (+ optionally the application email, if they know it and the listing didn't already say). `parseManualJobPosting` (one AI call) extracts `{title, company, description, applicationEmail}` — `applicationEmail` is only ever populated from an explicit statement in the listing (or the user's override), never guessed. The posting is inserted into `job_postings` under a lazily-created `job_sources` row (`adapter_key: "manual"`), then flows through the same `tailorCvVerified` used everywhere else — except a cover letter is **always** generated here (not gated by the `needsCoverLetter` heuristic), since for the email channel it doubles as the message body. If there's an application email and `AGENT_ALLOW_REAL_APPLY=true`, it sends for real via `apply/gmail-send.ts` and the application goes straight to `applied`; otherwise it stops at `tailoring` — ready for the user to submit themselves. There is deliberately no generic auto-submit for portal-only listings; see the decisions log for why that's a hard boundary, not a TODO.
- **Cold email**: user submits `{companyName, contactEmail?, website?, context}` directly — `contactEmail` is optional: check "find one for me" in the UI and `submitManualOutreach` calls `resolveCompanyEmail` (§13) to guess one instead, storing the resolved address plus the full ranked candidate list (`speculative_applications.emailCandidates`) and a `contactEmailGuessed` flag. Reuses the funding-lead speculative-outreach pipeline (§13) unchanged otherwise — `prepareSpeculativeApplication`/`sendSpeculativeOutreach` branch on whether `speculative_applications.leadId` is set (funding-lead-sourced, joins `funding_leads`) or null (manual, reads `companyName`/`contactEmail`/`context` off the row directly). Same dual-gate (`AGENT_ALLOW_REAL_APPLY` **and** `AGENT_ALLOW_SPECULATIVE_SEND`) as any other cold outreach.
- **Both are queue-driven**, not synchronous API calls: `/api/jobs/manual` and `/api/outreach/manual` just enqueue (`packages/queue`'s `manual-applies`/`manual-outreach` queues) and return immediately; the scheduler daemon's BullMQ workers (wired in `apps/worker/src/scheduler/daemon.ts` alongside the existing agent-run worker) do the actual tailoring/sending. Both accept arrays for bulk submission — the web UI (`/apply/manual`, a two-tab page with `useFieldArray`-based repeatable rows) lets a user queue several at once, each processed independently with the same per-item wallet/fabrication guards as everything else.
- **Verified live, including one real send**: with `AGENT_ALLOW_REAL_APPLY=true` and the application email set to the real user's own Gmail `+alias` (safe by construction — no third party contacted), a pasted listing was tailored, audited, and actually sent via the Gmail API; `applications.status` correctly reached `applied` with `method: 'email'`. The flag was turned back off immediately after — this was a deliberate one-off test, not a standing configuration change.
- **First real send to an actual researched company** (2026-09-28): before pitching, the target company's own site was researched (web search) rather than guessing — this surfaced a better real contact channel than the pattern-guessed `careers@` address, and grounded the cold email's `context` field in real, specific detail instead of a generic template. The draft was reviewed with the user before sending (their explicit ask), which caught two real defects before they went to a real company — see §7 and the decisions log.

## 16. CV rendering (`apps/worker/src/apply/pdf.ts`)

Tailored CVs are generated as markdown-ish text (§7) but must go out as a real document, not a raw `.txt` attachment — `renderCvPdf` converts that text to styled HTML (clean resume typography: serif headers with an underline rule, sans-serif body, bullets) and prints it to PDF via Playwright's `page.pdf()`. This reuses Playwright rather than adding a second PDF-rendering dependency — it's already a worker dependency for Tier B portal automation, and the worker's Docker image (`mcr.microsoft.com/playwright:*-jammy`) already ships Chromium, so this needed no deployment changes. `marked` converts the markdown to HTML first, with `breaks: true` since the AI's output isn't always strict CommonMark (e.g. a name and title on adjacent lines with no blank line between them would otherwise collapse into one run-on line).

Wired into all three CV-producing paths — `apply/prepare.ts` (crawled postings), `leads/prepare.ts` (speculative outreach), `apply/manual-intake.ts` (manual paste-a-job) — each now uploads `cv.pdf` (`application/pdf`) instead of `cv.txt` (`text/plain`), and the corresponding Gmail-send call sites (`apply/manual-intake.ts`, `leads/send.ts`) were updated to attach it as such. Cover letters are deliberately **not** PDF-rendered — they're used as the email body text, never attached, so plain text is correct there.

**Cost tradeoff, not yet a problem but worth tracking**: every tailored CV now launches a full headless Chromium instance (cold start, render, close) instead of a plain-text write. Fine at today's BullMQ worker concurrency (1), but if that concurrency is ever raised for scale, this now falls under the same Playwright-concurrency sizing rule as Tier B in §10 (`max_concurrent_playwright_jobs ≈ (available_RAM_GB - 2GB) / 0.5GB`) — it's no longer just a Tier B concern once every single application generates a Chromium-rendered PDF.
