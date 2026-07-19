package com.privoraa.chat;

/** Conservative fallback applied only after content analysis identifies a broken tail. */
public final class ResponseTailTrimmer {
    private ResponseTailTrimmer() {}

    public static Result trim(String content, String completionStatus) {
        ResponseCompletenessAnalyzer.Result analysis = ResponseCompletenessAnalyzer.analyze(content);
        if (content == null || content.isBlank()
                || analysis.state() == ResponseCompletenessAnalyzer.State.COMPLETE
                || analysis.lastSafeBoundary() < 0) {
            return new Result(content, false);
        }
        String trimmed = content.substring(0, analysis.lastSafeBoundary()).stripTrailing();
        return trimmed.isEmpty() ? new Result(content, false) : new Result(trimmed, true);
    }

    public record Result(String content, boolean trimmed) {}
}
