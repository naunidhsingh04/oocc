# Build context is the repo root (see docker-compose.yml) — apps/web
# depends on packages/ui and packages/contracts/ts as pnpm workspace members.
FROM node:20-slim

RUN corepack enable

WORKDIR /repo
COPY . .

RUN pnpm install --frozen-lockfile
# packages/*/generated are committed (see packages/contracts/README.md), so
# no gen:contracts step is needed here — this image has no Python/uv anyway.
RUN pnpm --filter @oocc/web build

WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
