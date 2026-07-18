# OpenCode Continuation Audit

**Auditor:** OpenCode AI (Principal AI Platform Engineer)
**Audit date:** 2026-07-19
**Branch:** `feature/phase1-rag-gating`
**Phase scope:** Phase 0, 1, 2 — complete and verified

---

## 1. Documents Inspected

| Document | Path | Status |
|---|---|---|
| Architecture audit | `docs/privoraa-ai-platform-audit.md` | Verified — 438 lines, Phase 0/1/2 addenda present |
| Request classification | `docs/request-classification.md` | Verified — 106 lines, matches source |
| Model registry | `docs/model-registry.md` | Verified — 69 lines, matches source |
| Persistence strategy | `docs/persistence-strategy.md` | Verified — 18 lines, matches source |
| Continuation audit | `docs/opencode-continuation-audit.md` | This file |

All four mandatory documents exist, are consistent with each other, and accurately describe the source code.

---

## 2. Current Architecture Confirmed

Three execution paths verified in source:

| Path | Route | Source evidence |
|---|---|---|
| browser → Spring Boot → provider | `ChatController` → `ChatService` → `LlmProviderResolver` | `ChatService.java:84-107` (stream), `ChatService.java:145-174` (REST) |
| browser → browser-local Ollama | Frontend bypasses Spring Boot chat entirely | Frontend `useLocalLlm.js`, browser-direct Ollama enumeration |
| browser-local encrypted vault | IndexedDB + Web Crypto, AES-GCM | Frontend `VaultContext.jsx`, sealed vault retrieval |

Frontend Zustand persists conversations independently of backend JPA (`ChatService.java` persists via `ConversationService`, frontend via `privoraa-chat` / `privoraa-chat-enc` localStorage keys). Verified — no server reconciliation on frontend conversation hydration.

---

## 3. Phase 1 Verification

### 3.1 Classification package exists and is complete

Package: `com.privoraa.ai.classification` — 13 source files:

| File | Type | Verified |
|---|---|---|
| `RequestClassification.java` | Immutable record | Constructor validates confidence [0,1], defensive copies sets/lists, conservativeFallback() static factory |
| `RequestClassifier.java` | Spring `@Component` | Deterministic regex-based rules, no network/LLM calls, preserves legacy `IntentClassifier` as compatibility signal |
| `RequestClassificationInput.java` | Input record | Null-safe defaults for all fields |
| `PrivacyPolicyEvaluator.java` | Spring `@Component` | `evaluate()` and `requireAllowed()` — fail-closed |
| `PrivacyPolicyDecision.java` | Decision record | `allow()`/`deny(code)` factory methods |
| `PrivacyPolicyViolationException.java` | Exception | `CODE = "LOCAL_ONLY_EXECUTION_UNAVAILABLE"`, `USER_MESSAGE` |
| `ExecutionTarget.java` | Enum | `CLOUD_PROVIDER`, `SERVER_SIDE_OLLAMA`, `BROWSER_LOCAL_OLLAMA` |
| `PrivacyLevel.java` | Enum | `PUBLIC`, `PERSONAL`, `SENSITIVE`, `LOCAL_ONLY` |
| `IntentType.java` | Enum | `GENERAL_CHAT`, `CODING`, ..., `PRIVATE_LOCAL` |
| `ComplexityLevel.java` | Enum | `LOW`, `MEDIUM`, `HIGH`, `VERY_HIGH` |
| `FreshnessRequirement.java` | Enum | `STABLE`, `POSSIBLY_STALE`, `CURRENT_INFORMATION_REQUIRED` |
| `Capability.java` | Enum | `TEXT`, `LONG_CONTEXT`, `CODE`, ..., `STRONG_REASONING` |
| `ClassificationReason.java` | Enum | Safe-to-log deterministic signals, 27 values |

### 3.2 Classification runs before persistence, RAG, and provider selection

Verified in `ChatService.java:183-198` (`classifyAndEnforce`):

```java
// stream path (line 97)
classifyAndEnforce(req);
p = prepare(userId, req);   // prepare() persists message + does RAG + routes

// REST path (line 147)
classifyAndEnforce(req);
Prepared p = prepare(userId, req);
```

The `ChatPrivacyBoundaryTest` (`ChatPrivacyBoundaryTest.java:27-54`) proves with `verifyNoInteractions` that a blocked prompt never reaches `ConversationService`, `RagService`, `DocumentService`, or `LlmProviderResolver`.

