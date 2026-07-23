FROM node:22-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* must be present AT BUILD TIME so Next.js inlines the real
# production URLs into the client bundle (not the localhost defaults in
# config.ts). Railway auto-passes service variables as Docker build-args;
# we declare them as ARGs and re-export as ENV so `next build` sees them.
ARG NEXT_PUBLIC_YKP_OWNER_URL
ARG NEXT_PUBLIC_YKP_HR_URL
ARG NEXT_PUBLIC_YKP_FINANCE_URL
ARG NEXT_PUBLIC_YKP_WAREHOUSE_URL
ARG NEXT_PUBLIC_YKP_INVESTOR_URL
ARG NEXT_PUBLIC_YKP_OPS_URL
ARG NEXT_PUBLIC_ERP_SSO_SECRET
ENV NEXT_PUBLIC_YKP_OWNER_URL=$NEXT_PUBLIC_YKP_OWNER_URL \
    NEXT_PUBLIC_YKP_HR_URL=$NEXT_PUBLIC_YKP_HR_URL \
    NEXT_PUBLIC_YKP_FINANCE_URL=$NEXT_PUBLIC_YKP_FINANCE_URL \
    NEXT_PUBLIC_YKP_WAREHOUSE_URL=$NEXT_PUBLIC_YKP_WAREHOUSE_URL \
    NEXT_PUBLIC_YKP_INVESTOR_URL=$NEXT_PUBLIC_YKP_INVESTOR_URL \
    NEXT_PUBLIC_YKP_OPS_URL=$NEXT_PUBLIC_YKP_OPS_URL \
    NEXT_PUBLIC_ERP_SSO_SECRET=$NEXT_PUBLIC_ERP_SSO_SECRET
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["sh", "-c", "npx next start -p ${PORT:-3000} -H 0.0.0.0"]
