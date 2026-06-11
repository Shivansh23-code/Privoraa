package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "privoraa.rag")
public record RagProperties(
        int topK,
        int chunkSize,
        int chunkOverlap,
        int embeddingDim
) {}
