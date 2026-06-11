package com.privoraa.llm;

/** Result of a non-streaming completion. */
public record ChatResult(
        String content,
        int promptTokens,
        int completionTokens
) {}
