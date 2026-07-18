# Privoraa AI Platform Architecture Audit

**Phase:** 0 — complete architecture audit

**Audit date:** 2026-07-18

**Scope:** React/Vite frontend, Spring Boot backend, persistence, providers, RAG, security, deployment, and tests.
**Behavior changes:** None.

## Executive summary

Privoraa is already more than a one-model chat UI. It is a hybrid application with three execution paths:

1. authenticated browser → Spring Boot → OpenRouter, Gemini, or server-side Ollama;
2. browser → a user's local Ollama instance, without sending the prompt through Privoraa's server;
3. a browser-local sealed vault using Web Crypto, encrypted IndexedDB vectors, and optional local embeddings.

The strongest existing foundations are authenticated SSE chat, per-user relational ownership, heuristic routing with bounded model fallback, provider abstraction, asynchronous document ingestion, source citations, local inference, and an unusually useful client-side privacy vault. The principal architectural constraint is that these capabilities grew as parallel paths rather than behind one request-analysis, routing, policy, and observability pipeline. Conversation state is similarly split: the UI primarily uses persisted Zustand state while the backend independently persists messages. This makes identity, privacy, routing, usage, and recovery behavior hard to reason about consistently.

Phase 1 should introduce a backend request-classification value object and policy boundary without changing the current endpoints or SSE event contract. Before any broad platform expansion, production migrations, upload validation, provider failure tracking, and the client/server conversation source-of-truth decision need explicit treatment.

## System topology

```text
Public/prerendered React pages
            |
Authenticated React workspace -- Zustand/localStorage (optionally AES-GCM)
       |                 |
       |                 +--> browser-local Ollama (/api/chat, /api/embed)
       |                 +--> encrypted IndexedDB vault (notes and memory)
       |
       +--> Spring Boot REST + SSE
                 |-- JWT authentication and ownership checks
                 |-- conversations/messages (JPA)
                 |-- document ingestion/retrieval (Tika + embeddings)
                 |-- heuristic intent/model routing
                 |-- rate limiting (Redis, in-memory fallback)
                 +--> OpenRouter | Gemini | server-side Ollama
                         |
                 MySQL/PostgreSQL/H2 + optional Redis
```

The browser-direct Ollama path is a separate trust boundary: prompts, decrypted vault content, and responses stay on the user's device, but the browser must be able to reach Ollama and Ollama's origin policy must allow the site. Server-side Ollama is operationally local to the backend host, not necessarily local to the end user.

## Current frontend architecture

### Runtime, routes, and rendering

- React 19, React Router 7, Vite 7, Tailwind 4, Zustand 5, and TanStack React Query 5.
- `src/main.jsx` supplies BrowserRouter, QueryClient, theme, admin-auth, and user-auth contexts.
- `src/entry-server.jsx` and `scripts/prerender.mjs` prerender public pages; authenticated/browser-only screens are lazy-loaded to avoid evaluating localStorage-dependent modules during SSR.
- Public routes: `/`, `/plans` (`/pricing` redirects), `/download` (`/offline` redirects), `/signup`, `/register`, and `/login`.
- User route: `/app`; `/dashboard` redirects to it through `UserProtectedRoute`.
- Admin routes: `/admin/login`, `/admin/dashboard`, and `/admin/patterns`.
- Unknown routes render `NotFound`.
- The landing page is decomposed into navbar, hero, trust, promises, how-it-works, vault, comparison, live demo, FAQ, CTA, and footer sections. Static SEO files and prerender metadata exist.

### Chat workspace and message rendering

- `Dashboard` mounts `ChatWorkspace`, which composes responsive sidebar/drawer, `ChatHeader`, model picker, vault lock bar, empty state/message thread, composer, source modal, and local-model catalog.
- `MessageThread` owns stream-follow scrolling; `MessageBubble` renders user/assistant states, errors, citations, copy/regenerate/stop actions, and model metadata.
- `Markdown` uses `react-markdown`, GFM, math/KaTeX, and syntax highlighting. React's render model prevents raw HTML execution because no raw-HTML plugin is enabled, but link protocol policy and a CSP still require explicit security review.
- A single assistant placeholder is appended before generation. `useChat` incrementally updates it and finalizes it once on done, abort, or error.

