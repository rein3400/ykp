FROM node:22-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Railway injects service env as ARG-compatible env during build, but Docker
# multi-stage stages do not inherit host env unless declared. Next.js inlines
# NEXT_PUBLIC_* at `next build` time — without these ARG/ENV the client bundle
# bakes empty strings for SSO token and module URLs.
ARG NEXT_PUBLIC_ERP_SSO_SECRET
ARG NEXT_PUBLIC_YKP_OWNER_URL
ARG NEXT_PUBLIC_YKP_HR_URL
ARG NEXT_PUBLIC_YKP_FINANCE_URL
ARG NEXT_PUBLIC_YKP_WAREHOUSE_URL
ARG NEXT_PUBLIC_YKP_INVESTOR_URL
ARG NEXT_PUBLIC_YKP_OPS_URL
ENV NEXT_PUBLIC_ERP_SSO_SECRET=$NEXT_PUBLIC_ERP_SSO_SECRET \
    NEXT_PUBLIC_YKP_OWNER_URL=$NEXT_PUBLIC_YKP_OWNER_URL \
    NEXT_PUBLIC_YKP_HR_URL=$NEXT_PUBLIC_YKP_HR_URL \
    NEXT_PUBLIC_YKP_FINANCE_URL=$NEXT_PUBLIC_YKP_FINANCE_URL \
    NEXT_PUBLIC_YKP_WAREHOUSE_URL=$NEXT_PUBLIC_YKP_WAREHOUSE_URL \
    NEXT_PUBLIC_YKP_INVESTOR_URL=$NEXT_PUBLIC_YKP_INVESTOR_URL \
    NEXT_PUBLIC_YKP_OPS_URL=$NEXT_PUBLIC_YKP_OPS_URL

RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["sh", "-c", "npx next start -p ${PORT:-3000} -H 0.0.0.0"]
