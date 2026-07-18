package com.privoraa.llm;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ChatOptionsTest {

    @Test
    void codeCategoryHasHighestBudget() {
        ChatOptions opts = ChatOptions.forCategory("code");
        assertEquals(0.2, opts.temperature());
        assertEquals(8192, opts.maxTokens());
    }

    @Test
    void mathCategory() {
        ChatOptions opts = ChatOptions.forCategory("math");
        assertEquals(0.2, opts.temperature());
        assertEquals(4096, opts.maxTokens());
    }

    @Test
    void reasoningCategory() {
        ChatOptions opts = ChatOptions.forCategory("reasoning");
        assertEquals(0.4, opts.temperature());
        assertEquals(4096, opts.maxTokens());
    }

    @Test
    void generalCategory() {
        ChatOptions opts = ChatOptions.forCategory("general");
        assertEquals(0.6, opts.temperature());
        assertEquals(2048, opts.maxTokens());
    }

    @Test
    void nullCategoryDefaultsToGeneral() {
        ChatOptions opts = ChatOptions.forCategory(null);
        assertEquals(2048, opts.maxTokens());
    }

    @Test
    void fastCategoryDefaultsToGeneralBudget() {
        ChatOptions opts = ChatOptions.forCategory("fast");
        assertEquals(2048, opts.maxTokens());
    }

    @Test
    void clampAgainstKnownContextWindow() {
        ChatOptions opts = ChatOptions.forCategory("code");
        // 16384 context / 2 = 8192 → min(8192, 8192) = 8192
        ChatOptions clamped = opts.withClampedMaxTokens(16384);
        assertEquals(8192, clamped.maxTokens());
    }

    @Test
    void clampsBelowHalfContext() {
        ChatOptions opts = ChatOptions.forCategory("code");
        // 4096 context / 2 = 2048 → min(8192, 2048) = 2048
        ChatOptions clamped = opts.withClampedMaxTokens(4096);
        assertEquals(2048, clamped.maxTokens());
    }

    @Test
    void clampsGeneralBelowSmallContext() {
        ChatOptions opts = ChatOptions.forCategory("general");
        // 2048 context / 2 = 1024 → min(2048, 1024) = 1024
        ChatOptions clamped = opts.withClampedMaxTokens(2048);
        assertEquals(1024, clamped.maxTokens());
    }

    @Test
    void usesConservativeCeilingWhenContextUnknown() {
        ChatOptions opts = ChatOptions.forCategory("code");
        // unknown context → ceiling 2048 → min(8192, 2048) = 2048
        ChatOptions clamped = opts.withClampedMaxTokens(null);
        assertEquals(2048, clamped.maxTokens());
    }

    @Test
    void zeroContextUsesConservativeCeiling() {
        ChatOptions opts = ChatOptions.forCategory("code");
        ChatOptions clamped = opts.withClampedMaxTokens(0);
        assertEquals(2048, clamped.maxTokens());
    }

    @Test
    void minimumCeilingIs256Tokens() {
        ChatOptions opts = ChatOptions.forCategory("general");
        // 256 context / 2 = 128 → Math.max(256, 128) = 256
        ChatOptions clamped = opts.withClampedMaxTokens(256);
        assertEquals(256, clamped.maxTokens());
    }

    @Test
    void returnsSameInstanceWhenNoClampNeeded() {
        ChatOptions opts = ChatOptions.forCategory("general");
        ChatOptions clamped = opts.withClampedMaxTokens(32768);
        assertSame(opts, clamped);
    }

    @Test
    void nullMaxTokensSkipsClamping() {
        ChatOptions opts = new ChatOptions(0.6, null, 0.9, 0.3, 0.2);
        ChatOptions clamped = opts.withClampedMaxTokens(1024);
        assertSame(opts, clamped);
    }
}
