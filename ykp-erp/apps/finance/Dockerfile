# Multi-app monorepo Dockerfile — finance
FROM node:22-slim

WORKDIR /repo

# Monorepo root files (relative to build context which is repo root for git deploy,
# OR ykp-erp/apps/finance for CLI deploy — we expect git deploy here)
COPY package.json ./
COPY packages ./packages
COPY apps/finance ./apps/finance
COPY tsconfig.json ./

RUN npm install --legacy-peer-deps --no-audit
RUN npm run build --workspace=@ykp/finance

EXPOSE 3003
CMD ["npm", "start", "--workspace=@ykp/finance"]