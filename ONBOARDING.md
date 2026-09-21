# New member onboarding

Get SmartPathAI running on your laptop. When you are done:

- [http://localhost:8000/docs](http://localhost:8000/docs) shows the AI API
- [http://localhost:5173](http://localhost:5173) shows the website
- Two terminals stay open (AI server + website)

A printable PDF of this guide lives in the workspace `docs/SmartPathAI-New-Member-Setup.pdf` (regenerate with `python docs/generate_setup_guide.py` if you have that folder).

**Do not commit `.env` files, API keys, or `smartpathai-aiserver/keys/*.json`.**

---

## 1. Install these three things

| Install | Check |
|---------|--------|
| [Git](https://git-scm.com/downloads) | `git --version` |
| [Node.js 20 LTS](https://nodejs.org) (includes npm) | `node -v` should start with `v20` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Open it and wait until it says it is running |

You do **not** need to install Python for the default path. Docker runs the AI server.

Native Python (optional, for AI-server contributors): Python **3.11** (3.13 often fails to build `pandas` / `pillow` — see `smartpathai-aiserver/DEBUG.md`).

## 2. GitHub access

Message a project lead with your GitHub username. You cannot clone until you are added.

| Repo | What it is |
|------|------------|
| `gt-big-data/Smart-Path-AI` | Website (React + Express) — this repo |
| `VinhPham25/smartpathai-aiserver` | AI server (private) |

## 3. Clone both repos side by side

```bash
mkdir SmartPathAI && cd SmartPathAI
git clone https://github.com/gt-big-data/Smart-Path-AI.git
git clone https://github.com/VinhPham25/smartpathai-aiserver.git
```

You should have `SmartPathAI/Smart-Path-AI` and `SmartPathAI/smartpathai-aiserver`.

## 4. Add the `.env` files

A project lead will send credentials. Put each file in the matching folder. Do not rename them.

| File you receive | Put it here |
|------------------|-------------|
| AI server `.env` | `smartpathai-aiserver/.env` |
| Website `.env` (Vite) | `Smart-Path-AI/.env` |
| Express `.env` | `Smart-Path-AI/server/.env` |

Templates (no secrets) live next to those paths as `.env.example`.

**Minimum that must be real values**

AI server (`smartpathai-aiserver/.env`):

- `OPENAI_API_KEY`
- `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`

Website (`Smart-Path-AI/.env`):

```bash
VITE_API_BASE_URL=http://localhost:4000
```

Express (`Smart-Path-AI/server/.env`):

- `MONGO_URI`
- `SESSION_SECRET`
- `OPENAI_API_KEY` (used by Node-side answer grading)
- `PYTHON_SERVICE_URL=http://127.0.0.1:8000`
- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and usually
  `GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback`
  `CLIENT_URL=http://localhost:5173`
  `CORS_ORIGINS=http://localhost:5173`

### Document AI (handwritten OCR)

Only needed if you will process scanned / handwritten PDFs. Follow `smartpathai-aiserver/DOCUMENT_AI_SETUP.md`. Printed digital PDFs work without it.

### Neo4j Aura notes

- Prefer `neo4j+ssc://` if `neo4j+s://` fails SSL verification locally.
- The Aura username is often the instance id, not `neo4j`.
- The instance must be **running** (Aura pauses idle DBs). The AI server needs the **APOC** plugin for graph upserts.

## 5. Start the AI server

Leave Docker Desktop running.

```bash
cd SmartPathAI/smartpathai-aiserver
docker build -t smartpathai-aiserver .
docker run --rm -p 8000:8080 --env-file .env smartpathai-aiserver
```

The image listens on **8080 inside the container**. Map it to host **8000** (`-p 8000:8080`). First build can take several minutes.

When ready, open [http://localhost:8000/docs](http://localhost:8000/docs). **Leave this terminal open.**

Native run (optional):

```bash
cd smartpathai-aiserver
python3.11 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn api:app --reload --port 8000
```

## 6. Start the website

Second terminal:

```bash
cd SmartPathAI/Smart-Path-AI
npm install
cd server && npm install && cd ..
npm run dev
```

Wait for:

- `Local: http://localhost:5173/`
- `MongoDB connected` and the Express server on port **4000**

**Leave this terminal open too.**

## 7. Open the app

[http://localhost:5173](http://localhost:5173)

### You are done when

- [ ] `http://localhost:8000/docs` opens
- [ ] `http://localhost:5173` shows the website
- [ ] both terminals are still running

Try: sign up (or email/password if Google OAuth is not set for localhost), start a chat, upload a small PDF, wait for the graph.

## Local ports

| Service | Port |
|---------|------|
| Vite frontend | 5173 |
| Express API | 4000 |
| FastAPI AI | 8000 on the host (8080 inside the Docker image) |
| MongoDB (if local/compose) | 27017 |

## If something goes wrong

| What you see | What to do |
|--------------|------------|
| Git clone denied / 404 | You are not added to the repo. Message a lead with your GitHub username. |
| Docker build or run fails | Confirm Docker Desktop is open. Retry step 5. |
| `npm install` fails | `node -v` should be 20. Retry step 6. |
| Website opens but login or upload fails | AI terminal still running? All three `.env` files in the right folders? `PYTHON_SERVICE_URL=http://127.0.0.1:8000`? |
| Login always hits production | Several frontend files still hardcode the Cloud Run URL. Chat upload uses `VITE_API_BASE_URL`; auth/progress may still talk to production. See the website README. |
| PDF upload hangs / 500 | Check the AI terminal logs. Neo4j Aura paused? Missing `OPENAI_API_KEY`? |
| Handwritten PDF fails | Document AI env + `keys/*.json` missing. Printed PDFs do not need this. |
| Python install errors on pandas/pillow | Use 3.11, not 3.13. See `smartpathai-aiserver/DEBUG.md`. |
| Anything else | Screenshot the error and send it to the Discord channel. |

## Full-stack Docker (optional)

Compose files live under each repo’s `dockerFiles/` and are meant to be copied to the **workspace root** (the folder that contains both repos). See [docker.md](docker.md).

Known gotcha: the AI `Dockerfile` listens on **8080**, while some compose files map `8000:8000`. The documented `docker run -p 8000:8080` path is the one that matches the image. Dev compose overrides the AI command to `--port 8000`.
