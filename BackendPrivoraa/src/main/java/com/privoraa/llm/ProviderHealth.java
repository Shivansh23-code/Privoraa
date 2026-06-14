package com.privoraa.llm;

/**
 * Health of an LLM backend, surfaced by {@code GET /api/llm/health}.
 * For Ollama: derived from {@code GET /api/version}. For OpenRouter:
 * {@code installed == running == configured()} and version is the base URL.
 */
public record ProviderHealth(boolean installed, boolean running, String version) {

    public static ProviderHealth down() {
        return new ProviderHealth(false, false, null);
    }
}
