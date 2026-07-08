FROM node:22-alpine AS base
RUN apk add --no-cache dumb-init curl ca-certificates postgresql-client
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps
RUN npm install --no-save --legacy-peer-deps tsx@4.20.6

FROM base AS runtime
RUN addgroup -S ykp && adduser -S ykp -G ykp
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY src ./src
COPY drizzle ./drizzle
COPY tsconfig.json ./tsconfig.json
COPY drizzle.config.ts ./drizzle.config.ts
COPY dashboard ./dashboard
RUN mkdir -p /var/lib/ykp/backups && chown -R ykp:ykp /app /var/lib/ykp
ENV NODE_ENV=production
USER ykp
EXPOSE 3001
CMD ["dumb-init", "node", "--import", "tsx", "src/index.ts"]