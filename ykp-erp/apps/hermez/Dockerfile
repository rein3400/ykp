# Multi-app monorepo Dockerfile — hermez
FROM node:22-slim

WORKDIR /repo

COPY package.json ./
COPY packages ./packages
COPY apps/hermez ./apps/hermez
COPY tsconfig.json ./

RUN npm install --legacy-peer-deps --no-audit
RUN npm run build --workspace=@ykp/hermez

EXPOSE 3004
CMD ["npm", "start", "--workspace=@ykp/hermez"]