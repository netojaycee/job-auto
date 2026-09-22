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
- **Never fabricate CV content.** Tailoring reframes/reorders real experience only.
- **Dedup is a DB constraint**, not just application-layer logic — unique on `(user_id, job_posting_id)` in `applications`.
- **One AI provider interface.** All LLM calls go through the abstraction in `packages/ai` (once scaffolded) so Anthropic ↔ Ollama is an env var swap, never a code change at call sites.
- **Respect robots.txt / rate limits** on every job source. A source blocking the crawler is a bug.
- Wallet/credit checks happen **before** any paid AI call or application send, not after.

## Repo conventions (fill in as they're established)

- Monorepo: Next.js web app + NestJS worker service + shared packages (`db`, `ai`, `types`). Structure gets created in Phase 1, Task 1 of `STATUS.md`.
- DB: Postgres + Drizzle, migrations checked into the repo.
- Env vars: `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL` control which LLM backend is used (Anthropic prod, Ollama local/offline). Never hardcode a provider.
- Local dev: Docker Compose brings up Postgres + Redis. Details land here once `docker-compose.yml` exists.

## Local Ollama (offline mode) quick reference

Full context in ARCHITECTURE.md §8. Quick version:
```
brew install ollama
ollama serve
ollama pull qwen2.5:14b
# worker env: AI_PROVIDER=ollama AI_BASE_URL=http://localhost:11434/v1 AI_MODEL=qwen2.5:14b
```

## Commands

Not yet defined — Phase 1 scaffolding will populate this section with real `pnpm` scripts (dev, build, test, migrate, agent:run).