### Composer and sources

- `Composer` supports text, keyboard submit rules, stop, source toggle, and pasted/selected PNG, JPEG, or WebP images.
- Images are checked at 10 MB client-side and resized before being encoded for chat. Server DTO limits still matter because client validation is bypassable.
- Server documents are uploaded through `DocumentsPanel`/`documentService`; one workspace-level interval polls every 3.5 seconds while any document is `PROCESSING`.
- RAG is opt-in (`useRag`) and is not silently enabled when a source becomes ready.
- The sealed vault separately ingests PDF, text, and images in-browser and supports encrypted notes and a lightweight memory namespace.

### Models, modes, and routing UX

- The unified picker exposes online Auto/models and offline installed/catalog models.
- Model catalogue data uses the sole React Query query (`['models']`, one-hour stale time), with a static fallback.
- Modes are persisted and attached to conversations. Existing modes bias server heuristics (for example code mentor, math solver, exam tutor).
- Browser-direct Ollama is preferred when an explicit offline tag is installed locally. Otherwise the request falls through to the backend with an `ollama` provider selection.
- Assistant messages show model, category, routing reason, and citations, but do not yet expose a normalized provider, local/cloud assertion, fallback history, verification state, latency, or confidence.

### Settings, theme, authentication, and billing

- Settings currently include display name, default mode, system/light/dark theme, and vault management.
- Theme is a context persisted as `privoraa-theme`; system changes update root classes and browser theme color.
- User auth stores access token, refresh token, and normalized user data in localStorage. `apiClient` retries once after a coordinated refresh and clears auth on failure.
- Auth service includes a demo/mock fallback when configured conditions allow it. This keeps a disconnected demo usable but creates an environment-sensitive security/product boundary that must be impossible to enable accidentally in production.
- Admin authentication and admin pattern/waitlist data are localStorage prototypes with a dummy token; they are not production-grade administration.
- Plans use backend billing configuration and Razorpay checkout/verification. User `plan` drives dashboard presentation and backend model-download entitlements. Pricing can be configured as unavailable/free; paid usage policy is not yet integrated into model routing.

### Zustand, React Query, errors, and persistence

- One persisted Zustand store owns conversations/messages, current conversation, model/provider, mode, documents, RAG preference, and transient streaming flags.
- Persisted contract key: `privoraa-chat`. With the vault enabled it migrates to `privoraa-chat-enc`; locking clears sensitive state from memory and suppresses writes.
- The UI does not hydrate conversations/messages from the backend conversation APIs. Client IDs are sent to the backend, which maintains its own copy. Deletion, rename, pin, and truncation in Zustand are therefore not consistently synchronized to relational persistence.
- React Query is only used for the online model list; documents, auth, usage, billing, and conversations use bespoke effects/services.
- Network errors become inline assistant errors, plan-page errors, status banners, or quiet fallbacks depending on the feature. There is no shared typed error taxonomy or error boundary.
- When the backend is unavailable, chat can use a mock streaming engine under demo-fallback rules. Mock answers must remain visibly identified and production-disabled.
- The sealed vault keyfile is in localStorage; its master key exists only in memory. Vault records/vectors are AES-GCM encrypted in IndexedDB. There is no recovery key and no cross-device synchronization.

## Current backend architecture

### Application layers and endpoints

The backend is Spring Boot 3.3.5 on Java 21. Controllers delegate to services, JPA repositories own relational access, configuration records bind environment properties, and provider adapters implement `LlmProvider`.

