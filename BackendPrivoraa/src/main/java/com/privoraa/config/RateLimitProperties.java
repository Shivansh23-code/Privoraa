package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "privoraa.ratelimit")
public record RateLimitProperties(
        int requestsPerMin,
        int requestsPerDay
) {}
