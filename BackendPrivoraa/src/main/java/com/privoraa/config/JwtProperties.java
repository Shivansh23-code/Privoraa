package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "privoraa.jwt")
public record JwtProperties(
        String secret,
        long accessTtlMin,
        long refreshTtlDays
) {}