| Area | Endpoints | Notes |
|---|---|---|
| Auth | `POST /api/v1/auth/register`, `/login`, `/refresh`; `GET /me` | JWT access/refresh tokens, BCrypt passwords |
| Chat | `POST /api/v1/chat`, `/chat/stream` | JSON and named-event SSE variants |
| Conversations | list/create/get/patch/delete under `/api/v1/conversations` | ownership enforced in service queries |
| Models | `GET /api/v1/models` | public normalized-but-limited online catalogue |
| Local models | `/api/models/catalog`, `/installed`, `/download`, `/pull`, `/{tag}`, `/active` | authenticated management and entitlements |
| RAG | upload/list/delete `/api/v1/documents`; `POST /api/v1/rag/retrieve` | per-user documents and retrieval |
| RAG maintenance | `POST /api/rag/reembed` | authenticated, but not clearly admin-role restricted |
| Billing | config, checkout, verify, webhook | webhook is public and signature-verified |
| Usage | `GET /api/v1/usage` | aggregates persisted message token data |
| Quiz | generate and grade | early learning-mode capability |
| Health | `/actuator/health`, `/actuator/info`, `/api/llm/health` | actuator detail suppressed |

### Authentication and authorization

- Stateless Spring Security authenticates Bearer access tokens with `JwtAuthFilter`; async dispatch is re-filtered for SSE.
- Access tokens include subject, email, role, and token type. Refresh is a signed JWT rather than a stored/rotatable session.
- BCrypt protects password hashes. DTO validation constrains auth and chat input.
- Public access is narrowly enumerated for pre-auth, billing configuration/webhook, health/docs, H2 console, and online models. All other endpoints require authentication.
- CORS origins are configured; credentials are allowed and all headers plus common methods are accepted.
- Entity access is generally scoped by authenticated user ID. Documents and conversations use user-qualified queries before mutation/read.
- Method security is enabled, but role annotations are sparse. Maintenance and local-model operational endpoints need explicit role/ownership review.
- CSRF is disabled, appropriate for header-token APIs, but localStorage bearer tokens increase XSS impact.

### Chat, streaming, and error behavior

- `ChatController` extracts `PrivoraaUserDetails` and calls `ChatService`.
- Every server chat first rate-limits, gets/creates the conversation, persists the user message, optionally retrieves RAG, selects provider, routes the model, builds history/system/RAG/image messages, and chooses category-specific sampling.
- SSE uses an unbounded `SseEmitter` and subscribes to provider Flux output on a bounded-elastic scheduler. Events are `meta`, `token`, `done`, and `error`.
- Fallback only occurs if a model fails before emitting output; this correctly avoids concatenating a second model after a partial visible answer. The chain is provider-local, so it does not generally fall from OpenRouter to Gemini or Ollama.
- Disconnect writes are treated as benign, but upstream generation is not explicitly cancelled when the browser disconnects. The zero emitter timeout can retain work indefinitely if provider timeouts fail.
- User messages are saved before provider success. Assistant messages are saved after successful completion. A failed request leaves a user-only turn, and retry semantics can duplicate user messages.
- The global exception handler produces structured `ApiError` objects for REST validation, API, rate-limit, upload, credential, and generic failures. SSE errors use a separate `{message}` payload.
- `RequestIdFilter` adds/echoes an `X-Request-Id`, but IDs are not consistently propagated to provider/tool logs or returned inside all error bodies.

### Routing and rate limiting

- `IntentClassifier` deterministically detects code, math/reasoning, non-Latin text, short/fast, RAG, and mode biases.
- `ModelRouter` selects hardcoded category preferences, filters fallback IDs through OpenRouter's live catalogue, and appends available free models, capped at six.
- Vision uses a curated chain. `OfflineRouter` selects from installed local models and active per-user preference.
- Auto online coding is specially switched to Gemini when configured. This logic sits inside `ChatService`, outside the general router.
- Redis fixed-window counters enforce per-user minute/day request limits; an in-memory fallback preserves availability but is instance-local and resets on restart/scale-out.
- Resilience4j retry protects OpenRouter non-streaming/catalogue calls; streaming has a separate one-retry policy. There is no persisted/provider-wide circuit breaker or cooldown health score.

## Provider integrations

### OpenRouter

- Default hosted provider in production configuration.
- WebClient supports streaming chat, non-streaming chat, public live model catalogue, and optional embeddings.
- API key remains server-side. App URL/title headers identify the application.
- Catalogue results are cached and filtered/normalized by `ModelCatalogService`, with static fallbacks.
- Current normalized descriptors are too shallow for future routing: capability flags, context windows, costs, health, latency, and reliability are incomplete.

