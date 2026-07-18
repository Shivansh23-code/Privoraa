# Phase 3 — Scored Registry Routing Implementation Plan

**Status:** Planning only — no code written  
**Based on:** Phase 0–2 verified architecture (`docs/opencode-continuation-audit.md`)  
**Scope:** Scored candidate routing over `ModelRegistry.compatibleModels()`  
**Branch target:** `feature/phase1-rag-gating`

---

## 1. Architecture Overview

### 1.1 Current routing flow (unchanged baseline)

```
ChatService.stream() / chat()
  → rateLimit.check()
  → classifyAndEnforce()      // Phase 1 — privacy gate, returns RequestClassification
  → prepare()
      → conversations.getOrCreate() + addUserMessage()
      → ragService.retrieve()
      → resolveProvider()      // "ollama" | "openrouter" | "gemini"
      → [offline? OfflineRouter : ModelRouter.resolve/visionRoute]
      → [Gemini special-case overwrite]
      → promptBuilder.build()
  → attempt() / direct call
      → provider.streamChat() / .chat()
      → fallback within chain before first token
```

Key insight: `classifyAndEnforce()` already returns `RequestClassification`, but both callers (`stream()` line 97, `chat()` line 147) discard the return value. Phase 3 must capture it and thread it through to the router.

### 1.2 Target routing flow (when registry routing is enabled)

```
ChatService.stream() / chat()
  → rateLimit.check()
  → classification = classifyAndEnforce()   // captured, not discarded
  → prepare(classification)                 // classification threaded in
      → conversations.getOrCreate() + addUserMessage()
      → ragService.retrieve()
      → resolveProvider()
      → if offline: OfflineRouter (unchanged)
      → else if routing-enabled && isAuto(model):
          → scoredRouter.resolve(classification, req, provider)
        else:
          → ModelRouter (unchanged legacy path)
      → [no separate Gemini special-case — merged into ScoredRouter]
      → promptBuilder.build()
  → attempt() / direct call (unchanged)
```

When `privoraa.ai.registry.routing-enabled=false` (the default), the entire `prepare()` method behaves exactly as it does today.

---

## 2. New Files

### 2.1 `ScoredRouter.java`

**Package:** `com.privoraa.routing` (alongside `ModelRouter`, `OfflineRouter`)

**Purpose:** Consumes `RequestClassification` + `ModelRegistry.compatibleModels()` to produce an ordered candidate chain, respecting cost policy, capability fit, pricing, topology, and the existing Gemini coding upgrade.

**Dependencies injected:**
- `ModelRegistry registry`
- `ModelRegistryProperties registryProperties` (for `includePaid`, `enabled`)
- `GeminiProperties geminiProperties` (for `configured()`, `codeModel()`, `fallbackModel()`)
- `ModelCatalogService catalog` (for model name lookups in `nameOf()`)

**Public API:**

```java
@Component
public class ScoredRouter {

    /** Primary entry point: rank compatible models and return the best chain. */
    public ScoredRoutingResult resolve(
            RequestClassification classification,
            ChatRequest req,
            LlmProvider resolvedProvider
    );

    /** True when this router is active for the request. */
    public boolean appliesTo(ChatRequest req, LlmProvider provider);
}
```

**`appliesTo()` rules:**
- `registry.properties().enabled()` AND `registryProperties.routingEnabled()` must be `true`
- Provider must be a cloud provider (`!provider.id().equals("ollama")`)
- Request model must be auto (`isAuto(req.model())`)
- Explicit model picks always go through legacy `ModelRouter` unchanged
- Browser-direct Ollama path is frontend-side; never reaches Spring Boot

### 2.2 `ScoredRoutingResult.java`

**Package:** `com.privoraa.routing`

```java
public record ScoredRoutingResult(
    String registryId,           // e.g., "openrouter:qwen/qwen3-coder:free"
    String providerModelId,      // the model slug to pass to the provider
    String displayName,          // human-readable name
    String category,             // e.g., "code", "general"
    String reason,               // routing justification
    List<String> chain,          // ordered fallback chain (model IDs)
    ModelProvider provider,      // OPENROUTER, GEMINI, OLLAMA
    PricingTier pricingTier,     // FREE, LOCAL, PAID
    ExecutionTopology topology,  // CLOUD, SERVER_HOST_LOCAL
    String registrySource        // LIVE_CATALOGUE, LAST_KNOWN_GOOD, etc.
) {
    public Routed toRouted() {
        return new Routed(providerModelId, displayName, category, reason, chain);
    }
}
```

