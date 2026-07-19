package com.privoraa.llm;

public record StreamEvent(String delta, String finishReason, boolean terminal,
                          int promptTokens, int completionTokens) {
    public StreamEvent(String delta, String finishReason, boolean terminal) {
        this(delta, finishReason, terminal, 0, 0);
    }
    public static StreamEvent delta(String d) {
        return new StreamEvent(d, null, false);
    }

    public static StreamEvent done(String reason) {
        return new StreamEvent(null, reason, true);
    }

    public static StreamEvent usage(int promptTokens, int completionTokens) {
        return new StreamEvent(null, null, false, promptTokens, completionTokens);
    }
}
