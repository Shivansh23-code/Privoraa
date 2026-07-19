package com.privoraa.config;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ChatOutputPropertiesTest {

    private final ChatOutputProperties props = new ChatOutputProperties(
            2048, 4096, 6144, 8192, 6144, 6144, 4096, 4096, 512);

    @Test
    void learningBudgetIsGreaterThanGeneral() {
        assertTrue(props.learningMaxTokens() > props.generalMaxTokens(),
                "learning budget (%d) should exceed general budget (%d)"
                        .formatted(props.learningMaxTokens(), props.generalMaxTokens()));
    }

    @Test
    void codeBudgetIsAtLeast8192() {
        assertTrue(props.codeMaxTokens() >= 8192,
                "code budget (%d) should be at least 8192".formatted(props.codeMaxTokens()));
    }

    @Test
    void reasoningBudgetIsAtLeast6144() {
        assertTrue(props.reasoningMaxTokens() >= 6144,
                "reasoning budget (%d) should be at least 6144".formatted(props.reasoningMaxTokens()));
    }

    @Test
    void learningCategoryReturnsLearningBudget() {
        assertEquals(props.learningMaxTokens(), props.budgetForCategory("learning"));
    }

    @Test
    void codeCategoryReturnsCodeBudget() {
        assertEquals(props.codeMaxTokens(), props.budgetForCategory("code"));
    }

    @Test
    void reasoningCategoryReturnsReasoningBudget() {
        assertEquals(props.reasoningMaxTokens(), props.budgetForCategory("reasoning"));
    }

    @Test
    void documentCategoryReturnsDocumentBudget() {
        assertEquals(props.documentMaxTokens(), props.budgetForCategory("document"));
    }

    @Test
    void visionCategoryReturnsVisionBudget() {
        assertEquals(props.visionMaxTokens(), props.budgetForCategory("vision"));
    }

    @Test
    void fastCategoryReturnsFastBudget() {
        assertEquals(props.fastMaxTokens(), props.budgetForCategory("fast"));
    }

    @Test
    void unknownCategoryReturnsGeneral() {
        assertEquals(props.generalMaxTokens(), props.budgetForCategory("multilingual"));
    }

    @Test
    void nullCategoryReturnsGeneral() {
        assertEquals(props.generalMaxTokens(), props.budgetForCategory(null));
    }

    @Test
    void defaultValuesAppliedWhenZero() {
        ChatOutputProperties zero = new ChatOutputProperties(0, 0, 0, 0, 0, 0, 0, 0, 0);
        assertEquals(2048, zero.fastMaxTokens());
        assertEquals(4096, zero.generalMaxTokens());
        assertEquals(6144, zero.learningMaxTokens());
        assertEquals(8192, zero.codeMaxTokens());
        assertEquals(6144, zero.reasoningMaxTokens());
        assertEquals(6144, zero.documentMaxTokens());
        assertEquals(4096, zero.visionMaxTokens());
        assertEquals(4096, zero.unknownModelMaxTokens());
        assertEquals(512, zero.safetyMargin());
    }

    @Test
    void defaultValuesAppliedWhenNegative() {
        ChatOutputProperties neg = new ChatOutputProperties(-1, -1, -1, -1, -1, -1, -1, -1, -1);
        assertEquals(2048, neg.fastMaxTokens());
        assertEquals(4096, neg.generalMaxTokens());
        assertEquals(6144, neg.learningMaxTokens());
        assertEquals(8192, neg.codeMaxTokens());
        assertEquals(6144, neg.reasoningMaxTokens());
        assertEquals(6144, neg.documentMaxTokens());
        assertEquals(4096, neg.visionMaxTokens());
        assertEquals(4096, neg.unknownModelMaxTokens());
        assertEquals(512, neg.safetyMargin());
    }

    @Test
    void mathCategoryMapsToReasoningBudget() {
        assertEquals(props.reasoningMaxTokens(), props.budgetForCategory("math"));
    }
}