The `toRouted()` method bridges to the existing `Routed` record so `ChatService.Prepared` can continue to store a `Routed` without structural changes.

### 2.3 `ModelRegistryScoringWeights.java` (optional constants holder)

**Package:** `com.privoraa.ai.registry`

```java
public final class ModelRegistryScoringWeights {
    // Scoring buckets (not weights — we use tiered sort keys)
    public static final int COST_TIER_FREE = 100;
    public static final int COST_TIER_LOCAL = 80;
    public static final int COST_TIER_PAID = 40;
    public static final int COST_TIER_UNKNOWN = 0;  // excluded unless includePaid=true

    // Capability overlap bonus per matched capability
    public static final int CAPABILITY_MATCH_BONUS = 10;

    // Source freshness
    public static final int SOURCE_LIVE = 10;
    public static final int SOURCE_LAST_KNOWN_GOOD = 5;
    public static final int SOURCE_STATIC_FALLBACK = 2;
    public static final int SOURCE_CONFIGURATION = 1;
}
```

Can be inlined into `ScoredRouter` if weights remain simple. Expose as constants only if Phase 4+ needs configuration.

---

## 3. Modified Files

### 3.1 `ChatService.java`

**Current lines 95-98 (stream) and 145-148 (REST):**

```java
// stream (current)
classifyAndEnforce(req);
p = prepare(userId, req);

// REST (current)
classifyAndEnforce(req);
Prepared p = prepare(userId, req);
```

**Change:**

```java
// stream (Phase 3)
RequestClassification classification = classifyAndEnforce(req);
p = prepare(userId, req, classification);

// REST (Phase 3)
RequestClassification classification = classifyAndEnforce(req);
Prepared p = prepare(userId, req, classification);
```

**Current `prepare()` signature (line 201):**
```java
private Prepared prepare(String userId, ChatRequest req)
```

**Change:**
```java
private Prepared prepare(String userId, ChatRequest req, RequestClassification classification)
```

**Current lines 219-234 (routing block within `prepare()`):**
```java
Routed routed = offline
    ? offlineRouter.resolve(...)
    : (req.hasImage()
        ? router.visionRoute(req.content())
        : router.resolve(req.model(), req.content(), mode, useRag));

if (!offline && "code".equals(routed.category()) && gemini.configured() && isAuto(req.model())) {
    provider = providers.byId("gemini");
    routed = new Routed(gemini.codeModel(), gemini.codeModel(), "code",
            "Routed to Gemini for stronger coding",
            List.of(gemini.codeModel(), gemini.fallbackModel()));
}
```

**Change to:**
```java
Routed routed;
if (offline) {
    routed = offlineRouter.resolve(req.model(), req.content(), mode, useRag, req.hasImage(),
            activeModel.activeFor(userId));
} else if (scoredRouter.appliesTo(req, provider)) {
    ScoredRoutingResult scored = scoredRouter.resolve(classification, req, provider);
    routed = scored.toRouted();
    // Provider may be updated if the top candidate is from a different provider
    // (e.g., Gemini promoted for coding)
    LlmProvider candidateProvider = providers.byId(scored.provider().name().toLowerCase());
    if (!candidateProvider.id().equals(provider.id()) && candidateProvider.id().equals("gemini")) {
        provider = candidateProvider;
    }
} else {
    routed = req.hasImage()
        ? router.visionRoute(req.content())
        : router.resolve(req.model(), req.content(), mode, useRag);
}
```

**New constructor dependency:**
```java
private final ScoredRouter scoredRouter;
// added to constructor param list
```

**Inject:**
- `ScoredRouter` — new
- Remove `GeminiProperties`? No — keep it for the fallback path when `routing-enabled=false`

### 3.2 `application.properties`

Add after the existing registry block (line ~118):

```properties
# Phase 3: scored registry routing. When true, ModelRegistry.compatibleModels()
# drives auto model selection for cloud providers. When false (default), the
# exact pre-Phase-3 ModelRouter + Gemini special case logic is preserved.
privoraa.ai.registry.routing-enabled=${MODEL_REGISTRY_ROUTING_ENABLED:false}
```

### 3.3 `ModelRegistryProperties.java`

Add field:

