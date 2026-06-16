package com.privoraa.catalog;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * One curated model in {@code model-catalog.json}. {@code tier} is static guidance
 * for the target 8 GB / 4 GB-VRAM laptop ("fits" | "stretch" | "not_recommended");
 * {@code fitsThisMachine} is computed at request time against the configured RAM
 * budget and is therefore NOT part of this on-disk record.
 *
 * <p>{@code plan} is the subscription tier required to download the model
 * ("free" | "plus" | "pro"); omitted/null ⇒ free. Distinct from {@code tier},
 * which is hardware-fit guidance, not entitlement.
 */
public record CatalogModel(
        String tag,
        String displayName,
        String category,
        double sizeGbApprox,
        int minRamGbHint,
        int vramFitsGb,
        String tier,
        @JsonProperty("default") boolean isDefault,
        String blurb,
        String plan
) {}