### Gemini

- Implements the same provider interface through Google's OpenAI-compatible endpoint.
- Used as a special free coding upgrade for online Auto and has configured primary/fallback model IDs.
- Does not participate in the general cross-provider candidate ranking or health-aware fallback chain.
- Model IDs are configuration defaults and can age independently of availability.

### Ollama

- Server-side `OllamaProvider` handles chat and embeddings against configured Ollama.
- Local catalogue endpoints expose installed models, downloads/pulls/deletes, compatibility metadata, and per-user active model preference.
- Browser-direct integration probes typical loopback URLs and streams directly, which is the strongest privacy path but cannot be centrally observed or guaranteed by server policy.
- “Offline” can therefore mean browser-local or backend-host-local; the UI and audit metadata must distinguish them.

## Current request flow

### Hosted/backend flow

1. Composer validates input/image and `useChat` writes the user and pending assistant messages to Zustand.
2. `chatService` ensures backend health, builds content/model/provider/mode/RAG/conversation/image payload, refreshes auth if needed, and posts to `/api/v1/chat/stream`.
3. Security authenticates JWT; controller supplies user ID.
4. Rate limiter consumes minute/day budget.
5. Backend gets/creates the user's conversation and persists the user message.
6. If requested and ready documents exist, query embedding and cosine retrieval produce context/citations.
7. Provider is resolved; heuristic/category routing builds a model chain. Auto code may switch to Gemini.
8. Prompt builder combines system mode, persisted history, RAG, and optional image.
9. Provider streams. Backend emits metadata then tokens, falling back only before the first token.
10. On completion, backend persists assistant content and token estimates, emits `done`, and frontend finalizes its parallel local message.

### Browser-local flow

1. If an explicit offline model is installed in browser-reachable Ollama, the frontend bypasses Spring Boot chat.
2. When sources are enabled, it prefers decrypted sealed-vault retrieval; otherwise it may call server RAG retrieval.
3. If the vault is unlocked, relevant local memory is added as soft context.
4. The browser builds Ollama messages and streams `/api/chat` directly into Zustand.
5. This path does not persist the turn to the backend database, consume server rate limits, or produce central usage/provider records.

## Current RAG flow

### Server RAG

1. Authenticated multipart upload is limited globally to 20 MB file/25 MB request.
2. A `documents` row is committed as `PROCESSING`; asynchronous processing receives the entire file as a byte array.
3. Apache Tika extracts PDF/DOCX/TXT/Markdown text. `ChunkingService` creates overlapping chunks (default 1,200/150).
4. `EmbeddingService` selects configured/automatic embedding implementation, embeds batches, and stores JSON vectors with model tag and dimension.
5. Document becomes `READY` with count, or `FAILED` with an error. UI polling observes status.
6. Retrieval loads all ready chunks for the user and active embedding model, embeds the query, computes cosine similarity in application memory, applies a low threshold, and returns top four.
7. Context is inserted with numbered chunk labels. Citations contain filename, chunk index, and a short snippet.

This is suitable for small personal corpora but not for large workspaces: retrieval is O(all user chunks), vectors are LONGTEXT JSON, there is no lexical/hybrid index, and no database/vector-store top-k query.

### Browser vault RAG and memory

- Client ingestion extracts content, embeds with either deterministic hash embeddings or browser-reachable local Ollama, encrypts records with AES-GCM, and stores them in IndexedDB.
- Search decrypts the namespace collection, embeds the query, cosine-ranks in-browser, and returns notes or memory.
- Embedding model tags are stored and a reindex operation exists after switching modes.
- Memory is manual/lightweight and lacks scope, provenance, expiry, confidence, workspace isolation, and server synchronization required by the proposed platform.

## Current persistence model

### Relational schema

Flyway migrations V1–V4 define:

