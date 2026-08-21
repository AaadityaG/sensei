# CLAUDE.md — Project Team AI Agent

Guidance for AI coding agents working in this repo. Read this first.

## What this project is

A **permission-aware platform** that learns approved project context and answers
questions like a teammate — with **citations**. It ingests sources (docs, code,
tickets, chats), builds a per-workspace knowledge base, and responds through a
web chat UI and (planned) Microsoft Teams meetings.

Built for a hackathon on the [Strands Agents SDK](https://strandsagents.com/).
Teams is an *integration channel*, not the product — the platform owns
onboarding, permissions, project memory, and admin.

Full vision: `README_PROJECT.md` and `PRD.md`. Setup: `README.md`.

## Current state (important — read before coding)

The repo is an **early scaffold**, not the full system described in the docs.
Do not assume documented features exist. What is actually implemented today:

- **Backend** (`backend/main.py`): FastAPI app with only `GET /health` and
  `GET /` (root). Config via `pydantic-settings` (`Settings`) reading `.env`.
  CORS middleware enabled. No auth, DB, agent, tools, or channels yet.
- **Frontend** (`frontend/src/`): React 19 + TS + Tailwind v4 + Redux Toolkit.
  `App.tsx` shows a "Backend Status" card that calls `/health` via RTK Query.
  `services/api.ts` = RTK Query API slice. `store/index.ts` = Redux store.
  No auth, onboarding wizard, or chat UI yet.

Everything else in `README_PROJECT.md` (auth/JWT, workspaces, ingestion pipeline,
Strands agent, vector search, tools, Teams/Slack channels, DB models) is
**planned, not built**. Treat those sections as the roadmap.

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Python 3.12+, FastAPI 0.115, Uvicorn, pydantic 2 / pydantic-settings, httpx |
| Frontend | React 19, TypeScript ~6, Vite 8, Tailwind CSS v4, Redux Toolkit + RTK Query, OxLint |
| Planned agent | Strands Agents SDK, OpenAI (swappable: Bedrock/Anthropic/Ollama) |
| Planned data | SQLite→Postgres (SQLAlchemy), ChromaDB vector store, JWT + bcrypt auth |

## Repository layout

```
backend/
  main.py            # FastAPI app (health + root only, today)
  requirements.txt
  .env.example       # config + placeholder integration keys
  venv/              # local virtualenv (gitignored expected)
frontend/
  src/
    App.tsx          # backend-status demo UI
    main.tsx         # React entry, wraps <Provider store>
    services/api.ts  # RTK Query slice (getHealth)
    store/index.ts   # Redux store
    index.css
  vite.config.ts     # proxies /api -> http://localhost:8000
  package.json
README.md            # setup/run instructions
README_PROJECT.md    # full product/architecture vision
PRD.md               # product requirements document
```

## How the pieces connect (today)

```
Browser (Vite dev, :5173)
   │  fetch "/api/health"
   ▼
Vite proxy  ──rewrite /api → ""──►  FastAPI (:8000)  →  {status, version}
```

The frontend never calls the backend directly — it uses the Vite `/api` proxy
(see `vite.config.ts`), so browser requests are same-origin in dev.

## Planned architecture (from README_PROJECT.md — not yet built)

- **One Strands agent brain**, many channel adapters (web, Teams, Slack).
- **3-layer auth**: JWT login → workspace + role (Owner/Member) → encrypted
  per-workspace source tokens.
- **Agent onboarding (Owner-only)**: a chat-driven, first-run flow where the PO
  shares project info (name, description, docs), the agent asks clarifying
  questions to build project memory, and project tools (GitHub, Jira,
  Confluence) are connected via connectors. Gates Member chat until the
  workspace status is `ready`; re-runnable to refresh context. Reuses the agent
  brain with an onboarding system prompt + a small state machine (collect
  metadata → clarify → connect tools → confirm scope → mark ready). See
  README.md → "Agent Onboarding Flow".
- **Ingestion pipeline**: GitHub / file upload / URL crawl → chunk + embed →
  per-workspace vector store.
- **Agent tools**: `search_docs`, `github`, `upload`, `url_crawl`, `memory`.
- Planned REST endpoints: `/auth/signup`, `/auth/login`, `/api/workspaces`,
  `/api/onboarding/{workspace_id}` (Owner-only, streaming),
  `/api/sources`, `/api/ingest/{id}`, `/api/chat` (streaming), `/webhook/teams`.

## Running it

Backend (terminal 1):
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

Frontend (terminal 2):
```bash
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:8000 · Docs: http://localhost:8000/docs

Lint frontend: `npm run lint` (OxLint). Build: `npm run build`.

## Conventions & guardrails

- **Config**: never hardcode secrets. Backend config flows through `Settings`
  (`.env`). Frontend talks to the backend only via the `/api` Vite proxy.
- **Note**: `.env.example` sets `ALLOWED_ORIGINS=["http://localhost:3000"]` but
  the Vite dev server runs on `:5173`. CORS doesn't bite in dev (proxy makes it
  same-origin), but fix this before any direct browser→backend calls.
- **Testing**: no test suite exists yet. Follow the org rule of TDD + ≥80%
  coverage on new/changed code when adding real features (see the org
  instructions). Keep unit tests hermetic (mock network/IO).
- **Security first**: validate inputs at boundaries, least privilege, no secrets
  in code, keep dependencies current. This platform is permission-aware by
  design — respect source-access boundaries when building ingestion.
- **Docs**: update `README.md` when you change setup/run; keep this file honest
  about what is actually built vs planned.
- **Scope discipline**: build only what's asked; the docs are aspirational, so
  confirm which roadmap slice to implement before scaffolding large subsystems.

## Git identity (this repo)

Commit as the **personal** account, not the org account signed into VS Code.
Repo-local config is already pinned:

- `user.name = bsaisuryacharan`
- `user.email = bsaisuryacharan@gmail.com`

Prefer pushing from the **terminal** (credential helper uses the personal GitHub
account). If using the Source Control GUI, confirm the personal account when
prompted.
