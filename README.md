# Smart-Path-AI (website)

React + Vite frontend and Express/TypeScript backend. This is the student-facing app: auth, chat, PDF upload, knowledge-graph UI, quizzes, and progress.

The graph itself is built by the sibling repo [`smartpathai-aiserver`](https://github.com/VinhPham25/smartpathai-aiserver). **New members: start at [ONBOARDING.md](ONBOARDING.md).**

## Layout

```text
Smart-Path-AI/
├── src/                 # React app
│   ├── pages/           # Home, Login, Signup, Chat, Progress, Profile, About
│   ├── components/      # Navigation, GraphVisualization (React Flow)
│   ├── context/         # Auth + concept progress
│   └── config/api.ts    # VITE_API_BASE_URL helper
├── server/              # Express API (TypeScript)
│   ├── auth/            # Email/password + Google OAuth
│   ├── routes/          # upload, graph, chat, progress, quiz-history
│   ├── controllers/
│   ├── models/          # User, ConceptProgress, QuizHistory
│   └── utils/axiosConfig.ts  # PYTHON_SERVICE_URL client
├── public/              # Static assets (team photos, etc.)
├── dockerFiles/         # Compose templates (copy to workspace root)
├── Dockerfile           # Production image: Express on 8080
└── docker.md
```

Bolt originally generated the Vite app, so a few config files sit at the repo root instead of under `src/`.

## What you can do in the UI

| Route | Auth | What it is |
|-------|------|------------|
| `/` | Public | Landing |
| `/login`, `/signup` | Public | Email/password + Google |
| `/about` | Public | Team |
| `/chat` | Required | Chats, **PDF upload** (SSE progress), graph panel, quiz, graph-grounded conversation |
| `/progress` | Required | Per-concept confidence, topics to review |
| `/profile` | Required | Display name, logout |

Documents live **per chat** (PDF upload), not as a separate library. There is no courses page yet.

**PDF only.** The chat paperclip can show an image icon, but the server rejects non-PDFs (10 MB max). Image *processing* happens inside the AI server when a PDF contains embedded figures — see the AI server README.

## Local run

From this repo:

```bash
npm install
cd server && npm install && cd ..
# Configure Smart-Path-AI/.env and Smart-Path-AI/server/.env
# Start smartpathai-aiserver on :8000 first
npm run dev
```

`npm run dev` runs Express and Vite together via `concurrently`.

| Script | What |
|--------|------|
| `npm run dev` | Server + client |
| `npm run dev:server` | `ts-node` Express |
| `npm run dev:client` | Vite |
| `npm run build` | `vite build` |
| `npm run lint` | ESLint |
| `server`: `npm run start` | `node index.js` (compiled JS) |

Ports: frontend **5173**, Express **4000** (`PORT`). Docker/Cloud Run uses **8080**.

## Environment

Copy the examples (never commit real secrets):

- [`/.env.example`](.env.example) → `Smart-Path-AI/.env`
- [`server/.env.example`](server/.env.example) → `Smart-Path-AI/server/.env`

Express loads `server/.env`, then falls back to the repo-root `.env`.

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_API_BASE_URL` | Vite | Frontend → Express. Local: `http://localhost:4000` |
| `MONGO_URI` | Express | Users, chats, sessions, progress, quiz history |
| `SESSION_SECRET` | Express | Session signing |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Express | Passport Google OAuth |
| `GOOGLE_CALLBACK_URL` | Express | Must match the URI in Google Cloud Console |
| `SERVER_PUBLIC_URL` | Express | Used to build the default callback URL |
| `CLIENT_URL` | Express | Default post-OAuth frontend origin (default `http://localhost:5173`) |
| `AUTH_ALLOWED_ORIGINS` | Express | Exact comma-separated Google login return origins; defaults to `CLIENT_URL` |
| `CORS_ORIGINS` | Express | Comma-separated allowed origins |
| `OPENAI_API_KEY` | Express | Node-side `POST /api/verify-answer` (`gpt-4o-mini`) |
| `PYTHON_SERVICE_URL` | Express | AI server. Local: `http://127.0.0.1:8000` |
| `PORT` | Express | Listen port (default 4000) |
| `NODE_ENV` | Express | Production cookies: `secure` + `sameSite: none` |

Google Cloud Console: add `http://localhost:4000/auth/google/callback` (and the production Cloud Run callback) as authorized redirect URIs.

### Google login from localhost and Vercel using the same GCP backend

The Google buttons send the frontend's current origin to `/auth/google`. Express
checks it against `AUTH_ALLOWED_ORIGINS`, stores it with a random session-bound
OAuth state for ten minutes, and redirects back after Google login. A new login
attempt in the same browser session replaces the previous pending attempt.
Cancelled or failed logins return to that frontend's `/login` page. Invalid,
expired, or reused callbacks are rejected before contacting Google.

On the GCP backend, set the following (replace the example Vercel hostname):

```dotenv
CLIENT_URL=https://your-app.vercel.app
AUTH_ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:5173
CORS_ORIGINS=https://your-app.vercel.app,http://localhost:5173
NODE_ENV=production
```

Use exact origins without paths or trailing slashes; add any other development
port explicitly. Keep `GOOGLE_CALLBACK_URL` pointed at the GCP backend's
`/auth/google/callback` and registered in Google Cloud Console. No localhost Google
callback is needed when both frontends use GCP. Set `VITE_API_BASE_URL` to that
same GCP backend for both frontends, and retain the existing `SESSION_SECRET`
and Mongo session store settings.

Deploy the updated backend and frontend together. Verify both start origins,
including that `/auth/check-auth` recognizes the user after returning. Cross-site
session cookies require a browser that permits them; CORS alone does not override
browser cookie restrictions.

## How requests flow

```text
Browser
  → Express  /upload/process-pdf     → FastAPI POST /process-pdf
  → Express  /api/view-graph         → FastAPI GET  /view-graph
  → Express  /api/generate-conversation-response → FastAPI POST /generate-conversation-response
  → Express  /api/search-graph       → FastAPI GET  /search-graph
  → Express  /api/semantic-search-graph → FastAPI GET /semantic-search-graph
  → Express  GET /api/generate-questions-with-answers → FastAPI POST /questions/{graph_id}
  → Express  POST /api/verify-answer → OpenAI in Node (not the Python /verify-answer)
  → Express  /chat/*                 → Mongo only (not the Python /chat alias)
```

OCR, PyMuPDF image extraction, and Neo4j writes happen **only** in the AI server.

## Express API (high level)

Mounted in `server/index.ts`:

| Prefix | Responsibility |
|--------|----------------|
| `/auth` | Signup, login, logout, `GET /auth/check-auth`, Google OAuth |
| `/upload` | `POST /upload/process-pdf` (SSE), `POST /upload/cancel-processing` |
| `/api` | Graph view/search, conversation, questions, concept progress |
| `/chat` | New/rename/delete chats, messages (stored on `User.chats`) |
| `/api/quiz-history` | Save quizzes, backfill progress |

`GET /` returns `API is running`.

## Mongo models

- **User** — email, optional password, Google id, embedded `chats[]` (`chat_id`, `title`, `graph_id`, `messages[]`)
- **ConceptProgress** — `(user, conceptId)` unique, `confidenceScore` 0–1
- **QuizHistory** — questions + answers per user

## Known local-dev gotchas

1. **Hardcoded Cloud Run URLs.** `Chat.tsx` and `src/config/api.ts` honor `VITE_API_BASE_URL`. Auth, login/signup Google buttons, `ProgressContext`, and graph search in `GraphVisualization.tsx` still call `https://smartpath-node-backend-….run.app`. Local login/progress may hit production until those files use the same helper.
2. **Vite proxy is incomplete.** `vite.config.ts` proxies `/chat`, `/upload`, `/auth`, but most client code uses absolute URLs. Real graph routes are `/api/...`, not `/graph`.
3. **Edit TypeScript, not stale JS.** `server/` contains both `.ts` and compiled `.js`. Dev uses `ts-node` on `.ts`. Production `npm start` runs `index.js`.
4. **No CI / real test suite** in this repo. `server` `npm test` is a stub.

## Docker

See [docker.md](docker.md). Production `Dockerfile` starts Express only (`scripts/start.sh`, port 8080). Live Vite on 5173 is the **dev compose overlay**, not the production image.

## Tests / lint

```bash
npm run lint
```
