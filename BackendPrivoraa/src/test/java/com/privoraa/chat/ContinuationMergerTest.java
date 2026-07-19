package com.privoraa.chat;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class ContinuationMergerTest {
    @Test void exactSentenceOverlap() {
        assertEquals("Alpha. Repeated sentence. Beta.",
                ContinuationMerger.merge("Alpha. Repeated sentence.", "Repeated sentence. Beta.", 100));
    }
    @Test void paragraphOverlap() {
        assertEquals("First\n\nRepeated paragraph.\n\nLast",
                ContinuationMerger.merge("First\n\nRepeated paragraph.", "Repeated paragraph.\n\nLast", 100));
    }
    @Test void noOverlap() { assertEquals("alphabeta", ContinuationMerger.merge("alpha", "beta", 100)); }
    @Test void partialWordDoesNotCorrupt() { assertEquals("allocationcation", ContinuationMerger.merge("allocation", "cation", 100)); }
    @Test void codeFenceBoundary() {
        assertEquals("```java\nint x;\n```\nNext", ContinuationMerger.merge(
                "```java\nint x;\n```", "```\nNext", 100));
    }
    @Test void emptyContinuation() { assertEquals("kept", ContinuationMerger.merge("kept", "", 100)); }
    @Test void emptyPrevious() { assertEquals("next", ContinuationMerger.merge("", "next", 100)); }
    @Test void unicodeOverlap() {
        assertEquals("नमस्ते दुनिया — सीखें आगे", ContinuationMerger.merge(
                "नमस्ते दुनिया — सीखें", "दुनिया — सीखें आगे", 100));
    }
    @Test void markdownHeadingOverlap() {
        assertEquals("Intro\n\n## Searching\nDetails", ContinuationMerger.merge(
                "Intro\n\n## Searching", "## Searching\nDetails", 100));
    }
    @Test void listItemOverlap() {
        assertEquals("- first\n- repeated item\n- last", ContinuationMerger.merge(
                "- first\n- repeated item", "- repeated item\n- last", 100));
    }
    @Test void overlapOutsideWindowIsPreserved() {
        String repeated = "This paragraph is longer than the configured overlap window.";
        assertEquals("prefix " + repeated + repeated + " suffix",
                ContinuationMerger.merge("prefix " + repeated, repeated + " suffix", 10));
    }
}