### 3.3 Privacy enforcement is fail-closed

`PrivacyPolicyEvaluator.java:8-23`:
- `LOCAL_ONLY` + `CLOUD_PROVIDER` → denied
- `LOCAL_ONLY` + `SERVER_SIDE_OLLAMA` → denied  
- `LOCAL_ONLY` + `BROWSER_LOCAL_OLLAMA` → allowed
- Non-local-only → allowed

`ChatService.java:188-190` maps provider to execution target:
- `"ollama".equals(req.providerId())` → `SERVER_SIDE_OLLAMA`
- otherwise → `CLOUD_PROVIDER`

Note: `BROWSER_LOCAL_OLLAMA` is never assigned server-side. The server cannot redirect a received prompt back into the user's browser.

### 3.4 Legacy classifier preserved

`RequestClassifier` injects and consults the legacy `IntentClassifier` as a compatibility signal (`RequestClassifier.java:64-68`, lines 174-187). `IntentClassifier`, `ModelRouter`, `OfflineRouter`, `RouterDefaults` remain unchanged and active.

### 3.5 Known limitation: PRIVATE_LOCAL overrides functional intent

`RequestClassifier.java:117`: When `localOnly` is true, intent is set to `IntentType.PRIVATE_LOCAL` immediately, before any functional intent detection. A coding request with "local only" becomes `PRIVATE_LOCAL` rather than `CODING + PRIVATE_LOCAL`. This matches the Phase 0 audit's documented limitation and should be addressed if Phase 3 needs orthogonal intent/privacy.

### 3.6 SSE and REST error responses for privacy violations

- `GlobalExceptionHandler.java`: handles `PrivacyPolicyViolationException` → HTTP 409 with `ApiError`
- `ChatService.java:299-301`: SSE path catches `PrivacyPolicyViolationException` → emits SSE `error` event with `{message}` payload
- Both directions use the existing error contract shapes (no contract breakage)

---

## 4. Phase 2 Verification

### 4.1 Registry package exists and is complete

Package: `com.privoraa.ai.registry` — 18 source files:

| File | Type | Verified |
|---|---|---|
| `ModelRegistry.java` | Spring `@Service` | `AtomicReference<ModelRegistrySnapshot>`, async+schedule refresh, `compatibleModels()` diagnostic query |
| `ModelDescriptor.java` | Immutable record | Defensive copies, nulls rejected, metadata capped at 20 entries |
| `ModelRegistrySnapshot.java` | Immutable record | `refreshedAt`, `modelsById`, `providerResults` — all defensively copied |
| `ProviderModelAdapter.java` | Interface | `provider()`, `refresh()`, `fallbackModels()` |
| `OpenRouterModelAdapter.java` | Implementation | Live catalogue via `OpenRouterClient.listModels()`, pricing normalization (free=zero, paid=non-zero, unknown=missing) |
| `GeminiModelAdapter.java` | Implementation | Configured IDs only, `PricingTier.UNKNOWN`, `selectable=false` |
| `OllamaModelAdapter.java` | Implementation | Installed tags from `OllamaModelService`, enriched from catalog JSON, `PricingTier.LOCAL` |
| `ModelCapabilityNormalizer.java` | Spring `@Component` | Deterministic name/ID/category-based, provider `supported_parameters` for tools/structured output |
| `ExecutionTargetMapper.java` | Utility | Maps `ExecutionTopology` → `ExecutionTarget` (Phase 1 privacy) |
| `ExecutionTopology.java` | Enum | `CLOUD`, `SERVER_HOST_LOCAL`, `BROWSER_DEVICE_LOCAL` |
| `PricingTier.java` | Enum | `FREE`, `PAID`, `LOCAL`, `UNKNOWN` |
| `ModelAvailability.java` | Enum | `AVAILABLE`, `DEGRADED`, `TEMPORARILY_UNAVAILABLE`, `UNKNOWN` |
| `ModelProvider.java` | Enum | `OPENROUTER`, `GEMINI`, `OLLAMA`, `UNKNOWN` |
| `RegistrySource.java` | Enum | `LIVE_CATALOGUE`, `STATIC_FALLBACK`, `CONFIGURATION`, `LAST_KNOWN_GOOD` |
| `RegistryReasonCode.java` | Enum | 7 reason codes |
| `RegistryRefreshResult.java` | Record | `success()`/`failure()` factory methods |
| `RegistryException.java` | Exception | Constructor only |
| `ModelRegistryProperties.java` | `@ConfigurationProperties` | `enabled`, `refreshInterval` (default PT1H), `refreshTimeout` (default PT10S), `maxMetadataEntries` (capped at 20), `includePaid` (default false) |

