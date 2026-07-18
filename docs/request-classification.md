# Request Classification and Privacy Policy

## Scope

Phase 1 adds deterministic request analysis and a fail-closed privacy boundary to every Spring Boot chat request. It does not select new models, call a classifier model, execute tools, search the web, or change REST/SSE success contracts.

The implementation is under `com.privoraa.ai.classification`. `ChatService` invokes it after the existing rate limit and before conversation persistence, RAG retrieval, provider resolution, or model routing.

## Classification dimensions

`RequestClassification` is an immutable record containing:

- `intent`: general chat, coding, repository analysis, debugging, architecture, research, learning, document QA, writing, data analysis, vision, automation, or private/local;
- `complexity`: low, medium, high, or very high;
- `freshness`: stable, possibly stale, or current information required;
- `privacy`: public, personal, sensitive, or local only;
- `requiredCapabilities`: text, long context, code, vision, tool calling, structured output, web search, RAG, local inference, fast response, or strong reasoning;
- `confidence`: a bounded heuristic confidence from 0 to 1;
- `reasons`: safe machine-readable signal codes without prompt excerpts.

Collections are defensively copied. Invalid confidence values are rejected. Ambiguous input returns a conservative general-chat, medium-complexity, stable, text-only fallback.

## Deterministic rules

The classifier uses anchored phrases and topic patterns only; it never invokes an LLM. Precedence prevents weaker signals from overriding stronger execution constraints:

1. explicit local-only/private instructions;
2. attached image;
3. enabled or explicitly referenced documents;
4. repository/debugging signals;
5. current research;
6. architecture, automation, data, writing, coding, and learning signals;
7. legacy classifier compatibility signal;
8. conservative fallback.

An image plus a coding prompt requires both vision and code. RAG always adds the RAG capability. Large prompt/context estimates add long-context capability and raise complexity. Automation is classification only; it does not authorize or invoke a tool.

The phrase `offline` by itself is deliberately insufficient for local-only classification. For example, “Explain offline caching in Spring” is a technical request. Local-only requires an instruction such as “local only,” “offline only,” “use Ollama only,” “do not send this to the cloud,” or “never leave my device.”

## Privacy levels

- **PUBLIC:** public or educational content with no user-specific/sensitive signal.
- **PERSONAL:** non-secret preferences, schedule, profile, account context, or learning history.
- **SENSITIVE:** credential/secret indicators, private keys, financial identifiers, identifiable medical records, or explicitly confidential source code. Sensitive values are never placed in reasons or logs. Phase 1 records elevated privacy but preserves current cloud eligibility unless the user also requests local-only handling.
- **LOCAL_ONLY:** explicit device/local/private execution instruction or private mode. It always overrides a manual cloud selection.

The regex rules are a conservative first layer, not a data-loss-prevention system. They can miss secrets or produce false positives and must not be represented as a complete privacy guarantee.

## Execution targets and enforcement

`PrivacyPolicyEvaluator` distinguishes:

- `CLOUD_PROVIDER`: OpenRouter, Gemini, and any future cloud provider;
- `SERVER_SIDE_OLLAMA`: Ollama reachable from the Spring Boot host;
- `BROWSER_LOCAL_OLLAMA`: Ollama reached directly by the user's browser.

Server-side Ollama is not assumed to be on the end user's device. The trusted end-user-local topology flag defaults to absent/false in Phase 1.

Only `BROWSER_LOCAL_OLLAMA` is allowed for `LOCAL_ONLY`. If a local-only prompt reaches either Spring Boot chat endpoint, it is rejected before persistence, RAG, provider selection, or provider invocation. This is true even when the request manually selects OpenRouter or server-side Ollama. There is no fallback.

REST responds with HTTP 409 using the existing `ApiError` shape and `error` value `LOCAL_ONLY_EXECUTION_UNAVAILABLE`. SSE emits the existing `error` event with the existing `{message}` payload. The message directs users to select an installed browser-local model or remove the restriction without revealing provider configuration.

Public, personal, and sensitive requests retain current execution eligibility. Sensitive policy can be tightened later without changing the classification model.

## Confidence interpretation

Confidence communicates signal strength, not measured statistical probability:

- about 0.96: explicit privacy/image signal;
- about 0.86: several supporting deterministic signals;
- about 0.72: one moderate signal;
- 0.45: ambiguous conservative fallback.

No secondary model is called for uncertainty in Phase 1.

## Legacy routing compatibility

The existing `IntentClassifier`, `ModelRouter`, `OfflineRouter`, `RouterDefaults`, and Gemini coding special case remain unchanged. `RequestClassifier` may consult the legacy classifier as a compatibility signal, but it does not feed its richer intent back into model selection in Phase 1.

Legacy mapping used only for richer metadata:

- `code` → `CODING` plus `CODE`;
- `reasoning`/`math` → `LEARNING` plus `STRONG_REASONING` when no stronger signal exists;
- RAG input → `DOCUMENT_QA` plus `RAG`;
- `fast` may add `FAST_RESPONSE`.

Consequently, non-local-only model choice and fallback ordering remain controlled by the exact pre-Phase-1 legacy path.

## Logging and redaction

Debug logging may contain intent, complexity, freshness, privacy, capability names, numeric confidence, reason codes, and policy result. It does not contain prompt text, matched substrings, credentials, source content, images, or model input. Blocked prompts are not persisted.

Production log level is currently INFO, so classification debug records are disabled by default. Future structured observability should add request correlation and retention/redaction policy before enabling these records broadly.

## Known limitations

- Heuristics are English-centric and do not understand negation or all indirect privacy wording.
- Approximate context length currently uses the incoming prompt length at the pre-persistence boundary; it does not load conversation history solely for classification.
- Browser-local execution is enforced by the frontend path. Spring Boot cannot redirect a received prompt back into the user's browser.
- `SENSITIVE` is metadata only in Phase 1 and does not automatically block cloud processing.
- Classification is internal and is not added to successful response/SSE metadata yet.
- No workspace policy, organization policy, tool policy, web research, registry, or cross-provider routing is included.

## Phase 2 integration points

A future normalized model registry can consume `requiredCapabilities`, privacy, freshness, and complexity while retaining `PrivacyPolicyEvaluator` as a mandatory precondition. Candidate descriptors must identify execution topology explicitly; a provider name such as Ollama is not enough. The registry must not weaken `LOCAL_ONLY`, silently introduce paid use, or treat classification confidence as model quality.
