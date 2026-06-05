# ─── Stage 1: All Dependencies (build-time) ────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Install native build tools needed by some npm packages (e.g. pdf-parse)
RUN apk add --no-cache libc6-compat

COPY package*.json ./
# Install all deps including devDeps (needed for the build stage)
RUN npm ci

# ─── Stage 2: Production-only Dependencies ─────────────────────────────────────
FROM node:20-alpine AS prod-deps

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci --omit=dev

# ─── Stage 3: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ─── Stage 4: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Default data paths — overridden by Railway volume mount at /data
ENV WIKI_PATH=/data/wiki
ENV RAW_SOURCES_PATH=/data/raw-sources

# Next.js build output
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package*.json ./

# public/ may be empty if no static assets exist — create it first to be safe
RUN mkdir -p ./public
COPY --from=builder /app/public ./public

# Production node_modules (devDependencies excluded)
COPY --from=prod-deps /app/node_modules ./node_modules

# tsx is needed at runtime for CLI scripts (ingest/lint) — install separately
RUN npm install tsx

# CLI scripts — used via `railway run` or cron service
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/app/lib ./app/lib
COPY --from=builder /app/app/types ./app/types

# Store wiki seed files at /app/wiki-seed (NOT /data, which is the volume mount).
# The init-data.sh script copies them to the volume on first boot.
RUN mkdir -p /app/wiki-seed
COPY --from=builder /app/wiki/SCHEMA.md /app/wiki-seed/SCHEMA.md
COPY --from=builder /app/wiki/index.md  /app/wiki-seed/index.md

EXPOSE 3000

# On every start: initialize the volume if needed, then launch Next.js
CMD ["sh", "-c", "sh /app/scripts/init-data.sh && npm start"]