### 4.2 Refresh and last-known-good logic

`ModelRegistry.java:78-113` (`refresh()` method):
1. Snapshot previous from AtomicReference
2. Groups current descriptors by provider
3. For each adapter: `CompletableFuture.supplyAsync(adapter::refresh).orTimeout(...)`
4. On timeout/failure: logs `CATALOGUE_TIMEOUT` or `CATALOGUE_UNAVAILABLE`
5. Successful refresh with models → replaces that provider's entry
6. Failed refresh but previous data exists → `LAST_KNOWN_GOOD` retained
7. Failed refresh and no previous data → `STATIC_FALLBACK` from adapter's `fallbackModels()`
8. All descriptors re-indexed into `LinkedHashMap`, new immutable `ModelRegistrySnapshot` set atomically

`ModelRegistry.java:115-125` (`fallbackSnapshot()`): Used at construction before any refresh.

`ModelRegistry.java:127-136` (`applySelectablePolicy()`): Paid models are non-selectable unless `includePaid=true`. Unknown pricing is not treated as free.

### 4.3 Provider adapter behavior verified

| Provider | Source | Pricing | Selectable | Verified |
|---|---|---|---|---|
| OpenRouter | Live catalogue (`OpenRouterClient.listModels()`) | FREE (0/0), PAID (>0), UNKNOWN (missing) | FREE by default; PAID only if `includePaid=true` | `OpenRouterModelAdapter.java:53-75` |
| Gemini | Configuration (`GeminiProperties.codeModel()`, `fallbackModel()`) | UNKNOWN | false | `GeminiModelAdapter.java:36-47` |
| Ollama | `OllamaModelService.installedTags()` + `OllamaCatalogService` | LOCAL | true | `OllamaModelAdapter.java:31-43` |

### 4.4 Registry is diagnostic-only — NOT connected to active routing

Confirmed in `ChatService.java`:
- `ChatService` imports `ModelRouter`, `OfflineRouter`, `IntentClassifier` — NOT `ModelRegistry`
- `ChatService` constructor does not inject `ModelRegistry`
- `ChatService.prepare()` uses `router.resolve()` and `offlineRouter.resolve()` — not `registry.compatibleModels()`
- `ModelRegistry` is not referenced anywhere in `ChatService`

The `compatibleModels()` method on `ModelRegistry` exists for diagnostic queries only (`ModelRegistry.java:61-69`).

### 4.5 Gemini special-case routing still exists

`ChatService.java:229-234`:
```java
if (!offline && "code".equals(routed.category()) && gemini.configured() && isAuto(req.model())) {
    provider = providers.byId("gemini");
    routed = new Routed(gemini.codeModel(), gemini.codeModel(), "code",
            "Routed to Gemini for stronger coding",
            List.of(gemini.codeModel(), gemini.fallbackModel()));
}
```

This remains outside the model registry. The registry registers Gemini descriptors with `PricingTier.UNKNOWN` and `selectable=false`, but this has no effect on active routing.

### 4.6 Browser-direct Ollama remains separate

The backend `OllamaModelAdapter` only enumerates server-side Ollama models (`ExecutionTopology.SERVER_HOST_LOCAL`). Browser-direct Ollama (`ExecutionTopology.BROWSER_DEVICE_LOCAL`) is not aggregated by the backend registry. Verified: `OllamaModelAdapter.java:58-68` only creates descriptors for server-side installed tags.

---

## 5. Active Routing Path

| Step | Implementation | File |
|---|---|---|
| Rate limiting | `rateLimit.check(userId)` | `ChatService.java:88` |
| Classification | `classifyAndEnforce(req)` | `ChatService.java:97` |
| Conversation persistence | `conversations.getOrCreate()` + `conversations.addUserMessage()` | `ChatService.java:202-206` |
| RAG retrieval | `ragService.retrieve()` | `ChatService.java:209` |
| Provider resolution | `resolveProvider(req)` → `LlmProviderResolver` | `ChatService.java:213` |
| Model routing (online) | `router.resolve()` / `router.visionRoute()` (legacy `ModelRouter`) | `ChatService.java:224` |
| Model routing (offline) | `offlineRouter.resolve()` (legacy `OfflineRouter`) | `ChatService.java:220` |
| Gemini special case | `provider = providers.byId("gemini")` (bypasses router) | `ChatService.java:229-234` |
| Prompt building | `promptBuilder.build()` | `ChatService.java:237` |
| Provider execution | `provider.streamChat()` / `provider.chat()` | `ChatService.java:116` / `ChatService.java:155` |
| Fallback | Loop over `routed.chain()` before first token | `ChatService.java:124-128` |

