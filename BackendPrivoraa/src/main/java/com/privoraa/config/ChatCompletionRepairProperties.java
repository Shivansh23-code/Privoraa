package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "privoraa.chat.completion-repair")
public record ChatCompletionRepairProperties(boolean enabled, int maxAttempts, int maxOutputTokens) {
    public ChatCompletionRepairProperties {
        if (maxAttempts <= 0) maxAttempts = 1;
        maxAttempts = Math.min(maxAttempts, 1);
        if (maxOutputTokens <= 0) maxOutputTokens = 512;
    }
}
