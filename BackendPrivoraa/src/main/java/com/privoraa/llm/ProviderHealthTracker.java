package com.privoraa.llm;

import com.privoraa.config.FallbackProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ProviderHealthTracker {

    private static final Logger log = LoggerFactory.getLogger(ProviderHealthTracker.class);

    private final FallbackProperties fallbackProps;

    private final Map<String, ModelHealth> entries = new ConcurrentHashMap<>();

    public ProviderHealthTracker(FallbackProperties fallbackProps) {
        this.fallbackProps = fallbackProps;
    }

    public boolean isHealthy(String providerId, String modelId) {
        String key = key(providerId, modelId);
        ModelHealth h = entries.get(key);
        if (h == null) return true;
        if (h.cooldownUntil() == null) return true;
        return Instant.now().isAfter(h.cooldownUntil());
    }

    public void recordRetryableFailure(String providerId, String modelId) {
        recordRetryableFailure(providerId, modelId, RetryableErrorClassifier.Category.RETRYABLE_SERVER_ERROR, null);
    }

    public void recordRetryableFailure(String providerId, String modelId,
                                        RetryableErrorClassifier.Category category) {
        recordRetryableFailure(providerId, modelId, category, null);
    }

    public void recordRetryableFailure(String providerId, String modelId,
                                        RetryableErrorClassifier.Category category,
                                        Duration retryAfter) {
        String key = key(providerId, modelId);
        Instant now = Instant.now();
        Duration cooldown = resolveCooldown(category, retryAfter);
        entries.compute(key, (k, existing) -> {
            int consecutive = (existing != null) ? existing.consecutiveRetryableFailures() + 1 : 1;
            Instant cooldownUntil = now.plus(cooldown);
            log.info("Provider health retryable failure provider={} model={} category={} "
                            + "consecutiveRetryableFailures={} cooldownUntil={}",
                    providerId, modelId, category, consecutive, cooldownUntil);
            return new ModelHealth(consecutive, now, cooldownUntil, existing != null ? existing.lastSuccessAt() : null);
        });
    }

    public void recordNonRetryableFailure(String providerId, String modelId) {
        String key = key(providerId, modelId);
        entries.remove(key);
        log.info("Provider health non-retryable failure provider={} model={}", providerId, modelId);
    }

    public void recordSuccess(String providerId, String modelId) {
        String key = key(providerId, modelId);
        Instant now = Instant.now();
        entries.put(key, new ModelHealth(0, null, null, now));
        log.info("Provider health success provider={} model={}", providerId, modelId);
    }

    private Duration resolveCooldown(RetryableErrorClassifier.Category category, Duration retryAfter) {
        if (retryAfter != null && !retryAfter.isNegative() && !retryAfter.isZero()) {
            return retryAfter;
        }
        return switch (category) {
            case RETRYABLE_RATE_LIMIT -> fallbackProps.rateLimitCooldown();
            case RETRYABLE_SERVER_ERROR -> fallbackProps.serverErrorCooldown();
            case RETRYABLE_TIMEOUT -> fallbackProps.timeoutCooldown();
            case RETRYABLE_NETWORK -> fallbackProps.networkCooldown();
            case NON_RETRYABLE_CLIENT, NON_RETRYABLE_SAFETY, NON_RETRYABLE_PRIVACY, NON_RETRYABLE_CANCELLED ->
                    Duration.ZERO;
        };
    }

    private static String key(String providerId, String modelId) {
        return providerId + ":" + modelId;
    }

    private record ModelHealth(
            int consecutiveRetryableFailures,
            Instant lastFailureAt,
            Instant cooldownUntil,
            Instant lastSuccessAt
    ) {}
}
