package com.privoraa.chat;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ResponseTailTrimmerTest {
    @Test void trimsDanglingClauseAfterTwoSentences() {
        assertTrimmed("First sentence. Second sentence. This is why", "First sentence. Second sentence.");
    }

    @Test void completeResponseRemainsUnchanged() {
        assertUnchanged("Finished. This is intentionally complete", "complete");
    }

    @Test void incompleteWithoutPunctuationRemainsUnchanged() {
        assertUnchanged("No sentence boundary here", "incomplete");
    }

    @Test void closedCodeFenceEndingRemainsUnchanged() {
        assertUnchanged("Example:\n```java\nSystem.out.println(\"Hi.\");\n```", "incomplete");
    }

    @Test void decimalIsNotBoundary() {
        assertUnchanged("The value is 3.14 and still being explained", "incomplete");
    }

    @Test void versionIsNotBoundary() {
        assertUnchanged("Version 2.5 remains supported", "incomplete");
    }

    @Test void urlIsNotBoundary() {
        assertUnchanged("Visit https://example.com/docs for the", "incomplete");
    }

    @Test void abbreviationIsNotBoundary() {
        assertUnchanged("Use examples, e.g. arrays and", "incomplete");
    }

    @Test void questionMarkIsBoundary() {
        assertTrimmed("Ready? This is why", "Ready?");
    }

    @Test void exclamationMarkIsBoundary() {
        assertTrimmed("Done! This is why", "Done!");
    }

    @Test void errorStatusAlsoTrims() {
        var result = ResponseTailTrimmer.trim("Done. This is why", "error");
        assertEquals("Done.", result.content());
        assertTrue(result.trimmed());
    }

    @Test void unicodeContentIsPreserved() {
        assertTrimmed("यह पूर्ण है. अधूरा वाक्य and", "यह पूर्ण है.");
    }

    @Test void blankAndNullInputsRemainUnchanged() {
        assertNull(ResponseTailTrimmer.trim(null, "incomplete").content());
        assertUnchanged("   ", "incomplete");
    }

    private static void assertTrimmed(String input, String expected) {
        var result = ResponseTailTrimmer.trim(input, "incomplete");
        assertEquals(expected, result.content());
        assertTrue(result.trimmed());
    }

    private static void assertUnchanged(String input, String status) {
        var result = ResponseTailTrimmer.trim(input, status);
        assertEquals(input, result.content());
        assertFalse(result.trimmed());
    }
}
