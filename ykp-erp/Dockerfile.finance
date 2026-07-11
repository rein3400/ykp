# Multi-app monorepo Dockerfile — finance
FROM node:22-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/finance/package.json ./apps/finance/
RUN npm install --legacy-peer-deps --no-audit

FROM node:22-slim AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY packages ./packages
COPY apps/finance ./apps/finance
COPY --from=deps /repo/apps/finance/package.json ./apps/finance/package.json
COPY tsconfig.json package.json package-lock.json* ./
RUN npm install --legacy-peer-deps --no-audit
WORKDIR /repo/apps/finance
# Build-time env to satisfy schema/db init during page data collection
ENV YKP_DATABASE_URL=postgresql://placeholder/db
ENV YKP_MASTER_DATABASE_URL=postgresql://placeholder/db
ENV YKP_HR_DATABASE_URL=postgresql://placeholder/db
ENV YKP_FINANCE_DATABASE_URL=postgresql://placeholder/db
ENV YKP_HERMEZ_DATABASE_URL=postgresql://placeholder/db
# Build workspace packages in dependency order so dist/ folders exist
# when next build resolves @ykp/* (dist/ is gitignored, so absent in repo).
# config (leaf) -> engine/auth (depend on config) -> ui (depends on format).
# Clear stale tsbuildinfo first to force a fresh tsc compile.
WORKDIR /repo
RUN find packages -name 'tsconfig.tsbuildinfo' -delete 2>/dev/null || true
RUN npm run build --workspace @ykp/config --if-present \
 && npm run build --workspace @ykp/engine --if-present \
 && npm run build --workspace @ykp/auth --if-present \
 && npm run build --workspace @ykp/ui --if-present
WORKDIR /repo/apps/finance
RUN npx next build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo/apps/finance/.next ./.next
COPY --from=builder /repo/apps/finance/package.json ./
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/finance/next.config.mjs ./
COPY --from=builder /repo/packages ./packages
EXPOSE 3003
CMD ["sh", "-c", "PORT=${PORT:-3003} npx next start -p $PORT -H 0.0.0.0"]