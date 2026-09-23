# CLAUDE.md

Read this first in every session on this repo, then read `STATUS.md` for exactly what to work on next, then `ARCHITECTURE.md` for the technical detail behind any task.

## What this is

A job-application automation platform. Users build a profile from a CV + links + free text, set preferences, and a daily background agent finds matching jobs, scores fit, tailors a CV/cover letter per job, and applies — without the user needing to be online. Full product reasoning and stack rationale: `ARCHITECTURE.md`. Task breakdown and progress: `STATUS.md`.

## Session start checklist

1. Read `STATUS.md` → "Current focus" tells you the next task.
2. If a task is ambiguous, check `ARCHITECTURE.md` for the relevant section before guessing.
3. When a task is genuinely done (builds, runs, verified — not just attempted), check it off in `STATUS.md` and update "Current focus" to the next one.
4. If you make or change an architectural decision, update `ARCHITECTURE.md` and add a line to the Decisions log in `STATUS.md` with today's date.

## Hard rules (do not violate without an explicit conversation with the user first)

- **No LinkedIn/Indeed Easy Apply automation.** Tier C is explicitly deferred — see ARCHITECTURE.md §5, STATUS.md decisions log. Don't build it "while we're in there."
- **Applications send from the user's own email** (Gmail OAuth), never from a platform/system address.
- **Never fabricate CV content.** Tailoring reframes/reorders real experience only — enforced by `verifyNoFabrication` in `apps/worker/src/apply/tailor.ts`, a second independent AI call that audits generated CVs against the source data and fails closed. This is load-bearing: a real test caught the generation model inventing an entire fake "Projects" section despite prompt instructions not to. Do not remove the audit step.
- **The apply step (send email / submit portal form) is gated behind `AGENT_ALLOW_REAL_APPLY`** (unset by default). Tailoring runs automatically with no third-party side effects; actually contacting an employer is the one action in the pipeline that isn't reversible or private, so it needs a deliberate flag, not a default-on config. Never flip this on or wire real channel dispatch without an explicit conversation — see ARCHITECTURE.md §12.
- **Dedup is a DB constraint**, not just application-layer logic — unique on `(user_id, job_posting_id)` in `applications`.
- **One AI provider interface.** All LLM calls go through the abstraction in `packages/ai` (once scaffolded) so Anthropic ↔ Ollama is an env var swap, never a code change at call sites.
- **Respect robots.txt / rate limits** on every job source. A source blocking the crawler is a bug.
- **The server never receives source code.** Only `deploy/docker-compose.yml`, `deploy/Caddyfile`, and a server-side `.env` (Doppler or manual SSH) ever land on the VPS. CI ships prebuilt images to a registry; the compose file only pulls by tag.
- Wallet/credit checks happen **before** any paid AI call or application send, not after.

## Repo conventions

