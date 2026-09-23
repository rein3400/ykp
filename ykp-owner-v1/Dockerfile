# ykp-owner-v1 Dockerfile (Next.js 16 aggregator, no DB)
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps --no-audit

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time stand-ins: sibling URLs unreachable at build, SESSION_SECRET required.
# Runtime Coolify env overrides both (YKP_*_URL live, SESSION_SECRET real).
ENV YKP_OWNER_MOCK=true
ENV SESSION_SECRET=build_time_placeholder_secret_32chars_min
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3010
CMD ["sh", "-c", "PORT=${PORT:-3010} npx next start -p $PORT -H 0.0.0.0"]
