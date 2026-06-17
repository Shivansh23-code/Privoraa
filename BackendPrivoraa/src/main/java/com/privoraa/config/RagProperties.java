package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "privoraa.rag")
public record RagProperties(
        int topK,
        int chunkSize,
        int chunkOverlap,
        int embeddingDim,
        // Which backend produces embeddings, INDEPENDENT of the chat provider:
        // auto (ollama if active, else openrouter-if-configured, else local),
        // ollama | openrouter | local. Lets cloud chat run on OpenRouter while
        // embeddings use the self-contained local encoder (no external dep).
        String embeddingProvider
) {
    public RagProperties {
        if (embeddingProvider == null || embeddingProvider.isBlank()) {
            embeddingProvider = "auto";
        }
        embeddingProvider = embeddingProvider.trim().toLowerCase();
    }
}
