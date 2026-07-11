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
# Build workspace packages in dependency order so dist/ folders exist
# (@ykp/ui main=./dist/index.js, but dist/ is gitignored).
RUN find packages -name 'tsconfig.tsbuildinfo' -delete 2>/dev/null || true
RUN npm run build --workspace @ykp/config --if-present \
 && npm run build --workspace @ykp/engine --if-present \
 && npm run build --workspace @ykp/auth --if-present \
 && npm run build --workspace @ykp/ui --if-present
RUN npm run build --workspace=@ykp/finance

EXPOSE 3003
CMD ["npm", "start", "--workspace=@ykp/finance"]