- `users`: identity, BCrypt hash, display name, role, plan, creation time;
- `conversations`: user FK, title, mode, pin, timestamps;
- `messages`: conversation FK, role/content, model/category/reason, tokens, cost micros, timestamp;
- `documents`: user FK, filename, processing state/count/error;
- `document_chunks`: document FK, ordinal/content, JSON embedding, embedding model/dimension;
- `user_model_prefs`: one active local model per user.

Ownership FKs cascade on deletion and common ownership/time/model indexes exist. There are no workspaces, refresh-token sessions, provider health, routing decisions, verified sources, tool logs, artifacts, evaluations, or durable scoped memories.

### Environment behavior

- Default/local uses MySQL and Flyway with Hibernate schema mutation disabled.
- H2 uses an in-memory database with Hibernate `ddl-auto=update` and Flyway disabled.
- Production currently also sets `ddl-auto=update` and disables Flyway. This contradicts the migration policy and can make production schema history diverge from V1–V4. It is the highest-priority persistence debt.
- PostgreSQL is included, but migrations use MySQL-specific types/syntax such as `LONGTEXT` and multi-column `ALTER`, so claiming portable Flyway upgrades would be unsafe without dialect validation.

### Browser persistence

- Auth tokens/user, theme, vault keyfile, admin prototypes, and unsealed chat state use localStorage.
- Sealed chat state is an AES-GCM localStorage blob; sealed notes/memory/vectors use encrypted IndexedDB.
- Zustand and server conversation records are independent sources of truth. There is no conflict resolution, migration version in the client state, or cross-device sync.

## Current security boundaries

| Boundary | Existing controls | Gaps / implications |
|---|---|---|
| Browser ↔ API | HTTPS deployment, JWT Bearer, refresh, configured CORS, validation | tokens in localStorage amplify XSS; no refresh rotation/revocation; mock fallback must be production-safe |
| User ↔ relational data | user-qualified service/repository lookups, cascading FKs | role checks and all operational endpoints need systematic authorization tests |
| API ↔ providers | server-held keys, DTO limits, bounded routing chain | raw user/RAG content goes to selected cloud provider; no privacy classification or provider data policy enforcement |
| Upload ↔ parser | request size limits, Tika, async status | no explicit extension/MIME allowlist, magic-byte validation, decompression/page/text limits, malware scan, or hostile-document prompt policy |
| Retrieved content ↔ prompt | labeled context and citations | retrieved text is not explicitly delimited as untrusted; no injection detection or claim-grounding verifier |
| Browser vault | PBKDF2-wrapped random key, AES-GCM, in-memory key, idle lock, encrypted IndexedDB | no recovery; XSS while unlocked can access plaintext/key-mediated APIs; metadata/keyfile remain local; browser backups are not addressed |
| Browser ↔ Ollama | loopback direct path, no cloud hop | Ollama origin exposure is user-managed; website compromise could interact with reachable local service |
| Billing webhook | signature verification | replay/idempotency and event audit need explicit tests/documentation |
| Observability | request ID, sanitized generic 500, actuator detail hidden | no central routing/provider/tool audit; some logs include model/user identifiers; sensitive prompt logging policy is not formalized |

Secrets were not copied into this report. Configuration uses environment substitution, but the repository contains a local `.env`; it is ignored by Git and should remain excluded and periodically secret-scanned.

## Current limitations and technical debt

### Critical / near-term

1. **Production schema drift:** production disables Flyway and enables Hibernate mutation; existing migrations are not reliably authoritative.
2. **Two conversation truths:** Zustand drives the UI while JPA independently stores turns. UI rename/delete/pin/regenerate do not reliably mutate server history, and a regenerated/server retry can duplicate turns.
3. **Privacy is a route choice, not a policy:** there is no classification preventing sensitive/local-only content from reaching a cloud provider when configuration or fallback changes.
4. **Upload hardening:** size limits exist, but file type, parser resource use, MIME spoofing, archive/decompression threats, and prompt injection are not comprehensively controlled.
5. **No cross-provider resilience:** fallback chains generally change model within one provider; no durable health, circuit breaker state, attempt record, or compatible provider failover exists.

### High

