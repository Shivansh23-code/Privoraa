package com.privoraa.ai.registry;

import com.privoraa.ai.classification.Capability;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public record ModelDescriptor(
        String registryId,
        ModelProvider provider,
        String providerModelId,
        String displayName,
        ExecutionTopology topology,
        ModelAvailability availability,
        PricingTier pricingTier,
        Set<Capability> capabilities,
        Integer contextWindow,
        Integer maxOutputTokens,
        boolean streamingSupported,
        boolean selectable,
        String source,
        Instant observedAt,
        Map<String, String> metadata
) {
    private static final int MAX_METADATA_ENTRIES = 20;
    private static final int MAX_METADATA_VALUE_LENGTH = 256;

    public ModelDescriptor {
        registryId = requireText(registryId, "registryId");
        providerModelId = requireText(providerModelId, "providerModelId");
        displayName = requireText(displayName, "displayName");
        source = requireText(source, "source");
        Objects.requireNonNull(provider, "provider");
        Objects.requireNonNull(topology, "topology");
        Objects.requireNonNull(availability, "availability");
        Objects.requireNonNull(pricingTier, "pricingTier");
        observedAt = Objects.requireNonNull(observedAt, "observedAt");
        capabilities = Set.copyOf(capabilities == null ? Set.of() : capabilities);
        if (contextWindow != null && contextWindow <= 0) throw new IllegalArgumentException("contextWindow");
        if (maxOutputTokens != null && maxOutputTokens <= 0) throw new IllegalArgumentException("maxOutputTokens");
        LinkedHashMap<String, String> safe = new LinkedHashMap<>();
        if (metadata != null) {
            metadata.forEach((key, value) -> {
                if (safe.size() < MAX_METADATA_ENTRIES && key != null && !key.isBlank() && value != null) {
                    safe.put(limit(key, 64), limit(value, MAX_METADATA_VALUE_LENGTH));
                }
            });
        }
        metadata = Map.copyOf(safe);
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value.trim();
    }

    private static String limit(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
