# Multi-app monorepo Dockerfile — hr
FROM node:22-slim

WORKDIR /repo

COPY package.json ./
COPY packages ./packages
COPY apps/hr ./apps/hr
COPY tsconfig.json ./

RUN npm install --legacy-peer-deps --no-audit
RUN npm run build --workspace=@ykp/hr

EXPOSE 3002
CMD ["npm", "start", "--workspace=@ykp/hr"]