The model registry is NOT in this path. Active routing uses legacy `ModelRouter` with `RouterDefaults`, `IntentClassifier` heuristics, and hardcoded Gemini special case.

---

## 6. Persistence Status

### 6.1 MySQL/JPA remains authoritative

`pom.xml` dependencies verified:
- `spring-boot-starter-data-jpa` (compile)
- `flyway-core` + `flyway-mysql` (compile)
- `mysql-connector-j` (runtime)
- `h2` (runtime, test)
- `postgresql` (runtime)

All database access is through JPA repositories. No MongoDB dependency, configuration, or repository found.

### 6.2 No MongoDB

Confirmed by:
- `pom.xml`: no `spring-boot-starter-data-mongodb` or any mongo driver
- `application.properties`: no MongoDB configuration
- Source grep: zero matches for `MongoTemplate`, `MongoRepository`, `MongoClient`, `@Document`
- The only grep hit for `getDocument()` was `RagService.java:72` accessing the JPA document entity, not MongoDB

### 6.3 Redis is transient

`spring-boot-starter-data-redis` present in `pom.xml`. Used for rate limiting with in-memory fallback. Not authoritative for any durable state.

### 6.4 Flyway production ownership unresolved

`application.properties` matches audit finding: production sets `ddl-auto=update` with Flyway disabled. This remains the highest-priority persistence debt and is unchanged by Phase 1 or 2.

---

## 7. API Compatibility

### 7.1 REST endpoints unchanged

Existing endpoints verified unchanged:
- `POST /api/v1/chat/stream` — SSE streaming, events: `meta`, `token`, `done`, `error`
- `POST /api/v1/chat` — REST non-streaming
- `GET /api/v1/models` — public model catalogue
- All conversation, document, auth, billing, usage, local-models endpoints

### 7.2 SSE contract unchanged

SSE event names, payload shapes, and error contract remain unchanged:
- `ChatContractCompatibilityTest` verifies `ChatRequest` and `ChatResponse` record components
- SSE error still emits `{message}` payload for all error types
- Privacy violations are mapped to existing error channels (HTTP 409 for REST, SSE `error` event for streaming)

### 7.3 No new diagnostic registry endpoint

The model registry has no REST/SSE endpoint. `ModelRegistrySnapshot` is only accessible internally. As documented: "No diagnostic registry endpoint is exposed in Phase 2."

---

## 8. Tests and Validation

### 8.1 Backend test results: 38/38 passing

| Test class | Count | Status | Package |
|---|---|---|---|
| `RequestClassifierTest` | 12 | PASS | `com.privoraa.ai.classification` |
| `PrivacyPolicyEvaluatorTest` | 4 | PASS | `com.privoraa.ai.classification` |
| `ModelRegistryTest` | 3 | PASS | `com.privoraa.ai.registry` |
| `ProviderModelAdapterTest` | 4 | PASS | `com.privoraa.ai.registry` |
| `IntentClassifierTest` | 6 | PASS | `com.privoraa.routing` |
| `ModelRouterCompatibilityTest` | 1 | PASS | `com.privoraa.routing` |
| `ChatPrivacyBoundaryTest` | 1 | PASS | `com.privoraa.chat` |
| `ChatContractCompatibilityTest` | 2 | PASS | `com.privoraa.chat.dto` |
| `JwtServiceTest` | 2 | PASS | `com.privoraa.auth` |
| `EmbeddingCosineTest` | 3 | PASS | `com.privoraa.rag` |

### 8.2 Frontend test results: 5/5 passing

| Test | Count | Status |
|---|---|---|
| Composer input (Enter/Shift+Enter/IME) | 1 | PASS |
| Image validation | 1 | PASS |
| Clipboard image extraction | 1 | PASS |
| Theme defaults | 1 | PASS |
| Source grounding | 1 | PASS |

### 8.3 Build validation