- Intent classification is narrow and returns only category/reason; it lacks complexity, freshness, privacy, capabilities, and confidence.
- Routing defaults and vision/Gemini IDs are curated/hardcoded and can become stale.
- SSE has no finite service-level timeout or explicit disconnect cancellation; streaming and REST errors have different contracts.
- RAG scans and deserializes all eligible user vectors for every query and provides no hybrid retrieval or claim verification.
- Citations identify document/chunk but not immutable chunk IDs, relevance score, retrieval time, or exact claim support.
- Redis fallback is not distributed; limits and usage/cost policy are separate. `cost_micros` is not meaningfully populated.
- Refresh tokens are stateless, reusable until expiry, and not revocable/rotated.
- `POST /api/rag/reembed` and operational local-model endpoints need explicit admin/ownership threat review.
- Production provider choice and “offline” semantics are not transparent enough to users.

### Medium

- React Query adoption is partial and service-specific effects duplicate caching/retry/error logic.
- No root error boundary, structured client telemetry, correlation display, or offline state machine.
- Client persisted state is not explicitly versioned/migrated.
- Admin pages are local prototypes rather than backend-authorized administration.
- H2's schema path differs from production migrations, reducing migration test confidence.
- PostgreSQL driver inclusion implies support that current SQL migrations do not establish.
- Tests cover composer input, JWT, intent classification, and embedding cosine only; controller authorization, streaming, persistence, billing, RAG ingestion, provider failures, and frontend workspace behavior are largely untested.
- No CI workflow was found to enforce frontend and backend validation.

## Recommended phased architecture

Preserve `/api/v1` contracts, conversation/document IDs, SSE event names, Zustand persisted fields, billing behavior, and provider adapters while introducing seams behind them.

### Phase 1 — request analysis and privacy gate

- Add immutable intent, complexity, freshness, privacy, and capability types under `ai/classification` (or retain `routing` temporarily with a clear migration boundary).
- Use deterministic rules first and conservative defaults. Run classification before provider resolution and RAG/tool selection.
- Enforce `LOCAL_ONLY` at a policy boundary; never represent backend-host Ollama as end-user-local without explicit topology metadata.
- Add classification/routing metadata to internal context first. Extend SSE/REST only additively after compatibility tests.

### Phases 2–4 — registry, router, and resilient execution

- Normalize all provider models into a cached `ModelDescriptor`; keep current static catalogues as fallback.
- Extract Gemini's special-case routing from `ChatService` into a scored, capability/privacy/cost-aware router.
- Introduce `ProviderAdapter`, availability cache, health tracker, retry policy, and circuit breaker. Record each attempt; never fail over after visible output unless a resumable protocol exists.
- Keep browser-direct Ollama as a distinct `BROWSER_LOCAL` execution target rather than pretending the backend routed it.

### Phases 5–6 — verification and research

- Build policy-selected deterministic verification first (JSON schema, code syntax/build in a later sandbox, RAG support checks).
- Add search/page-reading behind permissioned tools, authoritative source ranking, retrieval timestamps, and citation verification.
- Treat all external/retrieved content as data, never instructions.

### Phases 7–10 — memory, workspaces, repositories, code mode

- Introduce workspace ownership before server memory or repository indexes so every new record has an isolation key.
- Reconcile conversation source of truth: recommended design is server-authoritative metadata/history for authenticated cloud chats, with a versioned encrypted local cache and explicitly local-only conversations that never sync.
- Evolve the existing vault memory into the local implementation of one memory interface; do not upload it implicitly.
- Add repository metadata/indexes and read-only investigation before patch application. Code mode should initially produce plans/artifacts/diffs only.

### Phases 11–18 — sandbox, tools, learning, artifacts, evaluations, observability, security, automation contracts

- Isolate command execution with explicit permissions and immutable audit events before enabling apply actions.
- Make tool results schema-validated and impossible for the model to self-assert.
- Add artifacts/evaluations and privacy-conscious routing observability; feed measured reliability into routing only with minimum sample-size safeguards.
- Complete the formal threat model and security controls before autocoding. Future approval/execution contracts must not imply host shell access.

