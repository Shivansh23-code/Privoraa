package com.privoraa.llm;

import com.privoraa.config.FallbackProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class ProviderHealthTrackerTest {

    private FallbackProperties fallbackProps;
    private ProviderHealthTracker tracker;

    @BeforeEach
    void setUp() {
        fallbackProps = new FallbackProperties(
                Duration.ofSeconds(120),
                Duration.ofSeconds(30),
                Duration.ofSeconds(15),
                Duration.ofSeconds(30),
                true,
                4
        );
        tracker = new ProviderHealthTracker(fallbackProps);
    }

    @Test
    void unknownProviderIsHealthy() {
        assertTrue(tracker.isHealthy("unknown", "model"));
    }

    @Test
    void successClearsFailureState() {
        tracker.recordRetryableFailure("gemini", "gemini-2.0-flash");
        tracker.recordSuccess("gemini", "gemini-2.0-flash");
        assertTrue(tracker.isHealthy("gemini", "gemini-2.0-flash"));
    }

    @Test
    void nonRetryableFailureDoesNotCreateEntry() {
        tracker.recordNonRetryableFailure("gemini", "gemini-2.0-flash");
        assertTrue(tracker.isHealthy("gemini", "gemini-2.0-flash"));
    }

    @Test
    void retryableFailureCreatesCooldown() {
        tracker.recordRetryableFailure("openrouter", "gpt-4");
        assertFalse(tracker.isHealthy("openrouter", "gpt-4"));
    }

    @Test
    void cooldownExpiresAfterDuration() {
        tracker.recordRetryableFailure("openrouter", "gpt-4");
        assertFalse(tracker.isHealthy("openrouter", "gpt-4"));
        try {
            Thread.sleep(10);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        assertFalse(tracker.isHealthy("openrouter", "gpt-4"),
                "still in cooldown (120s), 10ms should not expire it");
    }

    @Test
    void differentModelsHaveIndependentHealth() {
        tracker.recordRetryableFailure("openrouter", "gpt-4");
        assertFalse(tracker.isHealthy("openrouter", "gpt-4"));
        assertTrue(tracker.isHealthy("openrouter", "claude-3"));
        assertTrue(tracker.isHealthy("gemini", "gemini-2.0-flash"));
    }

    @Test
    void retryAfterCooldownIsUsedWhenProvided() {
        tracker.recordRetryableFailure("openrouter", "gpt-4", RetryableErrorClassifier.Category.RETRYABLE_RATE_LIMIT, Duration.ofMillis(50));
        assertFalse(tracker.isHealthy("openrouter", "gpt-4"));
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        assertTrue(tracker.isHealthy("openrouter", "gpt-4"));
    }

    @Test
    void consecutiveFailuresUpdateEntry() {
        tracker.recordRetryableFailure("gemini", "gemini-2.0-flash");
        tracker.recordRetryableFailure("gemini", "gemini-2.0-flash");
        assertFalse(tracker.isHealthy("gemini", "gemini-2.0-flash"));
        tracker.recordSuccess("gemini", "gemini-2.0-flash");
        assertTrue(tracker.isHealthy("gemini", "gemini-2.0-flash"));
    }

    @Test
    void successAfterFailureResets() {
        tracker.recordRetryableFailure("openrouter", "gpt-4");
        assertFalse(tracker.isHealthy("openrouter", "gpt-4"));
        tracker.recordSuccess("openrouter", "gpt-4");
        assertTrue(tracker.isHealthy("openrouter", "gpt-4"));
    }

    @Test
    void rateLimitCategoryUsesRateLimitCooldown() {
        tracker.recordRetryableFailure("p", "m", RetryableErrorClassifier.Category.RETRYABLE_RATE_LIMIT);
        assertFalse(tracker.isHealthy("p", "m"));
    }

    @Test
    void serverErrorCategoryUsesServerErrorCooldown() {
        tracker.recordRetryableFailure("p", "m", RetryableErrorClassifier.Category.RETRYABLE_SERVER_ERROR);
        assertFalse(tracker.isHealthy("p", "m"));
    }

    @Test
    void timeoutCategoryUsesTimeoutCooldown() {
        tracker.recordRetryableFailure("p", "m", RetryableErrorClassifier.Category.RETRYABLE_TIMEOUT);
        assertFalse(tracker.isHealthy("p", "m"));
    }

    @Test
    void networkCategoryUsesNetworkCooldown() {
        tracker.recordRetryableFailure("p", "m", RetryableErrorClassifier.Category.RETRYABLE_NETWORK);
        assertFalse(tracker.isHealthy("p", "m"));
    }

    @Test
    void retryAfterOverridesConfiguredCooldown() {
        tracker.recordRetryableFailure("p", "m", RetryableErrorClassifier.Category.RETRYABLE_RATE_LIMIT, Duration.ofMillis(30));
        assertFalse(tracker.isHealthy("p", "m"));
        try {
            Thread.sleep(80);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        assertTrue(tracker.isHealthy("p", "m"));
    }
}
