package com.privoraa.chat;

import java.util.Locale;
import java.util.Set;

/** Provider-independent terminal reason classification. */
public final class FinishReasonClassifier {
    public enum Kind { COMPLETE, TOKEN_LIMIT, SAFETY, CANCELLED_OR_ERROR, UNKNOWN }

    private static final Set<String> TOKEN_LIMIT = Set.of(
            "length", "max_tokens", "max_output_tokens", "token_limit",
            "context_length", "context_window_exceeded");
    private static final Set<String> COMPLETE = Set.of("stop", "end_turn", "completed");
    private static final Set<String> SAFETY = Set.of(
            "safety", "content_filter", "blocked", "recitation", "refusal");
    private static final Set<String> ERROR = Set.of(
            "cancelled", "canceled", "aborted", "timeout", "network_error", "provider_error", "error");

    private FinishReasonClassifier() {}

    public static Classification classify(String raw) {
        String normalized = raw == null || raw.isBlank()
                ? "unknown" : raw.strip().toLowerCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        Kind kind = TOKEN_LIMIT.contains(normalized) ? Kind.TOKEN_LIMIT
                : COMPLETE.contains(normalized) ? Kind.COMPLETE
                : SAFETY.contains(normalized) ? Kind.SAFETY
                : ERROR.contains(normalized) ? Kind.CANCELLED_OR_ERROR : Kind.UNKNOWN;
        return new Classification(raw == null || raw.isBlank() ? "unknown" : raw, normalized, kind);
    }

    public record Classification(String raw, String normalized, Kind kind) {}
}
