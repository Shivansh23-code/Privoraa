package com.privoraa.chat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertEquals;

class FinishReasonClassifierTest {
    @ParameterizedTest
    @ValueSource(strings = {"length", "max_tokens", "max_output_tokens", "MAX_TOKENS", "token_limit", "context_length", "context_window_exceeded"})
    void tokenLimitsAreProviderIndependent(String raw) {
        assertEquals(FinishReasonClassifier.Kind.TOKEN_LIMIT, FinishReasonClassifier.classify(raw).kind());
    }

    @ParameterizedTest
    @ValueSource(strings = {"stop", "STOP", "end_turn", "completed"})
    void normalStopsAreComplete(String raw) {
        assertEquals(FinishReasonClassifier.Kind.COMPLETE, FinishReasonClassifier.classify(raw).kind());
    }

    @ParameterizedTest
    @ValueSource(strings = {"safety", "content_filter", "blocked", "recitation", "refusal"})
    void safetyReasonsAreNotRecoverableTokenLimits(String raw) {
        assertEquals(FinishReasonClassifier.Kind.SAFETY, FinishReasonClassifier.classify(raw).kind());
    }
}