### Cross-cutting architecture shape

```text
Chat API (existing contracts)
  -> RequestAnalysis
  -> Privacy/Cost/Plan Policy
  -> Workspace + Memory + RAG Retrieval
  -> Tool Planner (permissioned)
  -> Model Registry + Candidate Router
  -> Resilient Provider Executor
  -> Verification/Repair Policy
  -> Persistence + additive SSE metadata
  -> Audit/metrics with redaction
```

Each stage should accept/return immutable typed records and should not reach into controllers or provider-specific DTOs. This permits deterministic unit tests and keeps the existing endpoints stable.

## Database migrations likely required

Migrations should be additive, indexed, user/workspace scoped, and tested on empty and V4 databases. Before V5, production must return to Flyway ownership and the supported database dialect must be decided.

| Likely order | Tables/changes | Key constraints/indexes |
|---|---|---|
| Foundation | `workspaces`; nullable `workspace_id` on conversations/documents then backfill default workspace | unique `(user_id, name)` as appropriate; indexes on owner/workspace/update; FKs with deliberate delete policy |
| Memory | `memory_records` | `(user_id, workspace_id, scope, status)`, expiry and source-message indexes; provenance FKs |
| Routing/providers | `provider_health`, `model_metrics`, `routing_logs`, `routing_attempts` | provider/model/time, request correlation; retention/partition plan; avoid raw prompts |
| Research | `research_runs`, `retrieved_sources`, response/source links | URL hash, domain, retrieved time, workspace/user ownership |
| Tools/security | `tool_executions`, `execution_sessions`, approvals/audit events | immutable correlation, actor, permission, risk, timestamps; sanitized inputs/results |
| Repository | `repositories`, files/symbols/chunks/dependencies/index runs | workspace/revision/path uniqueness, language/symbol indexes, vector-store reference |
| Artifacts/decisions | `artifacts`, artifact versions, `workspace_decisions` | parent/version uniqueness and source conversation links |
| Learning/evaluation | learning profiles/reviews; evaluation cases/results | user/topic/due; model/case/time and sample-size indexes |
| Auth hardening | refresh-token/session families | hashed token, expiry, rotation/revocation/reuse detection indexes |
| Existing data quality | immutable chunk citation IDs; message provider/execution/verification fields | additive nullable columns first; asynchronous backfill |

Do not store large embeddings as JSON LONGTEXT long-term. Choose a supported vector facility (for example PostgreSQL with pgvector, a managed vector database, or a dedicated local index) and retain relational ownership/provenance. Rollback documentation should prefer forward corrective migrations; destructive down migrations are unsafe for user memory and artifacts.

## Capability placement

### Can remain frontend-only

- Visual modes, progressive disclosure, panels, responsive navigation, theme, and presentation preferences.
- Composer ergonomics, local drafts, image resize/preview, copy, local export, and clean metadata expansion.
- Browser-direct Ollama discovery/streaming and sealed-vault storage/search, when explicitly labeled device-local.
- Local-only conversation cache and vault lock controls.
- Diff/diagram rendering and client-side JSON formatting (execution/validation claims must still be honest).

### Require backend support

- Authoritative workspaces and isolation, synced conversations, scoped memory, artifacts, repository metadata, and learning progress.
- Request classification enforcement, cost/plan/privacy policy, normalized registry, cross-provider routing, fallback/circuit breakers, verification records, and provider health.
- Web research orchestration/citations, server RAG, usage/budgets, billing entitlements, model evaluations, and audit/observability.
- Permissioned tools, execution approvals, repository sessions, and any secure sandbox integration.

### Require external services or infrastructure

- Hosted LLMs and embeddings: OpenRouter, Gemini, or future providers.
- Local inference: user/browser Ollama or securely operated backend Ollama.
- Current web search and robust page extraction: a search API plus controlled fetch/reader infrastructure.
- Scalable semantic retrieval: pgvector or a vector service; object storage for original uploads/repository archives.
- Distributed rate limits/caches/queues: Redis and preferably a durable job queue for ingestion/evaluation.
- Secure code execution: isolated containers/microVM service with quotas and network/filesystem policy.
- Billing: Razorpay and reliable webhook delivery; email/notification service if account workflows expand.
- Malware/document scanning and secret scanning may warrant specialist services or isolated workers.

