package com.privoraa.ai.registry;

import com.privoraa.ai.classification.*;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class ModelRegistryTest {

    @Test
    void descriptorValidatesAndDefensivelyCopiesUnknownNumerics() {
        Set<Capability> caps = new HashSet<>(Set.of(Capability.TEXT));
        Map<String, String> metadata = new HashMap<>(Map.of("kind", "chat"));
        ModelDescriptor descriptor = descriptor("free", ModelProvider.OPENROUTER,
                ExecutionTopology.CLOUD, PricingTier.FREE, caps, metadata, true);
        caps.add(Capability.CODE); metadata.put("secret", "no");
        assertEquals(Set.of(Capability.TEXT), descriptor.capabilities());
        assertEquals(Map.of("kind", "chat"), descriptor.metadata());
        assertNull(descriptor.contextWindow());
        assertNull(descriptor.maxOutputTokens());
        assertThrows(IllegalArgumentException.class, () -> new ModelDescriptor(" ", ModelProvider.UNKNOWN,
                "x", "x", ExecutionTopology.CLOUD, ModelAvailability.UNKNOWN, PricingTier.UNKNOWN,
                Set.of(), null, null, false, false, "test", Instant.now(), Map.of()));
    }

    @Test
    void aggregatesFiltersRetainsLastKnownGoodAndAppliesFreeFirst() {
        MutableAdapter open = new MutableAdapter(ModelProvider.OPENROUTER,
                List.of(descriptor("free", ModelProvider.OPENROUTER, ExecutionTopology.CLOUD,
                        PricingTier.FREE, Set.of(Capability.TEXT), Map.of(), true),
                        descriptor("paid", ModelProvider.OPENROUTER, ExecutionTopology.CLOUD,
                                PricingTier.PAID, Set.of(Capability.CODE), Map.of(), true)));
        MutableAdapter gemini = new MutableAdapter(ModelProvider.GEMINI,
                List.of(descriptor("gemini", ModelProvider.GEMINI, ExecutionTopology.CLOUD,
                        PricingTier.UNKNOWN, Set.of(Capability.CODE), Map.of(), false)));
        ModelRegistry registry = registry(List.of(open, gemini));
        ModelRegistrySnapshot before = registry.currentSnapshot();
        ModelRegistrySnapshot live = registry.refresh();

        assertEquals(3, live.models().size());
        assertEquals(2, registry.byProvider(ModelProvider.OPENROUTER).size());
        assertEquals(2, registry.withCapability(Capability.CODE).size());
        assertEquals(1, registry.byPricing(PricingTier.PAID).size());
        assertFalse(registry.find("openrouter:paid").orElseThrow().selectable());
        assertNotSame(before, live);
        assertThrows(UnsupportedOperationException.class,
                () -> live.modelsById().put("x", live.models().getFirst()));

        open.fail = true;
        ModelRegistrySnapshot retained = registry.refresh();
        assertTrue(retained.modelsById().containsKey("openrouter:free"));
        assertEquals(RegistrySource.LAST_KNOWN_GOOD,
                retained.providerResults().get(ModelProvider.OPENROUTER).source());
        assertTrue(retained.modelsById().containsKey("gemini:gemini"));
    }

    @Test
    void topologyMappingPreservesLocalOnlyPolicyAndPublicCloudEligibility() {
        MutableAdapter adapter = new MutableAdapter(ModelProvider.UNKNOWN, List.of(
                descriptor("cloud", ModelProvider.OPENROUTER, ExecutionTopology.CLOUD,
                        PricingTier.FREE, Set.of(Capability.TEXT), Map.of(), true),
                descriptor("server", ModelProvider.OLLAMA, ExecutionTopology.SERVER_HOST_LOCAL,
                        PricingTier.LOCAL, Set.of(Capability.TEXT, Capability.LOCAL_INFERENCE), Map.of(), true),
                descriptor("browser", ModelProvider.OLLAMA, ExecutionTopology.BROWSER_DEVICE_LOCAL,
                        PricingTier.LOCAL, Set.of(Capability.TEXT, Capability.LOCAL_INFERENCE), Map.of(), true)));
        ModelRegistry registry = registry(List.of(adapter)); registry.refresh();
        RequestClassification local = new RequestClassification(IntentType.PRIVATE_LOCAL, ComplexityLevel.LOW,
                FreshnessRequirement.STABLE, PrivacyLevel.LOCAL_ONLY,
                Set.of(Capability.TEXT, Capability.LOCAL_INFERENCE), .95,
                List.of(ClassificationReason.EXPLICIT_LOCAL_ONLY_REQUEST));
        assertEquals(List.of("ollama:browser"), registry.compatibleModels(local).stream()
                .map(ModelDescriptor::registryId).toList());
        RequestClassification publicRequest = RequestClassification.conservativeFallback(false);
        assertTrue(registry.compatibleModels(publicRequest).stream()
                .anyMatch(m -> m.topology() == ExecutionTopology.CLOUD));
        assertEquals(ExecutionTarget.SERVER_SIDE_OLLAMA,
                ExecutionTargetMapper.map(ExecutionTopology.SERVER_HOST_LOCAL));
    }

    private ModelRegistry registry(List<ProviderModelAdapter> adapters) {
        return new ModelRegistry(adapters, new ModelRegistryProperties(true, Duration.ofHours(1),
                Duration.ofSeconds(1), 20, false, false, false), new PrivacyPolicyEvaluator());
    }

    static ModelDescriptor descriptor(String id, ModelProvider provider, ExecutionTopology topology,
                                      PricingTier pricing, Set<Capability> caps,
                                      Map<String, String> metadata, boolean selectable) {
        return new ModelDescriptor(provider.name().toLowerCase() + ":" + id, provider, id, id, topology,
                ModelAvailability.UNKNOWN, pricing, caps, null, null, true, selectable,
                "TEST", Instant.now(), metadata);
    }

    private static final class MutableAdapter implements ProviderModelAdapter {
        private final ModelProvider provider; private final List<ModelDescriptor> models; boolean fail;
        private MutableAdapter(ModelProvider provider, List<ModelDescriptor> models) {
            this.provider = provider; this.models = models;
        }
        public ModelProvider provider() { return provider; }
        public RegistryRefreshResult refresh() { return fail
                ? RegistryRefreshResult.failure(provider, RegistryReasonCode.CATALOGUE_UNAVAILABLE)
                : RegistryRefreshResult.success(provider, models, RegistrySource.LIVE_CATALOGUE, 0); }
        public List<ModelDescriptor> fallbackModels() { return models; }
    }
}
