package com.privoraa.chat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.stream.Stream;

import static com.privoraa.chat.ResponseCompletenessAnalyzer.State.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Parameterized structural tests — no hardcoded dangling phrase dependency.
 * Arbitrary endings are handled via generic markdown-aware rules.
 */
class ResponseCompletenessAnalyzerTest {

    // ---- COMPLETE cases ----

    static Stream<String> completeInputs() {
        return Stream.of(
            "A full sentence with a period.",
            "Complete paragraph with exclamation!",
            "Question about the response?",
            "Multi-sentence block. With two sentences. And a third.",
            "O(1)",
            "Version 2.5",
            "The result is 3.14",
            "https://example.com/docs",
            "GET /api/users",
            "foo.orElse(value)",
            "## Installation",
            "- Uses constant-time access",
            "* Bullet point",
            "+ Another bullet",
            "1. Numbered item",
            "`inline code`",
            "[a link](https://example.com)",
            "ArrayList",
            "Finished. This is intentionally complete"
        );
    }

    @Test
    void noSafeBoundaryContentIsPreservedAsNoSafeFallback() {
        assertEquals(NO_SAFE_FALLBACK, ResponseCompletenessAnalyzer.analyze(
                "The value is 3.14 and still being explained").state());
        assertEquals(NO_SAFE_FALLBACK, ResponseCompletenessAnalyzer.analyze(
                "Version 2.5 remains supported").state());
        assertEquals(NO_SAFE_FALLBACK, ResponseCompletenessAnalyzer.analyze(
                "Visit https://example.com/docs for the").state());
        assertEquals(NO_SAFE_FALLBACK, ResponseCompletenessAnalyzer.analyze(
                "No sentence boundary here").state());
    }

    @ParameterizedTest
    @MethodSource("completeInputs")
    void completeResponsesAreNotSuspicious(String input) {
        ResponseCompletenessAnalyzer.Result r = ResponseCompletenessAnalyzer.analyze(input);
        assertEquals(COMPLETE, r.state(), "expected COMPLETE for: [" + input + "] got: " + r.state()
                + " reason: " + r.reason());
        assertFalse(r.repairRecommended());
    }