```java
@ConfigurationProperties(prefix = "privoraa.ai.registry")
public record ModelRegistryProperties(
        boolean enabled,
        Duration refreshInterval,
        Duration refreshTimeout,
        int maxMetadataEntries,
        boolean includePaid,
        boolean routingEnabled       // NEW — added here
) {
    public ModelRegistryProperties {
        // existing defaults...
        // routingEnabled defaults to false from @ConfigurationProperties binding
    }
}
```

### 3.4 `ModelRegistry.java`

Add method for ranked results (scoring lives in `ScoredRouter`, but the registry provides the sort-compatible view):

```java
/**
 * Phase 3: sorted compatible models with scoring metadata.
 * The caller (ScoredRouter) uses this to build the candidate chain.
 */
public List<ScoredCandidate> rankedCompatibleModels(
        RequestClassification classification,
        boolean includePaid
) {
    return compatibleModels(classification).stream()
            .map(m -> new ScoredCandidate(m, score(m, classification)))
            .sorted(Comparator.comparingInt(ScoredCandidate::score).reversed())
            .toList();
}

private int score(ModelDescriptor m, RequestClassification classification) {
    int score = 0;
    // Cost tier: FREE > LOCAL > PAID > UNKNOWN
    score += switch (m.pricingTier()) {
        case FREE -> 100;
        case LOCAL -> 80;
        case PAID -> 40;
        case UNKNOWN -> 0;
    };
    // Capability overlap: count matched required capabilities
    long matched = classification.requiredCapabilities().stream()
            .filter(c -> c != Capability.WEB_SEARCH && c != Capability.RAG)
            .filter(m.capabilities()::contains)
            .count();
    score += (int) matched * 10;
    // Source freshness
    score += switch (m.source()) {
        case "LIVE_CATALOGUE" -> 10;
        case "LAST_KNOWN_GOOD" -> 5;
        default -> 2;
    };
    // Context window bonus (if adequate for estimated needs)
    if (m.contextWindow() != null && m.contextWindow() >= 8000) {
        score += 5;
    }
    return score;
}
```

### 3.5 `ScoredCandidate.java` (new inner type or standalone record)

```java
public record ScoredCandidate(ModelDescriptor descriptor, int score) {}
```

Place in `com.privoraa.ai.registry` package.

### 3.6 SSE meta/done payloads and `ChatResponse.java`

**Additive fields only** — no existing fields removed or renamed:

| Payload | Existing fields | New additive fields (Phase 3) |
|---|---|---|
| SSE `meta` | conversationId, model, category, reason, citations | registryId, pricingTier, topology, intent, privacy |
| SSE `done` | model, promptTokens, completionTokens, citations | registryId, pricingTier, topology |
| `ChatResponse` | conversationId, model, category, reason, message, promptTokens, completionTokens, citations | registryId, pricingTier, topology |

**Implementation:**

`ChatService.metaPayload()`:
```java
private Map<String, Object> metaPayload(String modelName, Prepared p, ScoredRoutingResult scored) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("conversationId", p.conversationId());
    m.put("model", modelName);
    m.put("category", p.routed().category());
    m.put("reason", p.routed().reason());
    m.put("citations", p.rag().citations());
    // Phase 3 additive fields (null-safe, absent when legacy routing)
    if (scored != null) {
        m.put("registryId", scored.registryId());
        m.put("pricingTier", scored.pricingTier().name());
        m.put("topology", scored.topology().name());
    }
    return m;
}
```

`ChatResponse`:
```java
public record ChatResponse(
        String conversationId,
        String model,
        String category,
        String reason,
        MessageDto message,
        int promptTokens,
        int completionTokens,
        List<Citation> citations,
        // Phase 3 additive (nullable, absent when legacy routing)
        String registryId,
        String pricingTier,
        String topology
) {
    // Existing 8-param constructor preserved via @JsonIgnore or factory
}
```

The frontend ignores unknown JSON keys — additive fields will not break the existing UI.

---

## 4. Scoring Dimensions (Formal)

### 4.1 Hard constraints (applied by `compatibleModels()`)

| Constraint | Source | Behaviour |
|---|---|---|
| `selectable == true` | `ModelDescriptor.selectable()` | `UNKNOWN` pricing → `selectable=false`. `PAID` → `false` unless `includePaid=true` |
| Capability superset | `ModelDescriptor.capabilities()` | Must contain every required capability except `WEB_SEARCH` and `RAG` |
| Privacy policy | `PrivacyPolicyEvaluator.evaluate()` | `LOCAL_ONLY` rejects `CLOUD` and `SERVER_HOST_LOCAL`; allows `BROWSER_DEVICE_LOCAL` |
| Provider configured | Provider-level check | Gemini models only appear when `gemini.configured()` |