| Command | Status | Notes |
|---|---|---|
| `BackendPrivoraa\mvnw.cmd test` | BUILD SUCCESS | 38 tests |
| `BackendPrivoraa\mvnw.cmd -DskipTests compile` | BUILD SUCCESS | Clean compile |
| `npm run lint` | PASS | No errors |
| `npm test` | PASS | 5/5 |
| `npm run build` | PASS | Client build + SSR bundle + 3 prerendered routes. Non-blocking warnings about unused `default React` imports in 47 files (pre-existing) |

### 8.4 git diff --check

No whitespace errors. LF→CRLF warnings are cosmetic (Windows checkout).

---

## 9. Worktree Status

| Property | Value |
|---|---|
| Branch | `feature/phase1-rag-gating` |
| Ahead of origin | 1 commit |
| Modified (unstaged) | 5 files |
| Untracked | Multiple new directories (`ai/`, `chat/`, `docs/`, new tests) |

### 9.1 Uncommitted changes

| File | Change | Phase |
|---|---|---|
| `PrivoraaApplication.java` | Added `@EnableScheduling` | Phase 2 |
| `ChatService.java` | Added `classifyAndEnforce()`, `RequestClassifier`, `PrivacyPolicyEvaluator`, `friendly()` handling of `PrivacyPolicyViolationException` | Phase 1 |
| `GlobalExceptionHandler.java` | Added `handlePrivacyPolicy()` → HTTP 409 | Phase 1 |
| `ModelCatalogService.java` | Added `public static fallbackModels()` for registry reuse | Phase 2 |
| `application.properties` | Added registry configuration properties | Phase 2 |

### 9.2 Untracked files

- `BackendPrivoraa/src/main/java/com/privoraa/ai/` — Phase 1 + Phase 2
- `BackendPrivoraa/src/test/java/com/privoraa/ai/` — Phase 1 + Phase 2 tests
- `BackendPrivoraa/src/test/java/com/privoraa/chat/` — Phase 1 integration tests
- `BackendPrivoraa/src/test/java/com/privoraa/routing/ModelRouterCompatibilityTest.java` — Phase 1 compatibility
- `docs/` — Phase 0/1/2 documentation

---

## 10. Documentation/Source Discrepancies

### 10.1 Test count variance

The Phase 0 audit (line 426) mentions "seven requested classification tests." The actual `RequestClassifierTest` has **12 test methods**, while `PrivacyPolicyEvaluatorTest` has **4 test methods**. This is additive — more tests were written than initially scoped. No contradiction.

### 10.2 PRIVATE_LOCAL overrides functional intent

`RequestClassifier.java:117` returns `IntentType.PRIVATE_LOCAL` immediately when `localOnly` is detected, bypassing all functional intent detection. The audit correctly flags this: "The current classifier may represent a local-only coding request primarily as PRIVATE_LOCAL instead of retaining CODING as the functional intent." This is a documented limitation, not a bug.

### 10.3 Gemini configured() check on registry descriptor

`GeminiModelAdapter.java:43` adds metadata `"configured": "true"/"false"` based on `properties.configured()`, but the `selectable` field is always `false` regardless. The existing Gemini routing special case in `ChatService` (`gemini.configured()`) is the real gate — the registry metadata is purely diagnostic.

### 10.4 All other claims verified

No other discrepancies found. Documentation accurately describes source code behavior.

---

## 11. Exact Phase 3 Implementation Boundary

### 11.1 What Phase 3 should do

Based on the verified current state, Phase 3 should be strictly scoped to:

1. **Scored candidate routing** — Use `ModelRegistry.compatibleModels(classification)` to rank candidates by capability fit, topology compliance, and pricing policy. The privacy gate (`PrivacyPolicyEvaluator`) remains a mandatory precondition.

2. **Explicit cost policy** — `FREE` / `LOCAL` first, `PAID` only when explicitly opted in. `UNKNOWN` pricing models remain non-selectable. No silent billing.

3. **Registry-to-router integration** — Inject `ModelRegistry` into `ChatService` or a new `ScoredRouter`. Replace or augment the current `ModelRouter.resolve()` call. The legacy `ModelRouter` should remain available under a feature flag for compatibility.

4. **Preservation of privacy gate** — `classifyAndEnforce()` must remain the first gate. `PrivacyPolicyEvaluator` must never be bypassed.

5. **Preservation of legacy fallback ordering** — The existing `ModelRouter` fallback chain behavior must remain available (under feature flag or as default when registry is disabled).

6. **Compatibility mode / feature flag** — `privoraa.ai.registry.routing-enabled=false` should fall back to the exact pre-Phase-3 routing path unchanged.

