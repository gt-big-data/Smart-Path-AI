# Smart-Path-AI Docker Guide

Run the full stack with Docker from the **workspace root** — the folder that contains both `Smart-Path-AI/` and `smartpathai-aiserver/` (this guide calls it `SmartPathAI`).

## File layout

```text
SmartPathAI/
├── docker-compose.yml          # copied from Smart-Path-AI/dockerFiles/
├── docker-compose.dev.yml
├── .env
├── Smart-Path-AI/
│   ├── Dockerfile
│   └── dockerFiles/
│       ├── docker-compose.yml
│       ├── docker-compose.dev.yml
│       └── .env.example
└── smartpathai-aiserver/
    └── Dockerfile
```

## Before you start

- Install Docker Desktop (or Docker Engine + Compose).
- Run compose commands from `SmartPathAI/`, not from inside `Smart-Path-AI/`.

## 1. Copy compose files to the workspace root

```bash
cd SmartPathAI
cp Smart-Path-AI/dockerFiles/docker-compose.yml ./docker-compose.yml
cp Smart-Path-AI/dockerFiles/docker-compose.dev.yml ./docker-compose.dev.yml
cp Smart-Path-AI/dockerFiles/.env.example ./.env
```

## 2. Fill in `.env`

Required / commonly used:

```bash
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
OPENAI_API_KEY=
SESSION_SECRET=
MONGO_URI=mongodb://mongo:27017/smartpathai
CLIENT_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
```

Compose sets `PYTHON_SERVICE_URL=http://ai-server:8000` on the app service for you.

Handwritten OCR also needs Document AI vars **inside the AI image** (`GCP_PROJECT_ID`, `GCP_LOCATION`, `DOCAI_PROCESSOR_ID`, and credentials). See `smartpathai-aiserver/DOCUMENT_AI_SETUP.md`. Printed PDFs work without that.

## 3. Run (build mode)

Built images. Rebuild to pick up code changes.

```bash
docker compose -f docker-compose.yml up --build
```

## 4. Run (live dev mode)

Bind mounts + reload. Use this while coding.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Dev overlay:

- App: `ts-node-dev` + Vite `--host 0.0.0.0`
- AI: `uvicorn --reload --port 8000`

## 5. Stop

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
# or, if you started build mode only:
docker compose -f docker-compose.yml down
```

## URLs

| Service | URL |
|---------|-----|
| Frontend (dev overlay) | http://localhost:5173 |
| Express | http://localhost:4000 |
| AI server | http://localhost:8000 |
| Mongo | localhost:27017 |

Production `Smart-Path-AI/Dockerfile` starts **Express only** on 8080. Vite on 5173 is the dev overlay, not the production image.

## Ports (AI image)

The AI `Dockerfile` runs uvicorn on **8080**. Direct `docker run` should use `-p 8000:8080`.

The workspace compose file maps `8000:8000` and the **dev overlay** overrides the AI command to `--port 8000`, so live-dev compose matches. Build-mode compose without that override will not reach the AI process unless you change the mapping.

## Code changes not showing?

You started with only `docker-compose.yml`. Add the dev overlay: `-f docker-compose.yml -f docker-compose.dev.yml`.