- Monorepo (pnpm workspace, root `pnpm-workspace.yaml`): `apps/web` (Next.js 16, App Router), `apps/worker` (NestJS), `packages/db` (Drizzle schema/client), `packages/ai` (provider abstraction), `packages/storage` (R2/S3-compatible client), `packages/wallet` (wallet resolution/debit/grant — used by both apps), `packages/queue` (BullMQ queue/worker helpers — `apps/web` enqueues, `apps/worker`'s scheduler daemon consumes), `packages/types` (shared types). Cross-package imports use `@job-auto/*` and are wired via `workspace:*` — always add new shared code to a package, never duplicate types/logic across `apps/web` and `apps/worker`. (`packages/wallet` and `packages/queue` exist specifically because logic first written in one app turned out to be needed by the other — check whether something already belongs in a package before writing it app-local.)
- Currently developing against Groq's free tier, not Anthropic (`AI_PROVIDER=openai`, `AI_BASE_URL=https://api.groq.com/openai/v1`, `AI_MODEL=openai/gpt-oss-120b` in `.env`) — no paid subscription yet. If a model 404s, Groq's catalog changed; check `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $AI_API_KEY"`. Switching to real Anthropic later is just an env var change, not a code change.
- DB: Postgres + Drizzle. Schema lives in `packages/db/src/schema.ts`. Run `pnpm db:generate` then `pnpm db:migrate` (from repo root) after schema changes.
- Env vars: `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL` control which LLM backend is used (Anthropic prod, Ollama local/offline) — see `packages/ai/src/index.ts`. Never instantiate a provider class directly outside that file; always call `getAiProvider()`.
- Local dev: no Docker needed. Point `.env` (copied from `.env.example`) at a local Postgres/Redis — the user runs these via DBngin, not containers. Then `pnpm dev:web` / `pnpm dev:worker`.
- Deployment: the server **never** receives source code, only `deploy/docker-compose.yml`, `deploy/Caddyfile`, and a hand/Doppler-provisioned `.env` (see `deploy/.env.example` for its shape). CI builds `apps/web/Dockerfile` and `apps/worker/Dockerfile` into images pushed to GHCR; the server only pulls and runs them. Full pipeline: `ARCHITECTURE.md` §11, workflow: `.github/workflows/deploy.yml`. Never add steps that scp/rsync the repo itself to the server.
- `apps/web` has its own `AGENTS.md`/`CLAUDE.md` (auto-generated by `next dev`, do not remove) warning that this Next.js version has breaking API changes from training data — read `node_modules/next/dist/docs/` before writing App Router code there.
- `apps/worker` builds as **CommonJS** (`module: "commonjs"` in its tsconfig, no `"type": "module"` in its package.json) — this was a deliberate fix, not the Nest CLI default (which scaffolds ESM/`nodenext`). ESM/nodenext there required `.js` extensions on every relative import, which Turbopack in `apps/web` then couldn't resolve for the *same* shared package source files (`packages/db`, `packages/ai` are consumed as raw `.ts`, not prebuilt) — one moduleResolution mode always broke the other consumer. CommonJS avoids the conflict entirely: don't add extensions to relative imports in `apps/worker`, and don't reintroduce `nodenext`/ESM there without re-solving this. Side-effect env loading also needs `import * as dotenv from "dotenv"; dotenv.config();`, not `import "dotenv/config"` (the latter doesn't resolve under classic Node module resolution).
- When adding `drizzle-orm` as a direct dependency anywhere new, pin it to the exact version `packages/db` uses (currently `0.44.7`) — mismatched versions across the workspace produce baffling `SQL<unknown>` type errors. Same applies to `ioredis` (must be `5.11.1` to match what BullMQ expects internally, not latest `6.x`) — check what version a workspace package already pulls in transitively before adding the same package directly elsewhere.
- If `pnpm install`/`pnpm run build` fails with `ERR_PNPM_IGNORED_BUILDS` for some dependency even though it's listed in `onlyBuiltDependencies`, add it to `pnpm-workspace.yaml`'s `allowBuilds: { <package>: false }` instead — that's the mechanism that actually suppresses the error on this pnpm version, not `onlyBuiltDependencies`/`ignoredBuiltDependencies` alone.

## Local Ollama (offline mode) quick reference

Full context in ARCHITECTURE.md §8. Quick version:
```
brew install ollama
ollama serve
ollama pull qwen2.5:14b
# worker env: AI_PROVIDER=ollama AI_BASE_URL=http://localhost:11434/v1 AI_MODEL=qwen2.5:14b
```

## Commands

From repo root, after `pnpm install` (and with local Postgres/Redis already running — e.g. via DBngin):

- `pnpm dev:web` — run the Next.js app
- `pnpm dev:worker` — run the NestJS worker in watch mode
- `pnpm db:generate` / `pnpm db:migrate` — Drizzle migrations (run from `packages/db`, or via these root scripts)
- `pnpm agent:run <email>` — run the full agent pipeline once for a user (offline/manual mode; same function the scheduler and admin "run now" button call)
- Per-package build/test: `pnpm --filter @job-auto/web build`, `pnpm --filter @job-auto/worker build`, etc.
- Worker-only scripts (run from `apps/worker`): `pnpm ingest:run` (crawl job sources), `pnpm score:run <email>` (shortlist), `pnpm prepare:run <email>` (tailor), `pnpm scheduler:start` (long-running BullMQ daemon — this is what needs to run continuously in production/deploy).
