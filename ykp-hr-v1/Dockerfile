# ykp-hr-v1 Dockerfile (Next.js 16 + Google Sheets)
# Build context: ykp-hr-v1/ (subdirectory)
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps --no-audit

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3002
CMD ["sh", "-c", "PORT=${PORT:-3002} npx next start -p $PORT -H 0.0.0.0"]