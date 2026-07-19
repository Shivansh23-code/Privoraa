package com.privoraa.chat;

/** Conservative overlap removal for adjacent provider continuation segments. */
public final class ContinuationMerger {
    private ContinuationMerger() {}

    public static String merge(String previous, String next, int overlapWindow) {
        if (previous == null || previous.isEmpty()) return next == null ? "" : next;
        if (next == null || next.isEmpty()) return previous;
        int window = Math.max(0, overlapWindow);
        int max = Math.min(Math.min(previous.length(), next.length()), window);
        int overlap = 0;
        for (int length = max; length >= 1; length--) {
            if (previous.regionMatches(previous.length() - length, next, 0, length)) {
                overlap = length;
                break;
            }
        }
        // Tiny character/partial-word matches are coincidence, not safe deduplication.
        boolean codeFenceBoundary = overlap == 3 && previous.endsWith("```") && next.startsWith("```");
        if (overlap < 12 && !codeFenceBoundary) overlap = 0;
        return previous + next.substring(overlap);
    }
}
