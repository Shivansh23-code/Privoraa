package com.privoraa.llm;

/**
 * Per-call generation options shared by all providers. Provider-specific knobs
 * (Ollama's num_ctx / keep_alive) are read by each provider from its own config,
 * not threaded here, so this stays the same (temperature, maxTokens) shape the
 * OpenRouter path already used.
 */
public record ChatOptions(Double temperature, Integer maxTokens) {

    public static ChatOptions defaults() {
        return new ChatOptions(0.7, null);
    }

    public ChatOptions {
        // no validation needed; nulls mean "use provider/server default"
    }
}