### 4.2 Soft ranking (applied by `rankedCompatibleModels()`)

Sort keys, evaluated in order (primary → secondary → tertiary):

| Priority | Dimension | Values | Comparator |
|---|---|---|---|
| 1 | Pricing tier | FREE (100) > LOCAL (80) > PAID (40) > UNKNOWN (0) | Descending |
| 2 | Capability overlap | Count of required capabilities matched | Descending |
| 3 | Source freshness | LIVE_CATALOGUE (10) > LAST_KNOWN_GOOD (5) > STATIC_FALLBACK (2) | Descending |
| 4 | Context window adequacy | ≥ 8000 tokens (+5) | Descending |
| 5 | Topology preference | SENSITIVE privacy prefers local; WEB_SEARCH prefers cloud | Match bonus |
| 6 | Tiebreaker | Alphabetical by display name | Ascending |

### 4.3 Gemini promotion (special case)

If and only if:
- `geminiProperties.configured() == true`
- `request.model` is auto / null / blank (not an explicit pick)
- `classification.intent() == CODING` (or capabilities contain `CODE`)
- Gemini is not the current provider (i.e., user didn't already pick it)

Then: **Promote the Gemini code model to rank 0** (first in the chain). The existing Gemini fallback model becomes the second entry in the fallback chain. This exactly preserves pre-Phase-3 Gemini behavior.

Implementation in `ScoredRouter.resolve()`:

```java
if (geminiProperties.configured() && isAuto(req.model())
        && classification.requiredCapabilities().contains(Capability.CODE)) {
    // Check if Gemini is already top-ranked by normal scoring
    boolean geminiIsAlreadyTop = candidates.stream()
            .findFirst()
            .map(c -> c.descriptor().provider() == ModelProvider.GEMINI)
            .orElse(false);
    if (!geminiIsAlreadyTop) {
        // Create Gemini candidate and insert at top
        ModelDescriptor geminiDesc = registry.find("gemini:" + geminiProperties.codeModel()).orElse(null);
        if (geminiDesc != null) {
            // Override selectable for this specific routing decision
            candidateList.add(0, new ScoredCandidate(geminiDesc, 999));
        }
    }
}
```

Note: The Gemini `ModelDescriptor` in the registry has `selectable=false` and `PricingTier.UNKNOWN`. `compatibleModels()` filters it out. The `ScoredRouter` must handle this by either:
- (a) Bypassing `compatibleModels()` for the Gemini check and adding it manually; or
- (b) Adding a special `gemini-compatible` flag to `ModelRegistryProperties`

**Recommendation: (a)** — Keep Gemini promotion as an explicit override in `ScoredRouter`, exactly mirroring the current `ChatService` special case. The registry remains pure; the router contains the business rule.

### 4.4 Fallback chain construction

| Position | Source | Behaviour |
|---|---|---|
| 0 (primary) | Top-ranked `ScoredCandidate` | The highest-scoring compatible model |
| 1..N (fallback) | Next `ScoredCandidate`s, max 6 total | Same provider preferred first, then cross-provider. Capped to match existing `ModelRouter` behavior (max 6). |

The fallback chain does NOT cross execution topology boundaries: a `CLOUD` primary gets cloud-only fallbacks. Provider isolation within a topology is fine (OpenRouter → Gemini → other OpenRouter).

---

## 5. Feature-Flag Strategy

### 5.1 Configuration

| Property | Default | Effect when `true` | Effect when `false` |
|---|---|---|---|
| `privoraa.ai.registry.enabled` | `true` | Registry refreshes (startup + hourly) | Registry is inert, no refresh |
| `privoraa.ai.registry.routing-enabled` | `false` | ScoredRouter used for cloud auto-routing | Exact pre-Phase-3 routing |
| `privoraa.ai.registry.include-paid` | `false` | Paid models selectable | Paid models excluded |

### 5.2 Migration states

| State | Config | Behaviour |
|---|---|---|
| **Phase 2 compatibility** (default) | `enabled=true, routing-enabled=false` | Registry refreshes and is observable; routing unchanged |
| **Phase 3 dry-run** | `enabled=true, routing-enabled=false, include-paid=false` | Registry refreshed; routing logs what ScoredRouter would pick but uses legacy path |
| **Phase 3 active** | `enabled=true, routing-enabled=true, include-paid=false` | ScoredRouter drives auto-routing; legacy ModelRouter as fallback |
| **Phase 3 + paid** | `enabled=true, routing-enabled=true, include-paid=true` | Paid models may appear in ranked candidates |
| **Total fallback** | `enabled=false` | Nothing happens; runtime as pre-Phase-2 |

### 5.3 Dry-run logging

When `routing-enabled=false`, `ScoredRouter` logs what it *would* have chosen at DEBUG level:

```
DEBUG c.p.routing.ScoredRouter — Dry-run: would route intent=CODING
  candidate[0]=openrouter:qwen/qwen3-coder:free score=125 pricing=FREE
  candidate[1]=gemini:gemini-2.0-flash score=999 pricing=UNKNOWN (promoted)
```

This allows operators to validate routing decisions before flipping the flag.

---

## 6. Compatibility Strategy

### 6.1 Legacy ModelRouter preservation

`ModelRouter` is kept untouched. When `routing-enabled=false`, `ChatService.prepare()` calls `router.resolve()` and `router.visionRoute()` exactly as it does today. The Gemini special-case `if` block remains active in this path.

When `routing-enabled=true`, the Gemini special-case `if` block is bypassed entirely — `ScoredRouter` handles it internally.

### 6.2 OfflineRouter preservation

`OfflineRouter` is never touched. Server-side Ollama routing always goes through `OfflineRouter`, regardless of the `routing-enabled` flag.

### 6.3 Browser-direct Ollama

Unchanged. The frontend bypasses Spring Boot entirely. The backend never sees these requests.

### 6.4 Explicit model picks

When the user explicitly picks a model (not "auto"), routing goes through legacy `ModelRouter` and the existing catalogue lookup. The scored router only activates for `"auto"` picks. This preserves explicit user choice.

### 6.5 REST and SSE contract compatibility

- All existing fields retained
- New fields are additive and nullable (null when not present)
- Frontend ignores unknown keys — no frontend changes required
- `ChatContractCompatibilityTest` updated to check that existing component names are unchanged

### 6.6 Fallback chain ordering

When `routing-enabled=false`: exact same `RouterDefaults.GLOBAL_FALLBACK` chain.

When `routing-enabled=true`: scored fallback chain. The primary model is the highest-scored candidate. Fallbacks are the next highest-scored candidates, cap at 6, same topology.

---

## 7. Gemini Special Case Migration

### 7.1 Current behavior (pre-Phase-3)

```java
// ChatService.java:229-234
if (!offline && "code".equals(routed.category()) && gemini.configured() && isAuto(req.model())) {
    provider = providers.byId("gemini");
    routed = new Routed(gemini.codeModel(), gemini.codeModel(), "code",
            "Routed to Gemini for stronger coding",
            List.of(gemini.codeModel(), gemini.fallbackModel()));
}
```

### 7.2 Phase 3 behavior (when routing-enabled=true)

The Gemini promotion logic moves into `ScoredRouter.resolve()`. The `ChatService` `if` block becomes dead code when routing is enabled (guarded by `!scoredRouter.appliesTo(...)`). When routing is disabled, the existing `if` block remains active.

### 7.3 Behavioural equivalence verified

| Scenario | Pre-Phase-3 | Phase 3 (enabled) | Match |
|---|---|---|---|
| coding + auto + gemini configured | Routes to Gemini codeModel | ScoredRouter promotes Gemini to rank 0 | ✅ |
| coding + explicit model | Routes to explicit model via ModelRouter | ScoredRouter not invoked (appliesTo=false) | ✅ |
| coding + auto + gemini NOT configured | Routes to OpenRouter free tier | ScoredRouter ranks OpenRouter options | ✅ |
| general + auto | Routes to OpenRouter free-tier general | ScoredRouter ranks OpenRouter general options | ✅ |
| non-auto + coding | Explicit pick honored | Explicit pick honored (appliesTo=false) | ✅ |

### 7.4 Gemini registry descriptor unchanged

`GeminiModelAdapter` continues to register descriptors with `PricingTier.UNKNOWN` and `selectable=false`. The `ScoredRouter` bypasses `compatibleModels()` for the Gemini promotion case. This means the registry remains honest about Gemini not having pricing — the business rule (Gemini is effectively free in this app) lives in the router.

---

## 8. Test Matrix

### 8.1 New tests to add

All tests in `com.privoraa.routing` package (new or existing):

| Test class | Type | Count | Coverage |
|---|---|---|---|
| `ScoredRouterTest` | Unit | ~15 | Ranking algorithm, cost filter, capability overlap, context window bonus, source freshness, tiebreaker, Gemini promotion |
| `RegistryRoutingCompatibilityTest` | Unit | ~8 | Same output as legacy ModelRouter when routing-disabled; same output when routing-enabled but registry empty; same output for explicit picks |
| `ChatServiceScoredRoutingTest` | Integration | ~6 | Full path: classify → scored route → execute (mocked provider); verify chain construction, SSE metadata, REST response fields |
| `GeminiMigrationTest` | Unit | ~4 | Gemini promotion fires correctly through ScoredRouter; same chain as legacy Gemini special-case; Gemini promotion does NOT fire when gemini not configured; Gemini promotion does NOT fire for non-code intents |
| `ModelRegistryRankedTest` | Unit | ~3 | `rankedCompatibleModels()` returns sorted results; scoring respects cost tiers; empty results when no compatible models |

### 8.2 Existing tests that must continue to pass unchanged

| Test class | Count | Why must pass |
|---|---|---|
| `PrivacyPolicyEvaluatorTest` | 4 | Privacy enforcement unchanged |
| `ChatPrivacyBoundaryTest` | 1 | Classify-and-enforce before provider selection |
| `ChatContractCompatibilityTest` | 2 | REST/SSE contract unchanged |
| `RequestClassifierTest` | 12 | Classification unchanged |
| `ModelRouterCompatibilityTest` | 1 | Legacy router unchanged |
| `ModelRegistryTest` | 3 | Registry unchanged |
| `ProviderModelAdapterTest` | 4 | Provider adapters unchanged |
| `IntentClassifierTest` | 6 | Legacy classifier unchanged |
| `JwtServiceTest` | 2 | Auth unchanged |
| `EmbeddingCosineTest` | 3 | RAG unchanged |

### 8.3 Test double strategy

- `ModelRegistry` → real instance with controlled `ProviderModelAdapter`s (same pattern as existing `ModelRegistryTest.MutableAdapter`)
- `PrivacyPolicyEvaluator` → real instance (no mocking — must verify privacy gate is intact)
- `RequestClassifier` → real instance (no mocking — deterministic)
- `GeminiProperties` → mock/stub for `configured()`
- `ModelCatalogService` → mock
- `ScoredRouter` → real instance for integration tests; mock for ChatService unit tests

---

## 9. Rollback Plan

### 9.1 Code rollback

Phase 3 touches the following files. Rollback is per-file:

| File | Rollback action |
|---|---|
| `ChatService.java` | `git checkout` pre-Phase-3 version (the current working copy + committed Phase 1/2 changes) |
| `application.properties` | Remove `privoraa.ai.registry.routing-enabled` line |
| `ModelRegistryProperties.java` | Remove `routingEnabled` field |
| `ModelRegistry.java` | Remove `rankedCompatibleModels()` and `score()` methods |
| `ScoredRouter.java` | `git rm` |
| `ScoredRoutingResult.java` | `git rm` |
| `ScoredCandidate.java` | `git rm` |
| `ChatResponse.java` | Revert additive fields |
| SSE payload helpers | Revert additive fields |
| New test files | `git rm` |

### 9.2 Configuration rollback

- Set `privoraa.ai.registry.routing-enabled=false` (default) — instantly restores pre-Phase-3 routing behavior without a redeploy
- No migration needed — no database changes
- No frontend changes required — new SSE/REST fields are additive and ignored by the client

### 9.3 Gradual rollout sequence

```
1. Deploy with routing-enabled=false (default)
   → Verify: no behavior change, dry-run logs confirm expected rankings

2. Set routing-enabled=true in staging/dev
   → Verify: scored routing matches dry-run predictions, Gemini promotion works

3. Set routing-enabled=true in production (single user / canary)
   → Verify: responses match expected model, no new errors

4. Full production rollout
   → Monitor: model selection diversity, fallback rate, user feedback

5. If issues: set routing-enabled=false (instant rollback, no deploy)
```

---

## 10. Known Risks

### 10.1 Registry snapshot staleness

The registry refreshes asynchronously at startup + hourly. Between refreshes, the snapshot may not reflect the latest OpenRouter catalogue. Risk is low — the existing `ModelRouter` uses the same catalogue with the same staleness (60-min cache TTL on `ModelCatalogService`).

**Mitigation:** `ScoredRouter` does not depend on catalogue freshness for correctness — stale entries are simply skipped (if removed from catalogue, they won't appear). The `LAST_KNOWN_GOOD` fallback means a failed refresh preserves the previous hour's data.

### 10.2 Gemini selectable=false conflict

The `GeminiModelAdapter` registers descriptors with `selectable=false`. `compatibleModels()` filters them out. The `ScoredRouter` has a special promotion override to bypass this for Gemini.

**Mitigation:** This is intentional. The registry is honest about Gemini's unknown pricing. The router contains the business rule ("Gemini is effectively free for coding because Privoraa's key covers it"). Documented explicitly in both `GeminiModelAdapter` and `ScoredRouter`.

**Alternative:** Set `GeminiModelAdapter` to produce `selectable=true` when `geminiProperties.configured()`. This would make the registry slightly impure but simplify the router. **Decision: reject** — keep registry pure, business rules in the router.

### 10.3 PRIVATE_LOCAL intent overriding functional intent

`RequestClassifier.java:117` sets `IntentType.PRIVATE_LOCAL` when `localOnly` is detected, preventing detection of `CODING` or other functional intents. This affects Gemini promotion — a "code local only" prompt would not get the Gemini coding upgrade because the intent is `PRIVATE_LOCAL`, not `CODING`.

**Mitigation:** The current behavior matches pre-Phase-3 (the prompt never reaches the Gemini special case because `classifyAndEnforce()` blocks it before routing). No change needed for Phase 3.

**Future improvement (post-Phase 3):** Orthogonal intent/privacy — `IntentType.PRIVATE_LOCAL` should be a privacy classification, not an intent. The `compatibleModels()` capability check already handles this through `LOCAL_INFERENCE` capability and `LOCAL_ONLY` privacy level.

### 10.4 Free-model catalogue churn

OpenRouter adds and removes free models frequently. `RouterDefaults.GLOBAL_FALLBACK` is a curated list that may become stale. The registry handles this naturally — removed models won't appear in `compatibleModels()`.

**Risk:** If OpenRouter removes ALL free models in a category, `compatibleModels()` returns empty, and `ScoredRouter` falls back to legacy `ModelRouter`, which also has an empty chain.

**Mitigation:** If `ScoredRouter` produces an empty chain, fall through to legacy `ModelRouter` behavior. Log a WARN. The existing fallback chain (`RouterDefaults.GLOBAL_FALLBACK`) is used as a last resort even if models aren't in the live catalogue.

### 10.5 No cross-provider execution fallback

Phase 3 stays within the same topology. The fallback chain is constructed from ranked candidates within the same topology/cloud umbrella. Cross-provider fallback (e.g., OpenRouter → Gemini during execution) is NOT implemented. This matches the existing limitation documented for Phase 3.

**Risk:** Users may experience more failures if the top-ranked provider has a fleet-wide outage.

**Mitigation:** Documented as out-of-scope for Phase 3. Phase 4 (resilient execution) addresses circuit breakers and cross-provider fallback.

### 10.6 Registry snapshot is not persisted

The registry is an in-memory `AtomicReference<ModelRegistrySnapshot>`. If the JVM restarts, the snapshot starts from `fallbackSnapshot()` and refreshes asynchronously.

**Risk:** Brief window (seconds to minutes) where routing uses static fallbacks instead of live catalogue rankings.

**Mitigation:** Acceptable. The existing `ModelRouter` also uses cached catalogue data. The `fallbackSnapshot()` includes the same curated models as `ModelCatalogService.fallbackModels()`. No database dependency added.

---

## 11. Implementation Files Summary

### 11.1 New files (4)

| File | Lines (est.) | Package |
|---|---|---|
| `ScoredRouter.java` | ~120 | `com.privoraa.routing` |
| `ScoredRoutingResult.java` | ~30 | `com.privoraa.routing` |
| `ScoredCandidate.java` | ~10 | `com.privoraa.ai.registry` |
| (Test) `ScoredRouterTest.java` | ~200 | `com.privoraa.routing` |
| (Test) `RegistryRoutingCompatibilityTest.java` | ~100 | `com.privoraa.routing` |
| (Test) `ChatServiceScoredRoutingTest.java` | ~120 | `com.privoraa.chat` |
| (Test) `GeminiMigrationTest.java` | ~80 | `com.privoraa.routing` |
| (Test) `ModelRegistryRankedTest.java` | ~60 | `com.privoraa.ai.registry` |

### 11.2 Modified files (6)

| File | Change scope | Lines changed |
|---|---|---|
| `ChatService.java` | Inject ScoredRouter, thread classification into prepare(), conditionally route | ~30 |
| `application.properties` | Add `routing-enabled` property | +1 |
| `ModelRegistryProperties.java` | Add `routingEnabled` field | +1 |
| `ModelRegistry.java` | Add `rankedCompatibleModels()` + `score()` | ~40 |
| `ChatService.metaPayload()` / `donePayload()` | Additive SSE fields | ~15 |
| `ChatResponse.java` | Additive REST fields | +3 fields |

### 11.3 Unchanged files (key)

| File | Reason |
|---|---|
| `ModelRouter.java` | Preserved as fallback |
| `OfflineRouter.java` | Server-side Ollama unchanged |
| `RouterDefaults.java` | Preserved for legacy fallback chain |
| `IntentClassifier.java` | Preserved for legacy compatibility signal |
| `PrivacyPolicyEvaluator.java` | Mandatory precondition — unchanged |
| `RequestClassifier.java` | Unchanged |
| `GlobalExceptionHandler.java` | Unchanged |
| `GeminiProvider.java` | Unchanged |
| `GeminiProperties.java` | Unchanged |
| `OpenRouterModelAdapter.java` | Unchanged |
| `GeminiModelAdapter.java` | Unchanged (selectable=false preserved) |
| `OllamaModelAdapter.java` | Unchanged |
| `LlmProviderResolver.java` | Unchanged |

---

## 12. Implementation Order

| Step | File(s) | Commit point | Verification |
|---|---|---|---|
| 1 | `application.properties`, `ModelRegistryProperties.java` | Feature flag exists | `mvnw compile` |
| 2 | `ModelRegistry.java`, `ScoredCandidate.java` | Ranking infra ready | `ModelRegistryRankedTest` |
| 3 | `ScoredRoutingResult.java` | Routing result type | `mvnw compile` |
| 4 | `ScoredRouter.java` | Scoring + Gemini promotion | `ScoredRouterTest`, `GeminiMigrationTest` |
| 5 | `ChatService.java` | Integration point | `ScoredRouterTest` |
| 6 | `ChatService.java` meta/done/response | Additive fields | `ChatContractCompatibilityTest` |
| 7 | `ChatServiceScoredRoutingTest.java` | End-to-end | All tests |
| 8 | `RegistryRoutingCompatibilityTest.java` | Feature-flag parity | Both flag states |
| 9 | — | Full validation | `mvnw test` + `npm run lint` + `npm test` + `npm run build` |

---

## 13. Verification Checklist (post-implementation)

- [ ] `mvnw test`: all 38 existing + ~36 new = ~74 tests pass
- [ ] `npm run lint`: clean
- [ ] `npm test`: 5/5 frontend pass
- [ ] `npm run build`: client + SSR + prerender clean
- [ ] `git diff --check`: no whitespace errors
- [ ] `routing-enabled=false`: same model selection as pre-Phase-3 (verified by `RegistryRoutingCompatibilityTest`)
- [ ] `routing-enabled=true` + no compatible models: fall back to legacy `ModelRouter`
- [ ] `routing-enabled=true` + `classifyAndEnforce` blocks: privacy violation raised before any routing code
- [ ] `routing-enabled=true` + explicit model pick: legacy `ModelRouter` used
- [ ] `routing-enabled=true` + offline provider: `OfflineRouter` used
- [ ] SSE `meta`/`done` events: new fields present when `routing-enabled=true`, absent when `false`
- [ ] `ChatResponse`: new fields present when `routing-enabled=true`, absent when `false`

---

## 14. Out-of-Scope (Phase 4+)

- Cross-provider execution fallback
- Circuit breakers
- Provider health scoring
- Live inference health scoring
- Web search
- Answer verification
- Workspaces
- Scoped durable memory
- Repository intelligence
- Secure tool execution
- Terminal/autocoding
- Agentic patch application
- Model evaluation feedback loops
- MongoDB
- Schema migrations
- Frontend redesign
