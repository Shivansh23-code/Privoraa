package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "privoraa.chat.continuation")
public record ChatContinuationProperties(
        boolean enabled,
        int maxSegments,
        int maxTotalCompletionTokens,
        int overlapWindowChars
) {
    public ChatContinuationProperties {
        if (maxSegments <= 0) maxSegments = 3;
        if (maxTotalCompletionTokens <= 0) maxTotalCompletionTokens = 16000;
        if (overlapWindowChars <= 0) overlapWindowChars = 600;
    }
}
