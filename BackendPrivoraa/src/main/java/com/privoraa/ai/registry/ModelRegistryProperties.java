package com.privoraa.ai.registry;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "privoraa.ai.registry")
public record ModelRegistryProperties(
        boolean enabled,
        Duration refreshInterval,
        Duration refreshTimeout,
        int maxMetadataEntries,
        boolean includePaid,
        boolean routingEnabled,
        boolean dryRun
) {
    public ModelRegistryProperties {
        refreshInterval = refreshInterval == null ? Duration.ofHours(1) : refreshInterval;
        refreshTimeout = refreshTimeout == null ? Duration.ofSeconds(10) : refreshTimeout;
        maxMetadataEntries = maxMetadataEntries <= 0 ? 20 : Math.min(maxMetadataEntries, 20);
    }
}
