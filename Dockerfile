# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Install native build tools needed by some npm packages (e.g. pdf-parse)
RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci --omit=dev
# Keep a copy of dev deps (for tsx, needed to run CLI scripts)
RUN cp -r node_modules node_modules_prod && npm ci

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ─── Stage 3: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Default data paths — override with Railway volume at /data
ENV WIKI_PATH=/data/wiki
ENV RAW_SOURCES_PATH=/data/raw-sources

# Next.js build output
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package*.json ./

# Full node_modules (includes tsx for CLI scripts)
COPY --from=deps /app/node_modules ./node_modules

# CLI scripts for ingest/lint (run via railway shell or cron)
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/app/lib ./app/lib
COPY --from=builder /app/app/types ./app/types

# Seed wiki skeleton — volume will overlay /data at runtime
RUN mkdir -p /data/wiki /data/raw-sources
COPY --from=builder /app/wiki/SCHEMA.md /data/wiki/SCHEMA.md
COPY --from=builder /app/wiki/index.md /data/wiki/index.md

EXPOSE 3000

CMD ["npm", "start"]
