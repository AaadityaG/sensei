# Project Team AI Agent

Permission-aware platform that learns approved project context and participates through chat and Microsoft Teams meetings.

## Prerequisites

- [Python 3.12+](https://www.python.org/downloads/)
- [Node.js 18+](https://nodejs.org/)
- Git

---

## Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux
```

Edit `.env` with your API keys (Teams, GitHub, Jira, OpenAI, etc.).

### Frontend

```bash
cd frontend
npm install
```

---

## Run

Open two terminals:

**Terminal 1 — Backend**
```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

Frontend: [http://localhost:5173](http://localhost:5173)
Backend API: [http://localhost:8000](http://localhost:8000)
API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Agent Onboarding Flow

How a project's agent gets set up. This is an **Owner-only, chat-driven**
onboarding that runs once per workspace (and can be re-run to refresh context).
A Member can chat with the agent but cannot onboard or reconfigure it.

### Who can invoke it

- **Project Owner / Manager (PO)** — only the workspace Owner role can start or
  re-run onboarding. Members are blocked at the API and in the UI.

### Where it fits in the journey

Onboarding is the bridge between creating a workspace and the project being
answerable. Members get read/chat access only *after* the Owner finishes it.

```
  SIGN UP ─► CREATE ─► ┌──────────────────────────┐ ─► INVITE ─► CHAT
  (Owner)    WORKSPACE │   AGENT ONBOARDING (PO)   │    TEAM      (Members)
                       │  1. Share project info    │
                       │  2. Agent asks clarifiers │
                       │  3. Connect tools          │
                       │  4. Review & mark ready   │
                       └──────────────────────────┘
```

### The flow (conversational)

1. **Share project info** — In a chat interface, the PO gives the project name,
   description, goals, and uploads/links docs (files, URLs, wiki pages).
2. **Agent asks clarifying questions** — The agent interviews the PO to fill
   gaps: ownership, key terminology, architecture, what "done" means, which
   docs are authoritative, and what's out of scope. Answers become part of the
   project's memory.
3. **Connect tools via connectors** — The PO authorizes project tools through
   connectors. Tokens are stored **encrypted per workspace**; the agent uses
   them to fetch content on the org's behalf.

   | Connector | Auth | What it ingests |
   |---|---|---|
   | GitHub | Personal Access Token | READMEs, code, docs |
   | Jira | API token | Tickets, epics, boards |
   | Confluence | API token | Spaces, pages |
   | File upload / URL | Platform auth | PDF, MD, DOCX, web pages |

4. **Review & mark ready** — The agent shows what it found (files indexed, code
   files, pages crawled). The PO approves or narrows scope, and the workspace is
   marked **ready** so Members can start asking cited questions.

### Where it's best invoked (design note)

- **Trigger:** first successful workspace creation by an Owner — auto-launch the
  onboarding chat before the general chat is unlocked. Keep it **re-runnable**
  from workspace settings so context stays current after sources change.
- **Gate:** enforce Owner-only at both the API (role check on onboarding routes)
  and the UI (hide/disable for Members). Block Member chat until the workspace
  status is `ready`.
- **Reuse the agent brain:** run the same agent with an **onboarding system
  prompt + a small state machine** (collect metadata → clarifying Q&A → connect
  tools → confirm scope → mark ready) rather than a separate service. Stream it
  like normal chat so it feels conversational.

---

## Project Structure

```
hack-agents-for-human/
├── backend/          # FastAPI server
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/         # React + TypeScript + Tailwind + RTK
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── store/
│   │   └── services/
│   ├── package.json
│   └── vite.config.ts
└── PRD.md
```
