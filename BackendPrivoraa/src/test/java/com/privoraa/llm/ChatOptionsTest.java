package com.privoraa.llm;

import com.privoraa.config.ChatOutputProperties;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ChatOptionsTest {

    @Test
    void codeCategoryHasHighestBudget() {
        ChatOptions opts = ChatOptions.forCategory("code");
        assertEquals(0.2, opts.temperature());
        assertEquals(12288, opts.maxTokens());
    }

    @Test
    void mathCategory() {
        ChatOptions opts = ChatOptions.forCategory("math");
        assertEquals(0.2, opts.temperature());
        assertEquals(8192, opts.maxTokens());
    }

    @Test
    void reasoningCategory() {
        ChatOptions opts = ChatOptions.forCategory("reasoning");
        assertEquals(0.4, opts.temperature());
        assertEquals(8192, opts.maxTokens());
    }

    @Test
    void generalCategory() {
        ChatOptions opts = ChatOptions.forCategory("general");
        assertEquals(0.6, opts.temperature());
        assertEquals(6144, opts.maxTokens());
    }

    @Test
    void nullCategoryDefaultsToGeneral() {
        ChatOptions opts = ChatOptions.forCategory(null);
        assertEquals(6144, opts.maxTokens());
    }

    @Test
    void fastCategoryDefaultsToFastBudget() {
        ChatOptions opts = ChatOptions.forCategory("fast");
        assertEquals(2048, opts.maxTokens());
    }

    @Test
    void clampAgainstKnownContextWindow() {
        ChatOptions opts = ChatOptions.forCategory("code");
        // 24576 context / 2 = 12288 → min(12288, 12288) = 12288
        ChatOptions clamped = opts.withClampedMaxTokens(24576);
        assertEquals(12288, clamped.maxTokens());
    }

    @Test
    void clampsBelowHalfContext() {
        ChatOptions opts = ChatOptions.forCategory("code");
        // 4096 context / 2 = 2048 → min(12288, 2048) = 2048
        ChatOptions clamped = opts.withClampedMaxTokens(4096);
        assertEquals(2048, clamped.maxTokens());
    }

    @Test
    void clampsGeneralBelowSmallContext() {
        ChatOptions opts = ChatOptions.forCategory("general");
        // 2048 context / 2 = 1024 → min(6144, 1024) = 1024
        ChatOptions clamped = opts.withClampedMaxTokens(2048);
        assertEquals(1024, clamped.maxTokens());
    }

    @Test
    void usesConservativeCeilingWhenContextUnknown() {
        ChatOptions opts = ChatOptions.forCategory("code");
        // unknown context → ceiling 2048 → min(12288, 2048) = 2048
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

    // ---- withOutputClamp tests ----

    private final ChatOutputProperties testProps = new ChatOutputProperties(
            2048, 6144, 8192, 12288, 8192, 10240, 4096, 4096, 512);

    @Test
    void outputClampUsesConfiguredBudget() {
        ChatOptions opts = ChatOptions.forCategory("code", testProps);
        // 12288 budget, large context, no descriptor limit
        ChatOptions clamped = opts.withOutputClamp(12288, 128_000, null, 500, 512, 4096);
        assertEquals(12288, clamped.maxTokens());
    }

    @Test
    void outputClampSubtractsPromptTokensFromContext() {
        ChatOptions opts = ChatOptions.forCategory("general", testProps);
        // general=6144, context=8192, prompt=5000, safety=512
        // available = 8192 - 5000 - 512 = 2680
        // min(6144, 2680) = 2680
        ChatOptions clamped = opts.withOutputClamp(6144, 8192, null, 5000, 512, 4096);
        assertEquals(2680, clamped.maxTokens());
    }

    @Test
    void outputClampSafetyMarginIsApplied() {
        ChatOptions opts = ChatOptions.forCategory("general", testProps);
        // available = 6144 - 2000 - 1024 = 3120 with safety=1024
        // available = 6144 - 2000 - 512 = 3632 with safety=512
        // clamp to context: min(6144, 4096-2000-1024) = min(6144, 1072) = 1072 for safe1024
        // and min(6144, 4096-2000-512) = min(6144, 1584) = 1584 for safe512
        ChatOptions safe1024 = opts.withOutputClamp(6144, 4096, null, 2000, 1024, 4096);
        ChatOptions safe512 = opts.withOutputClamp(6144, 4096, null, 2000, 512, 4096);
        assertEquals(1072, safe1024.maxTokens());
        assertEquals(1584, safe512.maxTokens());
        assertTrue(safe1024.maxTokens() < safe512.maxTokens(),
                "larger safety margin should produce smaller maxTokens");
    }

    @Test
    void outputClampDescriptorLimitReducesBudget() {
        ChatOptions opts = ChatOptions.forCategory("code", testProps);
        // code=12288, descriptor limits to 4096
        ChatOptions clamped = opts.withOutputClamp(12288, 128_000, 4096, 500, 512, 4096);
        assertEquals(4096, clamped.maxTokens());
    }

    @Test
    void outputClampUnknownModelUsesConfiguredFallback() {
        ChatOptions opts = ChatOptions.forCategory("code", testProps);
        // null context, no descriptor = clamp to min(12288, 4096) = 4096
        ChatOptions clamped = opts.withOutputClamp(12288, null, null, 500, 512, 4096);
        assertEquals(4096, clamped.maxTokens(),
                "should use configured unknown-model-max-tokens (4096), not hardcoded 2048");
    }

    @Test
    void outputClampCustomUnknownFallbackIsRespected() {
        ChatOptions opts = ChatOptions.forCategory("code", testProps);
        // custom fallback 2048 wins over code budget 12288
        ChatOptions clamped = opts.withOutputClamp(12288, null, null, 500, 512, 2048);
        assertEquals(2048, clamped.maxTokens(),
                "custom unknown fallback (2048) should be respected");
    }

    @Test
    void outputClampConfiguredCategoryBudgetBelowUnknownFallbackWins() {
        ChatOptions opts = ChatOptions.forCategory("fast", testProps);
        // fast=2048, unknown fallback=4096 → min(2048, 4096) = 2048
        ChatOptions clamped = opts.withOutputClamp(2048, null, null, 100, 512, 4096);
        assertEquals(2048, clamped.maxTokens(),
                "configured category budget (2048) should win over larger unknown fallback (4096)");
    }

    @Test
    void outputClampDescriptorLimitBelowUnknownFallbackWins() {
        ChatOptions opts = ChatOptions.forCategory("code", testProps);
        // code=8192, descriptor=2048, unknown fallback=4096 → min(8192, 2048, 4096) = 2048
        ChatOptions clamped = opts.withOutputClamp(8192, null, 2048, 100, 512, 4096);
        assertEquals(2048, clamped.maxTokens(),
                "descriptor limit (2048) should win over unknown fallback (4096)");
    }

    @Test
    void outputClampMinimumSafeOutputIs256() {
        ChatOptions opts = ChatOptions.forCategory("general", testProps);
        // tiny context (512) with large prompt (400) and safety (512)
        // available = 512 - 400 - 512 = -400 → use context/4 = 128 → max(256, min(6144, 128)) = 256
        ChatOptions clamped = opts.withOutputClamp(6144, 512, null, 400, 512, 4096);
        assertEquals(256, clamped.maxTokens());
    }

    @Test
    void outputClampReturnsSameInstanceWhenUnchanged() {
        ChatOptions opts = ChatOptions.forCategory("code", testProps);
        ChatOptions clamped = opts.withOutputClamp(12288, 128_000, null, 500, 512, 4096);
        assertSame(opts, clamped, "should return same instance when no clamp needed");
    }

    @Test
    void outputClampForCategoryWithPropsUsesConfigBudgets() {
        ChatOptions code = ChatOptions.forCategory("code", testProps);
        assertEquals(testProps.codeMaxTokens(), code.maxTokens());

        ChatOptions learning = ChatOptions.forCategory("learning", testProps);
        assertEquals(testProps.learningMaxTokens(), learning.maxTokens());

        ChatOptions reasoning = ChatOptions.forCategory("reasoning", testProps);
        assertEquals(testProps.reasoningMaxTokens(), reasoning.maxTokens());

        ChatOptions doc = ChatOptions.forCategory("document", testProps);
        assertEquals(testProps.documentMaxTokens(), doc.maxTokens());

        ChatOptions vision = ChatOptions.forCategory("vision", testProps);
        assertEquals(testProps.visionMaxTokens(), vision.maxTokens());

        ChatOptions fast = ChatOptions.forCategory("fast", testProps);
        assertEquals(testProps.fastMaxTokens(), fast.maxTokens());
    }

    @Test
    void outputClampWithNullPropsFallsBackToHardcoded() {
        ChatOptions opts = ChatOptions.forCategory("code", null);
        assertEquals(12288, opts.maxTokens());

        opts = ChatOptions.forCategory("general", null);
        assertEquals(6144, opts.maxTokens());
    }

    @Test
    void outputClampWithExactFitReturnsSameInstance() {
        ChatOptions opts = ChatOptions.forCategory("code", testProps);
        // 12288 budget, huge context, no descriptor — should stay at 12288
        ChatOptions clamped = opts.withOutputClamp(12288, 256_000, null, 500, 512, 4096);
        assertSame(opts, clamped);
    }

    @Test
    void outputClampWithContextSmallerThanPromptUsesFallback() {
        ChatOptions opts = ChatOptions.forCategory("general", testProps);
        // context (2048) < prompt (3000) + safety → negative available
        // fallback = context/4 = 512
        ChatOptions clamped = opts.withOutputClamp(6144, 2048, null, 3000, 512, 4096);
        assertEquals(512, clamped.maxTokens());
    }

    @Test
    void learningCategoryHasHigherBudgetThanGeneral() {
        ChatOptions learning = ChatOptions.forCategory("learning", testProps);
        ChatOptions general = ChatOptions.forCategory("general", testProps);
        assertTrue(learning.maxTokens() > general.maxTokens(),
                "learning (%d) should exceed general (%d)"
                        .formatted(learning.maxTokens(), general.maxTokens()));
    }

    @Test
    void documentCategoryHasHigherBudgetThanGeneral() {
        ChatOptions doc = ChatOptions.forCategory("document", testProps);
        ChatOptions general = ChatOptions.forCategory("general", testProps);
        assertTrue(doc.maxTokens() > general.maxTokens(),
                "document (%d) should exceed general (%d)"
                        .formatted(doc.maxTokens(), general.maxTokens()));
    }
}
