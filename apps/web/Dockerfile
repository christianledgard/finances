# Build from the repo root so the pnpm workspace (lockfile + all manifests) is
# in context:
#   docker build -f apps/web/Dockerfile -t finances-web .
#
# On Railway: set the service root directory to the repo root and the Dockerfile
# path to apps/web/Dockerfile. Railway injects PORT at runtime; the standalone
# server reads it automatically.

FROM node:22-alpine AS base
# Next's standalone server runs fine on musl, but libc6-compat avoids surprises
# with any transitively-loaded native modules.
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# ── deps ──────────────────────────────────────────────────────────────────────
# Install with the lockfile alone for maximum layer caching. Every workspace
# manifest must be present for --frozen-lockfile to validate against the lockfile.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/scheduler/package.json ./apps/scheduler/
COPY apps/extractor/package.json ./apps/extractor/
COPY packages/db/package.json ./packages/db/
RUN pnpm install --frozen-lockfile

# ── builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
# The placeholder secret only lets betterAuth/MongoClient be constructed during
# the build's page-data collection; it is scoped to this RUN (not persisted in
# the image). Real values are supplied by Railway at runtime.
RUN BETTER_AUTH_SECRET=build-time-placeholder pnpm --filter @finances/web build

# ── runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone output mirrors the repo layout from outputFileTracingRoot, so the
# entrypoint lives at apps/web/server.js and node_modules sit at the root.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
