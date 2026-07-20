# syntax=docker/dockerfile:1
FROM node:22-alpine AS base

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3003
EXPOSE 3003

CMD ["npm", "start"]
