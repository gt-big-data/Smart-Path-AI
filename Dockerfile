FROM node:20-bookworm-slim AS builder
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime
WORKDIR /app/server

ENV NODE_ENV=production

COPY --from=builder /app/server /app/server

EXPOSE 8080

CMD ["node", "index.js"]
