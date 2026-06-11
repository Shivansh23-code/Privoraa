# Privoraa Backend

Spring Boot service powering the Privoraa AI workspace. It securely proxies OpenRouter behind
JWT auth, with intent-based model routing, SSE token streaming, Redis-backed rate limiting, a
MySQL-persisted chat history, and a RAG pipeline for document-grounded answers.

> The OpenRouter API key lives **only** on the server — it never reaches the browser.

---

## Features

| Area | What it does |
|------|--------------|
| **Auth** | Register / login / refresh / me. JWT access + refresh tokens, BCrypt passwords, stateless. |
| **Chat** | `POST /chat/stream` (SSE: `meta` · `token` · `done` · `error`) and `POST /chat` (non-streaming). |
| **Deep Route** | Heuristic intent → best free model, with a health-aware fallback chain when one is busy. |
| **Study modes** | Six personas (General, Exam Tutor, Code Mentor, Math Solver, Interview Prep, Explain Simply). |
| **Models** | Live OpenRouter catalog, normalized + free-filtered, cached in Redis (1h), static fallback. |
| **Conversations** | Persisted history: list, create, rename, pin, delete — scoped per user. |
| **RAG** | Upload PDF/notes → extract (Tika) → chunk → embed → cosine retrieval → grounded answers with citations. |
| **Rate limiting** | Redis token bucket per user (per-minute + per-day), fails open if Redis is down. |
| **Usage** | Per-user token/request analytics: today, last 7 days, model mix, totals. |
| **Quiz** | Generate MCQs on a topic and grade answers with explanations. |
| **Ops** | Actuator health, OpenAPI/Swagger UI, request-id logging, Resilience4j retries. |

## Tech stack

Java 21 · Spring Boot 3.3 · Spring Security (JWT, jjwt) · Spring Data JPA · MySQL · Flyway ·
Spring Data Redis (Lettuce) · WebClient (reactive) · Resilience4j · Apache Tika · springdoc-openapi ·
Docker.

## Architecture

```
React (Vercel) ──JWT · REST · SSE──> Spring Boot API
                                       ├── Security/JWT filter
                                       ├── Deep Route (intent → model + fallback)
                                       ├── Rate limiter (Redis token bucket)
                                       ├── Cache (Redis: model catalog)
                                       ├── MySQL (users, conversations, messages, documents)
                                       ├── RAG (chunk → embed → cosine retrieve)
                                       └── OpenRouter (one key, server-side) → DeepSeek / Qwen / Llama / Gemini
```

---

## Run it

The API listens on **http://localhost:8099**. First: `cp .env.example .env` and set
`OPENROUTER_API_KEY` (and `DB_PASS` for the local/Docker MySQL).

### Option A — Local MySQL, no Redis (recommended for dev)

You have MySQL running locally; Redis is not required (cache is in-memory, rate-limiting
fails open). The bundled Maven wrapper builds the jar; no global Maven needed.

```powershell
.\run-local.ps1
```

This loads `.env`, builds the jar on first run, and starts with the `local` profile —
which pins the datasource to `localhost:3306/privoraa` (so a stray `DB_URL` env var can't
redirect it) and lets Flyway build the schema on first boot.

### Option B — Zero-setup (in-memory H2, no MySQL/Redis/Docker)

Nothing to install but Java. Data is wiped on restart.

```powershell
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=h2"
```

### Option C — Docker Compose (MySQL + Redis + API, one command)

```bash
docker compose up --build
```

Swagger: http://localhost:8099/swagger-ui.html · Health: http://localhost:8099/actuator/health

### Connecting the frontend

The frontend defaults to this API already. To override:

```
VITE_API_BASE_URL=http://localhost:8099/api/v1
```

The frontend pings `/actuator/health`; once it's UP, it switches from its local demo engine to
this backend automatically.

---

## Configuration

All config is environment-driven (see `.env.example`). Key variables:

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | Enables real model calls. Without it, `/models` serves a static list and chat returns a clear "not configured" error. |
| `JWT_SECRET` | Token signing secret — **must be ≥ 32 bytes** in production. |
| `CORS_ORIGINS` | Comma-separated allowed origins (your Vercel app + local dev). |
| `DB_URL` / `DB_USER` / `DB_PASS` | MySQL connection. |
| `REDIS_HOST` / `REDIS_PORT` | Redis for cache + rate limiting. |
| `EMBEDDING_MODEL` | OpenRouter embedding slug for RAG. Blank → built-in deterministic local embedding. |
| `RATE_LIMIT_PER_MIN` / `RATE_LIMIT_PER_DAY` | Per-user request budgets. |

## API surface (`/api/v1`)

```
POST   /auth/register | /auth/login | /auth/refresh      GET /auth/me
GET    /models?freeOnly=true
POST   /chat/stream  (text/event-stream)                 POST /chat
GET    /conversations            POST /conversations
GET    /conversations/{id}       PATCH /conversations/{id}   DELETE /conversations/{id}
POST   /documents (multipart)    GET /documents             DELETE /documents/{id}
GET    /usage
POST   /quiz/generate            POST /quiz/grade
```

Full, interactive docs at **`/swagger-ui.html`**.

## Honest notes

- **Routing** is intelligent heuristics + catalog lookup + health-aware fallback — not a trained
  neural net. The fallback only switches models *before* the first token to avoid duplicated output.
- **Embeddings**: by default a deterministic local feature-hashing embedding (zero external deps);
  set `EMBEDDING_MODEL` to use a real OpenRouter embedding model. Retrieval is exact cosine over the
  user's chunks (fine at portfolio scale; swap in pgvector/Qdrant for large corpora).
- **Token usage** for streamed replies is estimated (~4 chars/token); non-streaming uses the exact
  counts OpenRouter returns.

## Tests

```bash
mvn test
```

Unit tests cover JWT issue/parse, the intent classifier, and embedding cosine similarity.
