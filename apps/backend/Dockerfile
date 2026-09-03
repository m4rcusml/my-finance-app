# syntax=docker/dockerfile:1
# Multi-stage build for the NestJS API. Built from the REPO ROOT so the pnpm
# workspace (and packages/contracts) is available:
#   docker build -f apps/backend/Dockerfile -t finance-backend .

# ---------- deps ----------
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
RUN pnpm install --frozen-lockfile --filter backend... --filter @finance/contracts...

# ---------- build ----------
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/backend/node_modules ./apps/backend/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/backend ./apps/backend
WORKDIR /repo/apps/backend
# The Prisma client is generated, never committed.
RUN pnpm prisma generate && pnpm build

# ---------- runtime ----------
FROM node:22-alpine AS runtime
RUN corepack enable && apk add --no-cache tini
ENV NODE_ENV=production
WORKDIR /repo

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/backend/dist ./apps/backend/dist
COPY --from=build /repo/apps/backend/prisma ./apps/backend/prisma
COPY --from=build /repo/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /repo/apps/backend/prisma.config.ts ./apps/backend/prisma.config.ts
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node
WORKDIR /repo/apps/backend
EXPOSE 3001

# Liveness is deliberately outside /api/v1 and needs no auth.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
# `start:prod` runs exactly this file — the same artifact CI smoke-tests.
CMD ["node", "dist/main.js"]
