FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/ai/package.json packages/ai/
COPY packages/storage/package.json packages/storage/
COPY packages/wallet/package.json packages/wallet/
COPY packages/queue/package.json packages/queue/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @job-auto/worker build

FROM mcr.microsoft.com/playwright:v1.49.0-jammy AS runner
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/apps/worker/dist ./apps/worker/dist
COPY --from=build /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
# The scheduler daemon (queue worker + repeatable-job sync) is the actual
# long-running process — main.ts's bare NestJS app has nothing to serve yet.
CMD ["node", "apps/worker/dist/scheduler/daemon.js"]
