# Model Registry

## Purpose and scope

Phase 2 introduces an internal, normalized catalogue across OpenRouter, Gemini, and server-side Ollama. It supplies immutable diagnostic candidates for Phase 3 but does not select models, alter fallback order, execute inference, or change existing model/chat APIs.

The registry is implemented under `com.privoraa.ai.registry`. Existing `ModelRouter`, `OfflineRouter`, `RouterDefaults`, the Gemini coding special case, `/api/v1/models`, local catalogue endpoints, and the frontend picker remain authoritative and unchanged.

## Normalized descriptor

`ModelDescriptor` records a registry ID, provider model ID, display name, provider, explicit execution topology, availability observation, pricing tier, Phase 1 capabilities, nullable context/output limits, streaming support, selectability, source, observation time, and bounded safe metadata.

Collections are defensively copied. Required IDs cannot be blank. Unknown numeric values remain `null`, never zero. Metadata is capped at 20 entries with bounded keys/values and never contains credentials or raw provider payloads.

## Provider adapters

- **OpenRouter:** reuses `OpenRouterClient.listModels()`. Live pricing wins: two present zero prices mean `FREE`, any non-zero price means `PAID`, and missing/malformed pricing means `UNKNOWN`. Catalogue presence produces `UNKNOWN` inference availability. Existing curated free models are the static fallback.
- **Gemini:** registers configured code and fallback IDs only. Source is `CONFIGURATION`; availability, price, context window, and output limit remain unknown. No undocumented listing endpoint is called and API keys are not included.
- **Ollama:** registers models installed on the Spring Boot host with `SERVER_HOST_LOCAL` topology and `LOCAL` pricing, enriched conservatively from `model-catalog.json`. Configured chat/embedding models provide startup fallback descriptors.

Browser-direct Ollama remains a separate frontend session path. Its topology is `BROWSER_DEVICE_LOCAL`; inventory and prompts are not sent to or persisted by the backend registry.

## Topology and privacy

Provider identity does not imply topology:

- OpenRouter/Gemini: `CLOUD`
- backend-reachable Ollama: `SERVER_HOST_LOCAL`
- browser-reachable user Ollama: `BROWSER_DEVICE_LOCAL`

`ExecutionTargetMapper` maps these to the Phase 1 policy targets. `compatibleModels` applies the existing `PrivacyPolicyEvaluator`, so `LOCAL_ONLY` rejects cloud and server-host-local descriptors and permits only browser-device-local descriptors. This query is diagnostic only; manual selection and active routing still pass through the Phase 1 server boundary and cannot override privacy.

## Capability normalization

Normalization is deterministic and conservative. Explicit provider modalities/parameters and curated ID/category signals can add text, long context, code, vision, tool calling, structured output, local inference, fast response, or strong reasoning. Unknown capabilities remain absent. Raw models are never assigned `WEB_SEARCH` or `RAG`: those require orchestration outside the model.

## Pricing and free-first behavior

Pricing is `FREE`, `PAID`, `LOCAL`, or `UNKNOWN`. Unknown is never treated as free. With the default `include-paid=false`, paid descriptors may be registered for diagnostics but are non-selectable. Configuration-only Gemini descriptors with unknown pricing are also non-selectable. This does not disable existing Gemini behavior because active Phase 2 routing does not consume the registry.

Configuration:

```properties
privoraa.ai.registry.enabled=true
privoraa.ai.registry.refresh-interval=PT1H
privoraa.ai.registry.refresh-timeout=PT10S
privoraa.ai.registry.max-metadata-entries=20
privoraa.ai.registry.include-paid=false
```

## Cache and refresh policy

The registry constructs an immutable fallback/configuration snapshot at startup and refreshes asynchronously after application readiness and hourly thereafter. Provider calls are isolated and bounded by the configured timeout. An `AtomicReference` replaces complete immutable snapshots, so readers never observe partial state.

A successful provider refresh replaces only that provider’s descriptors. A failure retains that provider’s last-known-good list; if none exists, static/configured fallbacks remain. Failure in one provider cannot erase another provider. Refresh observations and safe reason codes are kept in memory and logged without raw payloads or credentials. No registry data is written to MySQL or Redis.

## Known limitations

- Catalogue presence is not execution health; availability is intentionally `UNKNOWN` unless installed server Ollama was observed.
- Capability inference is conservative and partly name/category based.
- Gemini metadata is configuration-only.
- An empty Ollama installed list cannot currently distinguish an unavailable host from a valid empty installation.
- Browser-device inventory exists only in the frontend session and is not aggregated by the backend.
- The common-pool timeout bounds registry waiting but cannot guarantee cancellation of a provider client that ignores interruption.
- No diagnostic registry endpoint is exposed in Phase 2.

## Phase 3 integration

Phase 3 can rank `compatibleModels(classification)` using capability fit, topology/privacy, price, measured reliability, and latency. It must retain `PrivacyPolicyEvaluator` as a mandatory gate, distinguish registered from selectable, preserve explicit cost policy, and avoid treating catalogue availability as provider health.
