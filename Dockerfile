# syntax=docker/dockerfile:1

# ── deps ────────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── build ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Inlined into the client bundle at build time.
ARG NEXT_PUBLIC_CALENDAR_YEAR=2026
ENV NEXT_PUBLIC_CALENDAR_YEAR=$NEXT_PUBLIC_CALENDAR_YEAR
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runtime ─────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Database setup script (runs on every start — it is idempotent).
COPY --from=build --chown=nextjs:nodejs /app/db ./db
COPY --from=build --chown=nextjs:nodejs /app/scripts/db-setup.mjs ./scripts/db-setup.mjs
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/manifest.webmanifest || exit 1

CMD ["sh", "-c", "node scripts/db-setup.mjs && exec node server.js"]
