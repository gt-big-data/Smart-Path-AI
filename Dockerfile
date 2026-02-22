FROM node:20-bookworm-slim AS deps
WORKDIR /app

# TODO(deployment): This image currently installs full dependency sets and the
# runtime entrypoint uses dev tooling (ts-node + vite preview). For production,
# split build/runtime deps: keep dev deps in builder stages only, then use
# `npm ci --omit=dev` in the runtime stage and run compiled server JS.
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