## Risks of free-provider dependence

- Free model IDs, capability claims, and availability change without notice; hardcoded routes decay quickly.
- Shared free capacity produces 429s, cold starts, queueing, variable latency, and provider-specific daily limits.
- Quality and context windows vary; silent provider model substitutions can regress coding or RAG grounding.
- Free offerings may lack tool calling, vision, structured output, embeddings, or stable streaming.
- Catalogue availability does not prove inference availability; health must be based on recent executions.
- Provider terms, retention, regional processing, and training policies can change, affecting privacy guarantees.
- Cascading free fallbacks can multiply latency and requests and still fail simultaneously.
- A “free” route can become billable or use account credit; Privoraa must enforce explicit cost policy server-side and never infer price from an ID suffix alone.
- Local models avoid provider cost/outage but shift burden to user hardware, installation, model downloads, browser origin configuration, and weaker quality on constrained devices.

Mitigations are a live normalized registry, cached last-known-good catalogue, measured health/cooldowns, capability checks, a strict `FREE_ONLY`/`FREE_PREFERRED` policy, maximum attempts, visible limitations, local fallback, configurable budgets, and no silent paid route.

## Phase 0 validation and evidence

- Audited all tracked source/configuration/migration/test files while excluding generated `dist`, `dist-server`, `node_modules`, and backend build output.
- Confirmed the worktree was clean before creating this report.
- No application source, API, schema, persisted client contract, provider behavior, or production configuration was modified.
- `npm run lint`: passed.
- `npm test`: passed, 5/5 tests.
- `npm run build`: passed, including client build, SSR bundle, and prerendering `/`, `/plans`, and `/download`. Vite emitted non-blocking warnings about unused default React imports.
- `BackendPrivoraa\\mvnw.cmd test`: passed, 11/11 tests.
- `BackendPrivoraa\\mvnw.cmd -DskipTests compile`: passed.
- `git diff --check`: passed for tracked changes; this report is the only new path in `git status`.

## Recommended next phase

Proceed with **Phase 1 — Capability and Intent Classification** as a small backend slice. Preserve `IntentClassifier` behavior through compatibility tests, introduce the richer classification types and conservative privacy gate, then add the seven requested classification tests. Do not begin the model registry until Phase 1 builds and tests cleanly and local-only enforcement is demonstrably fail-safe.

## Phase 1 implementation addendum

Phase 1 was implemented on 2026-07-18 as a narrow backend slice. Every REST and SSE chat request is deterministically classified after rate limiting and before conversation persistence, RAG, provider resolution, or routing. A fail-closed privacy policy now rejects server-received `LOCAL_ONLY` prompts for cloud providers and server-side Ollama; only the existing browser-direct Ollama path qualifies as end-user-local execution.

The existing `IntentClassifier`, model routers, provider adapters, endpoint paths, successful REST/SSE shapes, IDs, billing behavior, database schema, and frontend persistence remain unchanged. Detailed rules, compatibility mapping, error behavior, logging policy, and limitations are documented in `docs/request-classification.md`.

## Phase 2 implementation addendum

Phase 2 was implemented on 2026-07-19 as an internal normalized model registry. OpenRouter live catalogue entries, configured Gemini IDs, and server-side Ollama models now share immutable capability-, pricing-, availability-, and topology-aware descriptors. Atomic snapshots start with static/configured fallbacks, refresh providers independently, and retain last-known-good provider data on failure.

The registry is not connected to active model selection, so existing model ordering, Gemini routing, APIs, browser-direct Ollama, chat contracts, and billing behavior remain unchanged. The Phase 1 privacy evaluator gates diagnostic compatibility queries and continues to reject cloud and server-host-local execution for local-only requests. No database migration or MongoDB dependency was added. See `docs/model-registry.md` and `docs/persistence-strategy.md`.
