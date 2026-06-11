package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "privoraa.openrouter")
public record OpenRouterProperties(
        String apiKey,
        String baseUrl,
        String appUrl,
        String appTitle,
        String embeddingModel,
        long modelsCacheTtlMin
) {
    public boolean configured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public boolean embeddingsConfigured() {
        return configured() && embeddingModel != null && !embeddingModel.isBlank();
    }
}