7. **Additive routing metadata** — Add classification dimensions, registry model ID, pricing tier, and topology to SSE `meta`/`done` events and REST `ChatResponse`. Must be additive: existing fields unchanged, existing frontend must not break.

8. **Gemini special case migration** — Move the `ChatService.java:229-234` Gemini coding special case into the scored router, preserving its behavior when registry routing is enabled. The special case should be active only when the registry includes Gemini as a selectable candidate and cost policy allows it.

### 11.2 What Phase 3 must NOT do

- Cross-provider execution fallback (mistral → gemini mid-stream)
- Circuit breakers or health trackers
- MongoDB or any new database
- Schema migrations
- Frontend redesign
- New REST endpoints
- Changed SSE event names or removed existing fields
- Tool execution
- Web search
- Terminal or autocoding
- Model evaluation feedback loops

### 11.3 Implementation files affected

| File | Change type |
|---|---|
| `ChatService.java` | Inject `ModelRegistry`, replace `ModelRouter.resolve()` with scored router (under flag) |
| `ModelRegistry.java` | Add ranked-compatible-models method (score+sort) |
| `ModelRouter.java` | Keep as fallback (no changes) |
| `OfflineRouter.java` | Keep as fallback for server-side Ollama (no changes) |
| `GlobalExceptionHandler.java` | No changes needed |
| `RouterDefaults.java` | May be deprecated but not removed |
| `ChatResponse.java` / SSE event payloads | Additive fields only |
| `application.properties` | Add `privoraa.ai.registry.routing-enabled=false` (default) |
| New: `ScoredRouter.java` | Orchestrate registry scoring with legacy fallback |

### 11.4 Test additions required

| Test | Coverage |
|---|---|
| `ScoredRouterTest` | Ranking, cost filter, privacy compliance, fallback when disabled |
| `RegistryRoutingCompatibilityTest` | Same output as legacy `ModelRouter` when routing is disabled |
| `ChatServiceRegressionTest` | Classify → scored route → execute path |
| `GeminiMigrationTest` | Gemini special case works through scored router |

---

## 12. Recommended Next Prompt

```
Begin Phase 3 — Scored Registry Routing.

Follow the implementation boundary specified in
docs/opencode-continuation-audit.md section 11.

1. Add privoraa.ai.registry.routing-enabled=false (default) to application.properties
2. Create ScoredRouter that uses ModelRegistry.compatibleModels() with
   capability-fit scoring and cost policy
3. Inject ModelRegistry into ChatService; route through ScoredRouter when
   routing-enabled=true, falling back to existing ModelRouter when false
4. Preserve PrivacyPolicyEvaluator as a mandatory precondition
5. Add classification dimensions and registry metadata to SSE meta/done
   events and ChatResponse (additive only)
6. Move the Gemini coding special case into the scored router path
7. Write ScoredRouterTest, RegistryRoutingCompatibilityTest,
   ChatServiceRegressionTest, GeminiMigrationTest
8. Run mvnw test, npm run lint, npm test, npm run build
9. git diff --check before reporting completion

Do NOT add MongoDB, migrations, circuit breakers, cross-provider
fallback, frontend redesign, new endpoints, or tool execution.
```

---

## Audit Summary

| Check | Status |
|---|---|
| Phase 0 documents exist and match source | ✅ |
| Phase 1 classes exist | ✅ — 13 files |
| Phase 1 privacy enforcement fail-closed | ✅ |
| Phase 1 integrated before persistence/provider | ✅ |
| Phase 2 registry types exist | ✅ — 18 files |
| Registry refresh + last-known-good logic | ✅ |
| Active routing still uses ModelRouter | ✅ — ChatService does not inject ModelRegistry |
| Gemini special-case routing exists | ✅ — ChatService.java:229-234 |
| Browser-direct Ollama remains separate | ✅ — not in backend registry |
| APIs and SSE contracts unchanged | ✅ — ChatContractCompatibilityTest confirms |
| No MongoDB dependency | ✅ — verified in pom.xml, properties, source |
| MySQL/JPA remains authoritative | ✅ |
| Backend tests: 38/38 passing | ✅ |
| Frontend tests: 5/5 passing | ✅ |
| Builds clean | ✅ |
| Worktree known | ✅ — 5 modified + untracked Phase 1/2 additions |
| Documentation matches source | ✅ — minor variance in test count (additive) |
| PRIVATE_LOCAL overrides functional intent | ✅ — documented limitation |
| Exact Phase 3 boundary documented | ✅ — section 11 above |
