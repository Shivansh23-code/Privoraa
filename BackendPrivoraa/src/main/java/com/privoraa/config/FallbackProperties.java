package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "privoraa.chat.fallback")
public record FallbackProperties(
        Duration rateLimitCooldown,
        Duration serverErrorCooldown,
        Duration timeoutCooldown,
        Duration networkCooldown,
        boolean enabled,
        int maxCandidates
) {
    public FallbackProperties {
        if (rateLimitCooldown == null || rateLimitCooldown.isNegative() || rateLimitCooldown.isZero()) {
            rateLimitCooldown = Duration.ofSeconds(120);
        }
        if (serverErrorCooldown == null || serverErrorCooldown.isNegative() || serverErrorCooldown.isZero()) {
            serverErrorCooldown = Duration.ofSeconds(30);
        }
        if (timeoutCooldown == null || timeoutCooldown.isNegative() || timeoutCooldown.isZero()) {
            timeoutCooldown = Duration.ofSeconds(15);
        }
        if (networkCooldown == null || networkCooldown.isNegative() || networkCooldown.isZero()) {
            networkCooldown = Duration.ofSeconds(30);
        }
        if (maxCandidates <= 0) maxCandidates = 4;
    }
}
