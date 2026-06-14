package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Selects the active LLM backend. "ollama" runs fully local/offline;
 * "openrouter" uses the cloud path. Defaults to ollama for local builds.
 */
@ConfigurationProperties(prefix = "privoraa.llm")
public record LlmProperties(
        String provider
) {
    public LlmProperties {
        if (provider == null || provider.isBlank()) {
            provider = "ollama";
        }
        provider = provider.trim().toLowerCase();
    }

    public boolean isOllama() {
        return "ollama".equals(provider);
    }
}
