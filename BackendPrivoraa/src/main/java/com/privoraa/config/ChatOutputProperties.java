package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "privoraa.chat.output")
public record ChatOutputProperties(
        int fastMaxTokens,
        int generalMaxTokens,
        int learningMaxTokens,
        int codeMaxTokens,
        int reasoningMaxTokens,
        int documentMaxTokens,
        int visionMaxTokens,
        int unknownModelMaxTokens,
        int safetyMargin
) {
    public ChatOutputProperties {
        if (fastMaxTokens <= 0) fastMaxTokens = 2048;
        if (generalMaxTokens <= 0) generalMaxTokens = 4096;
        if (learningMaxTokens <= 0) learningMaxTokens = 6144;
        if (codeMaxTokens <= 0) codeMaxTokens = 8192;
        if (reasoningMaxTokens <= 0) reasoningMaxTokens = 6144;
        if (documentMaxTokens <= 0) documentMaxTokens = 6144;
        if (visionMaxTokens <= 0) visionMaxTokens = 4096;
        if (unknownModelMaxTokens <= 0) unknownModelMaxTokens = 4096;
        if (safetyMargin <= 0) safetyMargin = 512;
    }

    public int budgetForCategory(String category) {
        return switch (category == null ? "general" : category) {
            case "fast" -> fastMaxTokens;
            case "code" -> codeMaxTokens;
            case "math" -> reasoningMaxTokens;
            case "reasoning" -> reasoningMaxTokens;
            case "learning" -> learningMaxTokens;
            case "document" -> documentMaxTokens;
            case "vision" -> visionMaxTokens;
            default -> generalMaxTokens;
        };
    }
}
