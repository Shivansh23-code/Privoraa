package com.privoraa.llm;

public record StreamEvent(String delta, String finishReason, boolean terminal) {
    public static StreamEvent delta(String d) {
        return new StreamEvent(d, null, false);
    }

    public static StreamEvent done(String reason) {
        return new StreamEvent(null, reason, true);
    }
}
