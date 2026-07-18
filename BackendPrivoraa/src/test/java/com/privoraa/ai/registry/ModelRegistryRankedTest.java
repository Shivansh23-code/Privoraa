package com.privoraa.ai.registry;

import com.privoraa.ai.classification.*;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class ModelRegistryRankedTest {

    @Test
    void compatibleModelsFiltersByCapabilities() {
        ModelRegistry reg = registryWith(
                descriptor("text", PricingTier.FREE, Set.of(Capability.TEXT), RegistrySource.LIVE_CATALOGUE.name()),
                descriptor("vision", PricingTier.FREE, Set.of(Capability.VISION), RegistrySource.LIVE_CATALOGUE.name()));
        reg.refresh();
        RequestClassification req = new RequestClassification(IntentType.GENERAL_CHAT, ComplexityLevel.LOW,
                FreshnessRequirement.STABLE, PrivacyLevel.PUBLIC, Set.of(Capability.TEXT), 0.5, List.of());
        List<ModelDescriptor> compatible = reg.compatibleModels(req);
        assertEquals(1, compatible.size());
        assertTrue(compatible.getFirst().capabilities().contains(Capability.TEXT));
    }

    @Test
    void compatibleModelsExcludesUnknownPricing() {
        ModelRegistry reg = registryWith(
                descriptor("known", PricingTier.FREE, Set.of(Capability.TEXT), RegistrySource.LIVE_CATALOGUE.name()),
                descriptor("unknown", PricingTier.UNKNOWN, Set.of(Capability.TEXT), RegistrySource.CONFIGURATION.name()));
        reg.refresh();
        RequestClassification req = new RequestClassification(IntentType.GENERAL_CHAT, ComplexityLevel.LOW,
                FreshnessRequirement.STABLE, PrivacyLevel.PUBLIC, Set.of(Capability.TEXT), 0.5, List.of());
        List<ModelDescriptor> compatible = reg.compatibleModels(req);
        assertEquals(1, compatible.size());
        assertEquals("unregistered:known", compatible.getFirst().registryId());
    }

    @Test
    void emptyWhenNoCompatibleModels() {
        ModelRegistry reg = registryWith(
                descriptor("code-only", PricingTier.FREE, Set.of(Capability.CODE), RegistrySource.LIVE_CATALOGUE.name()));
        reg.refresh();
        RequestClassification req = new RequestClassification(IntentType.GENERAL_CHAT, ComplexityLevel.LOW,
                FreshnessRequirement.STABLE, PrivacyLevel.PUBLIC, Set.of(Capability.VISION), 0.5, List.of());
        assertTrue(reg.compatibleModels(req).isEmpty());
    }

    private ModelRegistry registryWith(ModelDescriptor... descs) {
        return new ModelRegistry(List.of(new StaticAdapter(List.of(descs))),
                new ModelRegistryProperties(true, Duration.ofHours(1), Duration.ofSeconds(1), 20, false, false, false),
                new PrivacyPolicyEvaluator());
    }

    static ModelDescriptor descriptor(String id, PricingTier pricing, Set<Capability> caps, String source) {
        return new ModelDescriptor("unregistered:" + id, ModelProvider.UNKNOWN, id, id,
                ExecutionTopology.CLOUD, ModelAvailability.UNKNOWN, pricing, caps, null, null,
                true, true, source, Instant.now(), java.util.Map.of());
    }

    private static final class StaticAdapter implements ProviderModelAdapter {
        private final List<ModelDescriptor> models;
        StaticAdapter(List<ModelDescriptor> models) { this.models = models; }
        public ModelProvider provider() { return ModelProvider.UNKNOWN; }
        public RegistryRefreshResult refresh() {
            return RegistryRefreshResult.success(provider(), models, RegistrySource.LIVE_CATALOGUE, 0);
        }
        public List<ModelDescriptor> fallbackModels() { return models; }
    }
}
