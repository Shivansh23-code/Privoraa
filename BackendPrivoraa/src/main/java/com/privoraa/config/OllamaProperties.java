package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Local Ollama server settings. {@code keepAlive} and {@code numCtx} are passed
 * on every call so a chat model and the embed model do not stay co-resident and
 * OOM on an 8 GB / 4 GB-VRAM machine. No API key — Ollama is unauthenticated.
 */
@ConfigurationProperties(prefix = "privoraa.ollama")
public record OllamaProperties(
        String baseUrl,
        String chatModel,
        String embedModel,
        String keepAlive,
        Integer numCtx,
        Integer timeoutSeconds
) {
    public OllamaProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "http://localhost:11434";
        }
        if (chatModel == null || chatModel.isBlank()) {
            chatModel = "llama3.2:3b";
        }
        if (embedModel == null || embedModel.isBlank()) {
            embedModel = "nomic-embed-text";
        }
        if (keepAlive == null || keepAlive.isBlank()) {
            keepAlive = "60s";
        }
        if (numCtx == null || numCtx <= 0) {
            numCtx = 4096;
        }
        if (timeoutSeconds == null || timeoutSeconds <= 0) {
            timeoutSeconds = 300;
        }
    }
}
