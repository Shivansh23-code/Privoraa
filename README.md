# Privoraa — Your Private AI Companion

A privacy-first AI workspace with a vault-themed identity: chat with AI through a single
interface, with smart model routing, study modes for exam prep, and answers grounded in your
own notes — designed so conversations stay yours.

**Live demo:** https://privoraa.vercel.app

> **Status — honest version:** the frontend is complete and fully interactive. Chat answers
> currently stream from a **local demo engine** (mock streaming with markdown/code/LaTeX
> rendering and model-routing preview) so the whole experience works without a backend. The
> **Spring Boot + OpenRouter backend is in active development** — when it's live, the app
> switches over automatically (a Demo/Live pill in the workspace header shows which engine
> is answering).

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
Spring Boot API (in development)
   │  Smart Router · Redis rate limiting · MySQL persistence
   ▼
OpenRouter ──► DeepSeek R1 · Qwen3 Coder · Llama 3.3 · Gemini Flash · …
```

The browser never sees an API key — every model call is proxied through the backend.
Until the backend ships, `src/lib/chatService.js` probes it and transparently falls back to
the local demo engine, so the UI code is identical in both worlds.

## Tech stack

**Frontend:** React 19 · Vite 7 · Tailwind CSS 4 · Zustand · TanStack Query ·
react-markdown + KaTeX + highlight.js · lucide-react ·
Bricolage Grotesque / Manrope / IBM Plex Mono

**Backend (in development):** Java 17 · Spring Boot 3 · Spring Security (JWT) · MySQL ·
Redis · SSE streaming · OpenRouter · Docker · GitHub Actions

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
```

Optional — point at a backend:

```bash
cp .env.example .env # set VITE_API_BASE_URL
```

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
