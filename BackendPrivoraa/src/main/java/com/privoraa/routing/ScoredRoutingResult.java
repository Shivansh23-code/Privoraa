package com.privoraa.routing;

import com.privoraa.ai.registry.ExecutionTopology;
import com.privoraa.ai.registry.ModelProvider;
import com.privoraa.ai.registry.PricingTier;

import java.util.List;

public record ScoredRoutingResult(
        String registryId,
        String providerModelId,
        String displayName,
        String category,
        String reason,
        List<String> chain,
        ModelProvider provider,
        PricingTier pricingTier,
        ExecutionTopology topology,
        String registrySource
) {
    public Routed toRouted() {
        return new Routed(providerModelId, displayName, category, reason, chain);
    }
}
