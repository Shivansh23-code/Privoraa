# Privoraa — Your Private AI Companion

A privacy-first AI workspace with a vault-themed identity: chat with AI through a single
interface, with smart model routing, study modes for exam prep, and answers grounded in your
own notes — designed so conversations stay yours.

**Live demo:** https://privoraa.vercel.app

> **Status:** the frontend is complete and the **Spring Boot backend is live** (in
> `BackendPrivoraa/`). It runs against **local models via Ollama (fully offline)** by default,
> or **cloud models via OpenRouter** — one config value switches between them. JWT auth,
> MySQL-persisted history, and document-grounded RAG work in both. If the backend isn't
> reachable, the frontend falls back to a local demo engine, and the workspace header shows
> which engine is answering (**Local · offline** / Live / Demo). See
> [Run fully offline with local models](#run-fully-offline-with-local-models-ollama).

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
   │  LlmProvider abstraction  (privoraa.llm.provider = ollama | openrouter)
   ├──► Ollama (http://localhost:11434)  ── llama3.2:3b · qwen2.5-coder · nomic-embed-text · …   [local · offline]
   └──► OpenRouter ──────────────────────── GPT-OSS 120B/20B · Qwen3 Coder · Llama 3.3 · …       [cloud]
```

The browser never sees an API key — every model call is proxied through the backend.
A single config value (`privoraa.llm.provider`) switches between **local Ollama** (private,
offline, free) and **cloud OpenRouter** (bigger models when you need more muscle). If the
backend is unreachable, `src/lib/chatService.js` falls back to a local demo engine, so the UI
code is identical in every world.

## Tech stack

**Frontend:** React 19 · Vite 7 · Tailwind CSS 4 · Zustand · TanStack Query ·
react-markdown + KaTeX + highlight.js · lucide-react ·
Bricolage Grotesque / Manrope / IBM Plex Mono

**Backend:** Java 21 · Spring Boot 3.3 · Spring Security (JWT) · MySQL · Flyway ·
Redis (optional) · SSE streaming · **Ollama (local) / OpenRouter (cloud)** · Docker

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

## Run fully offline with local models (Ollama)

Privoraa can run **entirely on your own machine** — chat and document-RAG against models you
download once and then use offline forever. It uses [Ollama](https://ollama.com) as the local
runtime. Privoraa **curates and manages** models through Ollama's registry; it does **not**
host model weights itself.

> **Internet?** Pulling a model needs internet **once**. After that, **all inference is fully
> offline** — you can unplug the network and chat + RAG keep working.

### 1. Install Ollama + pull the starter models

```powershell
# Install from https://ollama.com/download, then:
ollama pull llama3.2:3b        # default chat model  (~2 GB)
ollama pull nomic-embed-text   # embeddings for RAG  (~0.3 GB)
```

You can also do this **inside the app**: open **Models** in the workspace header → pick a
category → **Install** (with a live progress bar) → **Set active**. If Ollama isn't running,
the app shows a guided setup card.

### 2. Run the backend pointed at local Ollama

`privoraa.llm.provider` defaults to `ollama`, so the local jar already targets
`http://localhost:11434`:

```powershell
copy BackendPrivoraa\.env.example BackendPrivoraa\.env   # LLM_PROVIDER=ollama (default)
.\start.ps1                                              # API (8099) + frontend (5173)
```

Then start chatting — the header shows a **“Local · offline”** badge and the active local
model. Upload a note and answers are grounded on it, all locally.

### Hardware sizing (defaults target an 8 GB RAM / 4 GB VRAM laptop)

| Tier | Meaning | Examples |
|------|---------|----------|
| **Fits** ✓ | Runs comfortably on 8 GB | `llama3.2:3b` (default), `qwen2.5-coder:3b`, `qwen3:4b`, `gemma3:1b`, `nomic-embed-text` |
| **Stretch** ⚠ | Works but heavy | `qwen2.5-coder:7b`, `deepseek-r1:7b`, `qwen3:8b` |
| **Not recommended** ✗ | Too large for 8 GB | anything ≥ 12B |

Defaults stay small on purpose: chat `llama3.2:3b`, embeddings `nomic-embed-text`. The catalog
flags each model **Fits / Stretch / Too large** against your configured RAM budget
(`privoraa.hardware.ram-budget-gb`, default 8). Concurrency is kept low and `keep_alive` short
so the chat and embed models don't both pin memory.

### Running the backend in Docker (host Ollama)

A container can't see the host's `localhost`, so point it at the host gateway and bind Ollama
to all interfaces:

```powershell
setx OLLAMA_HOST "0.0.0.0"     # let the container reach host Ollama; restart Ollama after
docker compose up -d --build   # compose sets OLLAMA_BASE_URL=http://host.docker.internal:11434
```

(Optional) If you ever call Ollama **directly from the browser**, allow your app origin with
`setx OLLAMA_ORIGINS "http://localhost:5173"`. Privoraa proxies through the backend by default,
so this isn't normally needed.

### ⚠️ Changing the embedding model? Re-embed your documents

Each document chunk is stored with the embedding model + dimension that produced it. Vectors
from different models aren't comparable, so retrieval only matches chunks from the **active**
embed model. If you switch embed models (e.g. `nomic-embed-text` → `bge-m3`), re-embed your
existing notes:

```
POST /api/rag/reembed     (authenticated)
```

Until then, older chunks are simply excluded from retrieval — never silently mixed.

### Switch back to the cloud

Set `LLM_PROVIDER=openrouter` (and `OPENROUTER_API_KEY`) to route through OpenRouter's larger
models instead — one value, no code changes.

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
