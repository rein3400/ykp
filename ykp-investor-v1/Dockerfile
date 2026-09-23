FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps --no-audit

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time public vars: NEXT_PUBLIC_* is inlined into the client bundle and
# next.config.ts reads YKP_HUB_ORIGIN for the frame-ancestors CSP.
ARG NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
ARG NEXT_PUBLIC_FINANCE_URL
ARG YKP_HUB_ORIGIN
ENV NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME \
    NEXT_PUBLIC_FINANCE_URL=$NEXT_PUBLIC_FINANCE_URL \
    YKP_HUB_ORIGIN=$YKP_HUB_ORIGIN
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG YKP_HUB_ORIGIN
ENV YKP_HUB_ORIGIN=$YKP_HUB_ORIGIN
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3006
CMD ["sh", "-c", "PORT=${PORT:-3006} npx next start -p $PORT -H 0.0.0.0"]