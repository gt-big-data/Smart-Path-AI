FROM node:20-bookworm-slim AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci

FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY . .
COPY --from=frontend-builder /app/dist ./dist

RUN chmod +x /app/scripts/start.sh

EXPOSE 4000 5173

CMD ["/app/scripts/start.sh"]
