# Privoraa — Your Private AI Companion

A privacy-first AI workspace with a vault-themed identity: chat with AI through a single
interface, with smart model routing, study modes for exam prep, and answers grounded in your
own notes — designed so conversations stay yours.

**Live demo:** https://privoraa.vercel.app

> **Status:** the frontend is complete and the **Spring Boot + OpenRouter backend is live**
> (in `BackendPrivoraa/`). Run both locally and chat answers stream from real free models via
> OpenRouter, with JWT auth and MySQL-persisted history. If the backend isn't reachable, the
> frontend transparently falls back to a **local demo engine** so the UI still works — a
> Demo/Live pill in the workspace header shows which engine is answering.

---

## What's inside

- **Landing page** — the "vault" design: ink/teal/violet palette, interactive demo chat with
  seal animations, an unsealable memory-vault showcase, comparison table, and FAQ
- **Chat workspace** (`/app`) — multi-model chat with streaming UX, stop & regenerate,
  markdown + highlighted code + KaTeX math, conversation history (pin/rename/search),
  six study personas, document upload with "My notes" grounding, and a usage panel
- **Deep Route auto-routing** — intent heuristics (code / math / general / multilingual)
  pick the best model, with a fallback chain
- **Auth pages** — vault-styled login/signup (mock auth today, real JWT with the backend)

## Architecture

```
React + Vite (Vercel)
   │  JWT · REST · SSE
   ▼
Spring Boot API (http://localhost:8099)
   │  Smart Router · rate limiting · MySQL persistence
   ▼
OpenRouter ──► GPT-OSS 120B/20B · Qwen3 Coder · Llama 3.3 · Gemma 4 · …
```

The browser never sees an API key — every model call is proxied through the backend.
Until the backend ships, `src/lib/chatService.js` probes it and transparently falls back to
the local demo engine, so the UI code is identical in both worlds.

## Tech stack

**Frontend:** React 19 · Vite 7 · Tailwind CSS 4 · Zustand · TanStack Query ·
react-markdown + KaTeX + highlight.js · lucide-react ·
Bricolage Grotesque / Manrope / IBM Plex Mono

**Backend:** Java 21 · Spring Boot 3.3 · Spring Security (JWT) · MySQL · Flyway ·
Redis (optional) · SSE streaming · OpenRouter · Docker

## Run locally

### Full stack (frontend + backend), one command

Prerequisites: Java 21, Node 18+, MySQL running locally. Set the backend key once:

```powershell
copy BackendPrivoraa\.env.example BackendPrivoraa\.env   # set OPENROUTER_API_KEY + DB_PASS
.\start.ps1                                              # opens API (8099) + frontend (5173)
```

### Frontend only (uses the local demo engine if no backend)

```bash
npm install
npm run dev          # http://localhost:5173
```

The frontend targets `http://localhost:8099/api/v1` by default (override via
`VITE_API_BASE_URL` in `.env`). See `BackendPrivoraa/README.md` for backend run options
(local MySQL, zero-infra H2, or Docker Compose).

## Project structure

```
src/
├── pages/             # Landing, Login, SignUp, Dashboard (/app), NotFound
├── features/
│   ├── landing/       # Vault-design landing (Navbar, Hero, LiveDemo, Vault, Compare, Faq, …)
│   └── chat/          # ChatWorkspace, MessageThread, Composer, ModelPicker, ModeSelector, …
├── lib/               # apiClient, chatService (SSE + mock fallback), router, models, modes
├── store/             # Zustand chat store (localStorage-persisted)
└── context/           # auth + theme (dark-only ink theme)
```

---

Built by [Shivansh Tiwari](https://github.com/Shivansh23-code) ·
[Repository](https://github.com/Shivansh23-code/Privoraa)
