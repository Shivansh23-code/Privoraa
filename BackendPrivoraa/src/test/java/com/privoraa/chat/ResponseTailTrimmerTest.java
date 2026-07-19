package com.privoraa.chat;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Block-based structural fallback tests — no hardcoded dangling phrase dependency.
 */
class ResponseTailTrimmerTest {

    @Test
    void trimsDanglingClauseAfterTwoSentences() {
        assertTrimmed("First sentence. Second sentence. This is why",
                "First sentence. Second sentence.");
    }

    @Test
    void completeResponseRemainsUnchanged() {
        assertUnchanged("Finished. This is intentionally complete");
    }

    @Test
    void incompleteWithoutPunctuationRemainsUnchanged() {
        assertUnchanged("No sentence boundary here");
    }

    @Test
    void closedCodeFenceEndingRemainsUnchanged() {
        assertUnchanged("Example:\n```java\nSystem.out.println(\"Hi.\");\n```");
    }

    @Test
    void decimalIsNotBoundary() {
        assertUnchanged("The value is 3.14 and still being explained");
    }

    @Test
    void versionIsNotBoundary() {
        assertUnchanged("Version 2.5 remains supported");
    }

    @Test
    void urlIsNotBoundary() {
        assertUnchanged("Visit https://example.com/docs for the");
    }

    @Test
    void abbreviationIsNotBoundary() {
        assertUnchanged("Use examples, e.g. arrays and");
    }

    @Test
    void questionMarkIsBoundary() {
        assertTrimmed("Ready? This is why", "Ready?");
    }

    @Test
    void exclamationMarkIsBoundary() {
        assertTrimmed("Done! This is why", "Done!");
    }

    @Test
    void errorStatusAlsoTrims() {
        var result = ResponseTailTrimmer.trim("Done. This is why", "error");
        assertEquals("Done.", result.content());
        assertTrue(result.trimmed());
    }

    @Test
    void unicodeContentIsPreserved() {
        assertTrimmed("यह पूर्ण है. अधूरा वाक्य and", "यह पूर्ण है.");
    }

    @Test
    void blankAndNullInputsRemainUnchanged() {
        assertNull(ResponseTailTrimmer.trim(null, "incomplete").content());
        assertUnchanged("   ");
    }

    @Test
    void multiBlockDanglingPhraseTrimsToLastCompleteBlock() {
        assertTrimmed("First complete paragraph.\n\nSecond complete paragraph.\n\nHowever, the dangling clause",
                "First complete paragraph.\n\nSecond complete paragraph.");
    }

    @Test
    void incompleteFragmentWithEarlierCompleteSentenceKeepsThatSentence() {
        assertTrimmed("This is complete. But also dangling",
                "This is complete.");
    }

    @Test
    void headingPreservedWhenSubsequentParagraphDangles() {
        assertTrimmed("## Heading\nComplete paragraph.\n\n## Another heading\nDangling",
                "## Heading\nComplete paragraph.");
    }

    @Test
    void headingWithDanglingSubtextTrimsToSentenceBoundary() {
        assertTrimmed("## Heading\nComplete. Dangling text",
                "## Heading\nComplete.");
    }

    @Test
    void openCodeFenceTrimsToPriorBlock() {
        assertTrimmed("Complete paragraph.\n\n```java\nunclosed code",
                "Complete paragraph.");
    }

    @Test
    void noSafeBoundaryPreservesOriginal() {
        assertUnchanged("This is why");
    }

    private static void assertTrimmed(String input, String expected) {
        var result = ResponseTailTrimmer.trim(input, "incomplete");
        assertEquals(expected, result.content());
        assertTrue(result.trimmed(), "expected trimmed=true for: " + input);
    }

    private static void assertUnchanged(String input) {
        var result = ResponseTailTrimmer.trim(input, "incomplete");
        assertEquals(input, result.content());
        assertFalse(result.trimmed(), "expected trimmed=false for: " + input);
    }
}