    @Test
    void closedCodeFenceIsComplete() {
        assertEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(
                "```java\ncall();\n```").state());
    }

    @Test
    void completeParagraphWithoutConclusionHeading() {
        String text = "Arrays are fundamental data structures. They provide O(1) access. " +
                "However, insertion and deletion are O(n) in the worst case.";
        assertEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(text).state());
    }

    @Test
    void summarySectionIsComplete() {
        String text = "## Summary\nThis is a complete summary paragraph with a period.";
        assertEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(text).state());
    }

    @Test
    void conclusionSectionIsComplete() {
        String text = "## Conclusion\nThe implementation is correct and complete.";
        assertEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(text).state());
    }

    @Test
    void noSectionHeadingIsComplete() {
        String text = "Just a simple complete answer here.";
        assertEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(text).state());
    }

    @Test
    void completeShortAnswerIsComplete() {
        assertEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze("42").state());
        assertEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze("Yes").state());
        assertEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze("No").state());
        assertEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze("True").state());
    }

    @Test
    void balancedDelimitersAreComplete() {
        assertEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(
                "Use the method call(param1, param2).").state());
    }

    @Test
    void multipleCompleteParagraphs() {
        String text = "First paragraph with a complete sentence.\n\n" +
                "Second paragraph also complete here.\n\n" +
                "Third paragraph ending properly.";
        assertEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(text).state());
    }

    @Test
    void finalThoughtsHeadingIsComplete() {
        String text = "## Final Thoughts\nThis wraps everything up.";
        assertEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(text).state());
    }

    @Test
    void keyTakeawayHeadingIsComplete() {
        String text = "## Key Takeaway\nThe main point is clear.";
        assertEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(text).state());
    }

    // ---- INCOMPLETE PROSE BLOCK cases ----

    static Stream<String> incompleteInputs() {
        return Stream.of(
            "First sentence. However, the",
            "Complete paragraph. Another thought,",
            "First part. Consider:",
            "First sentence. Second sentence. This is why",
            "First complete sentence. Or linked",
            "First complete sentence. And another",
            "First complete sentence. But the",
            "First complete sentence. However this",
            "First complete sentence. Because the result",
            "First complete sentence. Choose arrays, lists, or",
            "First sentence. More detail and",
            "First sentence. Another thought,",
            "Intro. Detail (unfinished"
        );
    }

    @ParameterizedTest
    @MethodSource("incompleteInputs")
    void incompleteProseBlockIsDetected(String input) {
        ResponseCompletenessAnalyzer.Result r = ResponseCompletenessAnalyzer.analyze(input);
        assertTrue(r.state() == INCOMPLETE_PROSE_BLOCK || r.state() == UNMATCHED_DELIMITER
                        || r.state() == NO_SAFE_FALLBACK,
                "expected incomplete state for: [" + input + "] got: " + r.state());
    }

    @Test
    void incompleteRandomProseFragment() {
        String text = "The quick brown fox jumps over the lazy dog. " +
                "Then something about the";
        ResponseCompletenessAnalyzer.Result r = ResponseCompletenessAnalyzer.analyze(text);
        assertNotEquals(COMPLETE, r.state());
        assertTrue(r.lastCompleteSentenceBoundary() >= 0);
    }

    @Test
    void incompleteFragmentWithRandomNouns() {
        String text = "Algorithms and data structures are fundamental. " +
                "The complexity of quicksort and";
        ResponseCompletenessAnalyzer.Result r = ResponseCompletenessAnalyzer.analyze(text);
        assertNotEquals(COMPLETE, r.state());
    }

    @Test
    void incompleteParagraphAfterCompleteParagraphs() {
        String text = "First complete paragraph.\n\n" +
                "Second complete paragraph.\n\n" +
                "However, arrays become";
        ResponseCompletenessAnalyzer.Result r = ResponseCompletenessAnalyzer.analyze(text);
        assertNotEquals(COMPLETE, r.state(), "incomplete paragraph after complete paragraphs detected: " + r.state());
        assertTrue(r.lastCompleteBlockBoundary() > 0);
    }

    @Test
    void trailingCommaIsSuspicious() {
        assertNotEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(
                "First sentence. Another thought,").state());
    }

    @Test
    void trailingColonIsSuspicious() {
        assertNotEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(
                "First sentence. Consider:").state());
    }

    @Test
    void observedRegisteredAsEndingIsIncompleteAndRecoverable() {
        ResponseCompletenessAnalyzer.Result result = ResponseCompletenessAnalyzer.analyze(
                "Check relevant business registries to ensure the name isn't already registered as");
        assertFalse(result.complete());
        assertTrue(result.recoverable());
    }

    @Test
    void unfinishedBulletEndingInConnectorIsIncomplete() {
        assertFalse(ResponseCompletenessAnalyzer.analyze("- Verify trademark status with").complete());
    }

    @Test
    void connectorsInsideCodeAndJsonDoNotCreateFalseIncompleteResult() {
        assertTrue(ResponseCompletenessAnalyzer.analyze("```java\nString value = \"as\";\n```").complete());
        assertTrue(ResponseCompletenessAnalyzer.analyze("{\"label\":\"registered as\"}").complete());
        assertTrue(ResponseCompletenessAnalyzer.analyze("Use the literal `as`").complete());
    }

    // ---- OPEN CODE FENCE ----

    @Test
    void openCodeFenceIsDetected() {
        assertEquals(OPEN_CODE_FENCE, ResponseCompletenessAnalyzer.analyze(
                "Intro.\n```java\ncall();").state());
    }

    // ---- UNMATCHED DELIMITERS ----

    @Test
    void unmatchedParenthesisIsDetected() {
        assertEquals(UNMATCHED_DELIMITER, ResponseCompletenessAnalyzer.analyze(
                "Intro. Detail (unfinished").state());
    }

    @Test
    void unmatchedBracketIsDetected() {
        assertEquals(UNMATCHED_DELIMITER, ResponseCompletenessAnalyzer.analyze(
                "Intro. [unclosed bracket").state());
    }

    @Test
    void unmatchedBraceIsDetected() {
        assertEquals(UNMATCHED_DELIMITER, ResponseCompletenessAnalyzer.analyze(
                "Intro. {unclosed brace").state());
    }

    // ---- UNFINISHED MARKDOWN ----

    @Test
    void unfinishedMarkdownLinkIsDetected() {
        assertEquals(UNMATCHED_DELIMITER, ResponseCompletenessAnalyzer.analyze(
                "Check [this link](http://example.com").state());
    }

    @Test
    void unfinishedInlineCodeIsDetected() {
        assertEquals(UNFINISHED_MARKDOWN, ResponseCompletenessAnalyzer.analyze(
                "Use the `code").state());
    }

    @Test
    void unfinishedLinkBracketIsDetected() {
        assertEquals(UNMATCHED_DELIMITER, ResponseCompletenessAnalyzer.analyze(
                "See [this reference").state());
    }

    // ---- NO SAFE BOUNDARY ----

    @Test
    void noSafeBoundaryPreservesOriginal() {
        ResponseCompletenessAnalyzer.Result r = ResponseCompletenessAnalyzer.analyze("This is why");
        assertEquals(NO_SAFE_FALLBACK, r.state());
        assertFalse(r.repairRecommended());
    }

    @Test
    void abbreviationIsNotASafeBoundary() {
        ResponseCompletenessAnalyzer.Result r = ResponseCompletenessAnalyzer.analyze(
                "Examples e.g. arrays and");
        assertEquals(NO_SAFE_FALLBACK, r.state());
        assertEquals(-1, r.lastCompleteSentenceBoundary());
    }

    // ---- Unicode handling ----

    @Test
    void unicodeIsHandled() {
        ResponseCompletenessAnalyzer.Result r = ResponseCompletenessAnalyzer.analyze(
                "यह पूर्ण है. लेकिन यह अधूरा and");
        assertNotEquals(COMPLETE, r.state());
    }

    @Test
    void unicodeCompleteSentence() {
        assertEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(
                "यह एक पूर्ण वाक्य है।").state());
    }

    // ---- Edge cases preserved from old tests ----

    @Test
    void singleWordSuffixDetectedAsIncomplete() {
        assertNotEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(
                "First sentence. linked").state(), "generic word suffix should be incomplete");
        assertNotEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(
                "First sentence. dynamic").state(), "generic word suffix should be incomplete");
        assertNotEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(
                "First sentence. HashMap").state(), "identifier suffix conservatively incomplete");
        assertNotEquals(COMPLETE, ResponseCompletenessAnalyzer.analyze(
                "First sentence. implementation").state(), "generic word suffix should be incomplete");
    }

    @Test
    void entireResponseSingleWordIsComplete() {
        assertState("ArrayList", COMPLETE);
        assertState("Yes", COMPLETE);
        assertState("42", COMPLETE);
    }

    @Test
    void sentenceWithTerminalWordIsComplete() {
        assertState("Use ArrayList.", COMPLETE);
        assertState("Use HashMap.", COMPLETE);
        assertState("Call foo().", COMPLETE);
    }

    @Test
    void fooOrElseIsComplete() {
        assertState("First complete sentence. foo.orElse(value)", COMPLETE);
    }

    @Test
    void headingsWithOrAreComplete() {
        assertState("## Arrays or Lists", COMPLETE);
    }

    @Test
    void bulletsWithOrAreComplete() {
        assertState("- Arrays or lists", COMPLETE);
    }

    @Test
    void trueOrFalseWithPeriodIsComplete() {
        assertState("The result is true or false.", COMPLETE);
    }

    @Test
    void blankContentReturnsNoSafeFallback() {
        assertEquals(NO_SAFE_FALLBACK, ResponseCompletenessAnalyzer.analyze("").state());
        assertEquals(NO_SAFE_FALLBACK, ResponseCompletenessAnalyzer.analyze("   ").state());
        assertEquals(NO_SAFE_FALLBACK, ResponseCompletenessAnalyzer.analyze(null).state());
    }

    // --------------------------------------------------------------- helpers

    private static void assertState(String value, ResponseCompletenessAnalyzer.State expected) {
        assertEquals(expected, ResponseCompletenessAnalyzer.analyze(value).state());
    }
}
