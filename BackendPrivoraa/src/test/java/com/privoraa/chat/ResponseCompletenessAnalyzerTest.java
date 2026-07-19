package com.privoraa.chat;

import org.junit.jupiter.api.Test;

import static com.privoraa.chat.ResponseCompletenessAnalyzer.State.*;
import static org.junit.jupiter.api.Assertions.*;

class ResponseCompletenessAnalyzerTest {
    @Test void fullSentenceIsComplete() { assertState("A full sentence.", COMPLETE); }
    @Test void thisIsWhyIsSuspicious() { assertRepair("First sentence. This is why"); }
    @Test void productionCostTailIsSuspicious() {
        assertRepair("Arrays are useful. However, their fixed size and the cost");
    }
    @Test void danglingAndIsSuspicious() { assertRepair("First sentence. More detail and"); }
    @Test void trailingCommaIsSuspicious() { assertRepair("First sentence. Another thought,"); }
    @Test void trailingColonIsSuspicious() { assertRepair("First sentence. Consider:"); }
    @Test void openFenceIsSuspicious() { assertState("Intro.\n```java\ncall();", OPEN_CODE_FENCE); }
    @Test void closedFenceIsComplete() { assertState("```java\ncall();\n```", COMPLETE); }
    @Test void unmatchedParenthesisIsSuspicious() { assertState("Intro. Detail (unfinished", UNMATCHED_DELIMITER); }
    @Test void complexityAnswerIsComplete() { assertState("O(1)", COMPLETE); }
    @Test void versionIsComplete() { assertState("Version 2.5", COMPLETE); }
    @Test void decimalIsComplete() { assertState("The result is 3.14", COMPLETE); }
    @Test void urlIsComplete() { assertState("https://example.com/docs", COMPLETE); }
    @Test void abbreviationIsNotASafeBoundary() {
        var result = ResponseCompletenessAnalyzer.analyze("Examples e.g. arrays and");
        assertEquals(NO_SAFE_BOUNDARY, result.state());
        assertEquals(-1, result.lastSafeBoundary());
    }
    @Test void headingIsComplete() { assertState("## Installation", COMPLETE); }
    @Test void bulletIsComplete() { assertState("- Uses constant-time access", COMPLETE); }
    @Test void unicodeIsHandled() { assertRepair("यह पूर्ण है. लेकिन यह अधूरा and"); }
    @Test void noSafeBoundaryPreservesOriginal() {
        var result = ResponseCompletenessAnalyzer.analyze("This is why");
        assertEquals(NO_SAFE_BOUNDARY, result.state());
        assertFalse(result.repairRecommended());
    }

    private static void assertState(String value, ResponseCompletenessAnalyzer.State expected) {
        assertEquals(expected, ResponseCompletenessAnalyzer.analyze(value).state());
    }

    private static void assertRepair(String value) {
        var result = ResponseCompletenessAnalyzer.analyze(value);
        assertEquals(SUSPICIOUS_DANGLING_PROSE, result.state());
        assertTrue(result.repairRecommended());
        assertTrue(result.lastSafeBoundary() > 0);
    }
}
