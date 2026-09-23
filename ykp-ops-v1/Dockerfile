# ykp-ops-v1 Dockerfile (Next.js 16 + Google Sheets / mock)
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps --no-audit

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Mock mode for build-time page collection if Sheets not set
ENV USE_MOCK_DB=true
ENV SESSION_SECRET=build_time_placeholder_secret_32chars_min
# Build-time public vars: NEXT_PUBLIC_* is inlined into the client bundle.
ARG NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
ENV NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3007
CMD ["sh", "-c", "PORT=${PORT:-3007} npx next start -p $PORT -H 0.0.0.0"]
