package com.privoraa.routing;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class IntentClassifierTest {

    private final IntentClassifier classifier = new IntentClassifier();

    @Test
    void detectsCodeFromKeywords() {
        assertEquals("code", classifier.classify("There is a bug in this function", null, false).category());
    }

    @Test
    void detectsReasoningFromMath() {
        assertEquals("reasoning",
                classifier.classify("Solve the integral step by step", null, false).category());
    }

    @Test
    void modeBiasesCategory() {
        assertEquals("code", classifier.classify("anything at all", "code_mentor", false).category());
        assertEquals("math", classifier.classify("anything at all", "math_solver", false).category());
    }

    @Test
    void ragForcesGeneral() {
        assertEquals("general", classifier.classify("def add(a, b): return a + b", null, true).category());
    }

    @Test
    void shortPromptPrefersFast() {
        assertEquals("fast", classifier.classify("hi there", null, false).category());
    }

    @Test
    void longGeneralPromptIsGeneral() {
        String longText = "Tell me about the history of the Roman empire and how it eventually "
                + "declined over several centuries of political change.";
        assertEquals("general", classifier.classify(longText, null, false).category());
    }
}
