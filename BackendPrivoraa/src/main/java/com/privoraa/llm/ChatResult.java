package com.privoraa.llm;

/** Result of a non-streaming completion carrying finish reason (null = unknown). */
public record ChatResult(
        String content,
        int promptTokens,
        int completionTokens,
        String finishReason
) {
    public ChatResult(String content, int promptTokens, int completionTokens) {
        this(content, promptTokens, completionTokens, null);
    }
}
