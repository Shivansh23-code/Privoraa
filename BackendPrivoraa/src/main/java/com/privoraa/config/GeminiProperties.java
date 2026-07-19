package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Google Gemini (via its OpenAI-compatible endpoint). Free AI Studio tier; used
 * as a much stronger CODING backend than the OpenRouter free tier. Inert until
 * GEMINI_API_KEY is set — when absent the app behaves exactly as before.
 */
@ConfigurationProperties(prefix = "privoraa.gemini")
public record GeminiProperties(
        String apiKey,
        String baseUrl,
        String codeModel,
        String fallbackModel
) {
    public GeminiProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
        }
        if (codeModel == null || codeModel.isBlank()) {
            codeModel = "gemini-2.5-flash";
        }
        if (fallbackModel == null || fallbackModel.isBlank()) {
            fallbackModel = "gemini-2.5-flash";
        }
        // This model is confirmed unavailable in the production account. Keep a
        // stale environment override from forcing one guaranteed failed attempt.
        if ("gemini-2.0-flash".equals(codeModel)) {
            codeModel = fallbackModel;
        }
    }

    public boolean configured() {
        return apiKey != null && !apiKey.isBlank();
    }
}
