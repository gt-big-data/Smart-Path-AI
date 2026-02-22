# Smart-Path-AI Docker Guide

This guide is for running the full app stack with Docker from the project root.

## File Structure Example

```text
bdbi/
|- docker-compose.yml
|- docker-compose.dev.yml
|- .env
|- Smart-Path-AI/
|  |- Dockerfile
|  |- dockerFiles/
|  |  |- docker-compose.yml
|  |  |- docker-compose.dev.yml
|  |  |- .env.example
|- smartpathai-aiserver/
   |- Dockerfile
   |- dockerFiles/
      |- docker-compose.yml
      |- docker-compose.dev.yml
      |- .env.example
```

## Before You Start

- Install Docker Desktop (or Docker Engine + Compose plugin).
- Run commands from the project root (`bdbi`), not from inside `Smart-Path-AI/`.

## 1) Copy Docker Files To Project Root

Use the files in this repo folder as the active root files:

```bash
cd bdbi
cp Smart-Path-AI/dockerFiles/docker-compose.yml ./docker-compose.yml
cp Smart-Path-AI/dockerFiles/docker-compose.dev.yml ./docker-compose.dev.yml
cp Smart-Path-AI/dockerFiles/.env.example ./.env
```

## 2) Fill In `.env`

Open `./.env` and set values for:

- `NEO4J_URI`
- `NEO4J_USERNAME`
- `NEO4J_PASSWORD`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `SESSION_SECRET`

## 3) Run (Build Mode)

This mode runs from built images. If you edit code, rebuild to see changes.

```bash
docker compose -f docker-compose.yml up --build
```

## 4) Run (Live Dev Mode)

This mode uses bind mounts for live code changes. It allows changes to be shown in real time without reloading the docker container.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## 5) Stop

If running live dev mode:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

If running build mode only:

```bash
docker compose -f docker-compose.yml down
```

## App URLs

- Frontend: `http://localhost:5173`
- App server: `http://localhost:4000`
- AI server: `http://localhost:8000`

## Common Confusion

- Code changes not showing:
  - You probably started with only `docker-compose.yml`.
  - Use both files for live reload: `-f docker-compose.yml -f docker-compose.dev.yml`.
