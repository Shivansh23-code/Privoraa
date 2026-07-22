package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "privoraa.chat.continuation")
public record ChatContinuationProperties(
        boolean enabled,
        int maxSegments,
        int maxOutputTokens,
        int maxTotalCompletionTokens,
        int timeoutSeconds,
        int overlapWindowChars
) {
    public ChatContinuationProperties {
        if (maxSegments <= 0) maxSegments = 3;
        if (maxOutputTokens <= 0) maxOutputTokens = 4096;
        if (maxTotalCompletionTokens <= 0) maxTotalCompletionTokens = 24000;
        if (timeoutSeconds <= 0) timeoutSeconds = 120;
        if (overlapWindowChars <= 0) overlapWindowChars = 600;
    }
}
