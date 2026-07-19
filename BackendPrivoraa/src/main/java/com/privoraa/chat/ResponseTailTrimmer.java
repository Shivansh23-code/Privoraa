package com.privoraa.chat;

/** Block-based structural fallback for incomplete response endings. */
public final class ResponseTailTrimmer {
    private ResponseTailTrimmer() {}

    public static Result trim(String content, String completionStatus) {
        if (content == null || content.isBlank()) {
            return new Result(content, false);
        }

        ResponseCompletenessAnalyzer.Result analysis =
                ResponseCompletenessAnalyzer.analyze(content);

        if (analysis.state() == ResponseCompletenessAnalyzer.State.COMPLETE) {
            return new Result(content, false);
        }
        if (analysis.state() == ResponseCompletenessAnalyzer.State.NO_SAFE_FALLBACK) {
            return new Result(content, false);
        }

        int sentenceEnd = analysis.lastCompleteSentenceBoundary();
        int blockEnd = analysis.lastCompleteBlockBoundary();

        // Prefer sentence-level granularity within the incomplete block.
        if (sentenceEnd >= 0 && sentenceEnd <= content.length()) {
            String trimmed = content.substring(0, sentenceEnd).stripTrailing();
            if (!trimmed.isEmpty()) {
                return new Result(trimmed, true);
            }
        }

        // Fall back to the last complete block boundary.
        if (blockEnd >= 0 && blockEnd <= content.length()) {
            String trimmed = content.substring(0, blockEnd).stripTrailing();
            if (!trimmed.isEmpty()) {
                return new Result(trimmed, true);
            }
        }

        // No safe trim point — preserve original.
        return new Result(content, false);
    }

    public record Result(String content, boolean trimmed) {}
}
