package com.privoraa.chat;

import java.util.Locale;
import java.util.Set;

/** Conservatively removes prose after the final complete sentence. */
public final class ResponseTailTrimmer {
    private static final Set<String> ABBREVIATIONS = Set.of(
            "e.g.", "i.e.", "etc.", "mr.", "mrs.", "ms.", "dr.", "prof.",
            "sr.", "jr.", "vs.", "fig.", "no.", "st.", "approx.");

    private ResponseTailTrimmer() {}

    public static Result trim(String content, String completionStatus) {
        if (content == null || content.isBlank() || !shouldTrim(completionStatus)) {
            return new Result(content, false);
        }
        String stripped = content.stripTrailing();
        if (endsAtSafeBoundary(stripped)) return new Result(content, false);

        boolean inFence = false;
        int lastBoundary = -1;
        for (int i = 0; i < stripped.length(); i++) {
            if (startsFence(stripped, i)) {
                inFence = !inFence;
                i += 2;
                continue;
            }
            char ch = stripped.charAt(i);
            if (!inFence && (ch == '.' || ch == '!' || ch == '?')
                    && isSafeBoundary(stripped, i)) {
                lastBoundary = i + 1;
            }
        }
        if (lastBoundary < 0) return new Result(content, false);
        String trimmed = stripped.substring(0, lastBoundary).stripTrailing();
        return trimmed.isEmpty() || trimmed.equals(stripped)
                ? new Result(content, false) : new Result(trimmed, true);
    }

    private static boolean shouldTrim(String status) {
        return status != null && switch (status.toLowerCase(Locale.ROOT)) {
            case "incomplete", "limit_reached", "error" -> true;
            default -> false;
        };
    }

    private static boolean endsAtSafeBoundary(String text) {
        if (text.endsWith("```")) return true; // preserve a complete fenced block
        int last = text.length() - 1;
        return last >= 0 && (text.charAt(last) == '.' || text.charAt(last) == '!'
                || text.charAt(last) == '?') && isSafeBoundary(text, last);
    }

    private static boolean startsFence(String text, int index) {
        return index + 2 < text.length() && text.charAt(index) == '`'
                && text.charAt(index + 1) == '`' && text.charAt(index + 2) == '`';
    }

    private static boolean isSafeBoundary(String text, int index) {
        char punctuation = text.charAt(index);
        if (index + 1 < text.length() && !Character.isWhitespace(text.charAt(index + 1))) return false;
        if (punctuation != '.') return true;

        if (index > 0 && index + 1 < text.length()
                && Character.isDigit(text.charAt(index - 1))
                && Character.isDigit(text.charAt(index + 1))) return false;

        int tokenStart = index;
        while (tokenStart > 0 && !Character.isWhitespace(text.charAt(tokenStart - 1))) tokenStart--;
        String token = text.substring(tokenStart, index + 1).toLowerCase(Locale.ROOT);
        if (ABBREVIATIONS.contains(token)) return false;
        if (token.matches("(?:[a-z]\\.){2,}")) return false;
        if (token.contains("://") || token.startsWith("www.")) return false;
        return true;
    }

    public record Result(String content, boolean trimmed) {}
}
