package com.privoraa.chat;

import java.util.Locale;
import java.util.Set;

/** Content-based, provider-independent assessment of a response ending. */
public final class ResponseCompletenessAnalyzer {
    public enum State { COMPLETE, SUSPICIOUS_DANGLING_PROSE, OPEN_CODE_FENCE, UNMATCHED_DELIMITER, NO_SAFE_BOUNDARY }

    private static final Set<String> ABBREVIATIONS = Set.of(
            "e.g.", "i.e.", "etc.", "mr.", "mrs.", "ms.", "dr.", "prof.",
            "sr.", "jr.", "vs.", "fig.", "no.", "st.", "approx.");
    private static final Set<String> DANGLING_WORDS = Set.of(
            "and", "or", "but", "because", "although", "however", "therefore", "while", "whereas", "so",
            "a", "an", "the", "of", "to", "for", "with", "by", "from", "into", "on", "at");
    private static final Set<String> DANGLING_PHRASES = Set.of(
            "this is why", "which means", "such as", "including", "due to", "as a result of", "the cost",
            "the reason", "one of the", "compared with", "depends on");

    private ResponseCompletenessAnalyzer() {}

    public static Result analyze(String content) {
        if (content == null || content.isBlank()) {
            return new Result(State.NO_SAFE_BOUNDARY, "blank response", -1, content, false);
        }
        String text = content.stripTrailing();
        Scan scan = scan(text);
        String tail = scan.lastSafeBoundary() >= 0
                ? text.substring(scan.lastSafeBoundary()).strip() : text;

        if (scan.openFence()) return structural(State.OPEN_CODE_FENCE, "open fenced code block", scan, tail);
        if (scan.unmatchedDelimiter() || unfinishedMarkdown(text)) {
            return structural(State.UNMATCHED_DELIMITER, "unmatched delimiter or markdown span", scan, tail);
        }
        if (hasSuspiciousEnding(text, tail, scan.lastSafeBoundary())) {
            if (scan.lastSafeBoundary() < 0) {
                return new Result(State.NO_SAFE_BOUNDARY, "suspicious ending without a safe prior boundary",
                        -1, text, false);
            }
            return new Result(State.SUSPICIOUS_DANGLING_PROSE, "dangling final prose fragment",
                    scan.lastSafeBoundary(), tail, true);
        }
        return new Result(State.COMPLETE, "ending is structurally complete", scan.lastSafeBoundary(), "", false);
    }

    private static Result structural(State state, String reason, Scan scan, String tail) {
        return new Result(state, reason, scan.lastSafeBoundary(), tail, scan.lastSafeBoundary() >= 0);
    }

    private static boolean hasSuspiciousEnding(String text, String tail, int boundary) {
        if (text.endsWith(",") || text.endsWith(":") || text.endsWith(";")) return true;
        String normalized = text.toLowerCase(Locale.ROOT).replaceAll("[\\s]+", " ").strip();
        String lastWord = normalized.replaceAll(".*\\s", "").replaceAll("[^\\p{L}]", "");
        if (DANGLING_WORDS.contains(lastWord)) return true;
        if (DANGLING_PHRASES.stream().anyMatch(normalized::endsWith)) return true;
        if (boundary >= 0 && !tail.isBlank() && !validStandaloneFragment(tail)) {
            String lowerTail = tail.toLowerCase(Locale.ROOT);
            int words = tail.split("\\s+").length;
            return words <= 12 && lowerTail.matches("^(however|therefore|but|and|because|although|while|whereas)\\b.*");
        }
        return false;
    }

    private static boolean validStandaloneFragment(String tail) {
        String value = tail.strip();
        if (value.startsWith("#") || value.matches("(?s)^[-*+]\\s+.+") || value.matches("(?s)^\\d+[.)]\\s+.+")) return true;
        if (value.matches("(?i).*(?:https?://|www\\.)\\S+$")) return true;
        if (value.matches("(?i).*(?:version|v)\\s*\\d+\\.\\d+$")) return true;
        if (value.matches(".*\\b\\d+\\.\\d+$")) return true;
        if (value.matches("[A-Za-z_$][\\w$]*(?:\\([^)]*\\))?")) return true;
        String lower = value.toLowerCase(Locale.ROOT);
        return ABBREVIATIONS.stream().anyMatch(lower::endsWith);
    }

    private static boolean unfinishedMarkdown(String text) {
        long inlineTicks = text.chars().filter(ch -> ch == '`').count();
        if (inlineTicks % 2 != 0) return true;
        int openBracket = text.lastIndexOf('[');
        int closeBracket = text.lastIndexOf(']');
        if (openBracket > closeBracket) return true;
        int linkStart = text.lastIndexOf("](");
        return linkStart >= 0 && text.indexOf(')', linkStart + 2) < 0;
    }

    private static Scan scan(String text) {
        boolean inFence = false;
        boolean inlineCode = false;
        int paren = 0, square = 0, brace = 0, lastBoundary = -1;
        for (int i = 0; i < text.length(); i++) {
            if (startsFence(text, i)) { inFence = !inFence; i += 2; continue; }
            char ch = text.charAt(i);
            if (!inFence && ch == '`') { inlineCode = !inlineCode; continue; }
            if (inFence || inlineCode) continue;
            switch (ch) {
                case '(' -> paren++;
                case ')' -> paren = Math.max(0, paren - 1);
                case '[' -> square++;
                case ']' -> square = Math.max(0, square - 1);
                case '{' -> brace++;
                case '}' -> brace = Math.max(0, brace - 1);
                default -> { }
            }
            if ((ch == '.' || ch == '!' || ch == '?') && isSafeBoundary(text, i)) lastBoundary = i + 1;
        }
        return new Scan(lastBoundary, inFence, paren > 0 || square > 0 || brace > 0);
    }

    static boolean isSafeBoundary(String text, int index) {
        char punctuation = text.charAt(index);
        if (index + 1 < text.length() && !Character.isWhitespace(text.charAt(index + 1))) return false;
        if (punctuation != '.') return true;
        if (index > 0 && index + 1 < text.length() && Character.isDigit(text.charAt(index - 1))
                && Character.isDigit(text.charAt(index + 1))) return false;
        int start = index;
        while (start > 0 && !Character.isWhitespace(text.charAt(start - 1))) start--;
        String token = text.substring(start, index + 1).toLowerCase(Locale.ROOT);
        return !ABBREVIATIONS.contains(token) && !token.matches("(?:[a-z]\\.){2,}")
                && !token.contains("://") && !token.startsWith("www.");
    }

    private static boolean startsFence(String text, int index) {
        return index + 2 < text.length() && text.startsWith("```", index);
    }

    public record Result(State state, String reason, int lastSafeBoundary,
                         String suspiciousTail, boolean repairRecommended) {}
    private record Scan(int lastSafeBoundary, boolean openFence, boolean unmatchedDelimiter) {}
}
