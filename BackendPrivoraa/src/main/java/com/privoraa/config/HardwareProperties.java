package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Local hardware budget used to annotate the model catalog with a
 * "fits this machine" flag (Phase 2). Defaults to the target 8 GB laptop.
 */
@ConfigurationProperties(prefix = "privoraa.hardware")
public record HardwareProperties(
        Integer ramBudgetGb
) {
    public HardwareProperties {
        if (ramBudgetGb == null || ramBudgetGb <= 0) {
            ramBudgetGb = 8;
        }
    }
}
