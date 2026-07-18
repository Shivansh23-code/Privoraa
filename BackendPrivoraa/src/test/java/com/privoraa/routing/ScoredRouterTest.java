package com.privoraa.routing;

import com.privoraa.ai.classification.*;
import com.privoraa.ai.registry.*;
import com.privoraa.chat.dto.ChatRequest;
import com.privoraa.config.GeminiProperties;
import com.privoraa.llm.LlmProvider;
import com.privoraa.llm.LlmProviderResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ScoredRouterTest {

    private ModelRegistry registry;
    private LlmProviderResolver providers;
    private GeminiProperties gemini;
    private ModelRegistryProperties registryProps;

    @BeforeEach
    void setUp() {
        registryProps = new ModelRegistryProperties(true, Duration.ofHours(1), Duration.ofSeconds(1),
                20, false, true, false);
        gemini = mock(GeminiProperties.class);
        when(gemini.configured()).thenReturn(false);
        providers = mock(LlmProviderResolver.class);
    }

    private ModelRegistry registryWith(ModelDescriptor... descs) {
        return new ModelRegistry(List.of(new StaticAdapter(List.of(descs))), registryProps,
                new PrivacyPolicyEvaluator());
    }

    private ScoredRouter router(ModelRegistry reg) {
        return new ScoredRouter(reg, registryProps, gemini, providers);
    }

    private ScoredRoutingResult resolve(ScoredRouter r, IntentType intent, Set<Capability> caps) {
        RequestClassification c = new RequestClassification(intent, ComplexityLevel.LOW,
                FreshnessRequirement.STABLE, PrivacyLevel.PUBLIC, caps, 0.5, List.of());
        return r.resolve(c, req("auto"), cloudProvider());
    }

    @Test
    void codingRequestRanksCodeModelFirst() {
        registry = registryWith(
                descriptor("general", PricingTier.FREE, Set.of(Capability.TEXT), "LIVE_CATALOGUE"),
                descriptor("coder", PricingTier.FREE, Set.of(Capability.TEXT, Capability.CODE), "LIVE_CATALOGUE"));
        registry.refresh();
        ScoredRoutingResult result = resolve(router(registry), IntentType.CODING, Set.of(Capability.CODE));
        assertTrue(result.providerModelId().contains("coder") || result.registryId().contains("coder"));
    }

    @Test
    void visionRequestExcludesTextOnlyModels() {
        registry = registryWith(
                descriptor("vision", PricingTier.FREE, Set.of(Capability.TEXT, Capability.VISION), "LIVE_CATALOGUE"),
                descriptor("text", PricingTier.FREE, Set.of(Capability.TEXT), "LIVE_CATALOGUE"));
        registry.refresh();
        ScoredRoutingResult result = resolve(router(registry), IntentType.VISION, Set.of(Capability.VISION));
        assertTrue(result.providerModelId().contains("vision"));
    }

    @Test
    void freeRanksAbovePaid() {
        registry = registryWith(
                descriptor("free", PricingTier.FREE, Set.of(Capability.TEXT), "LIVE_CATALOGUE"),
                descriptor("paid", PricingTier.PAID, Set.of(Capability.TEXT), "LIVE_CATALOGUE"));
        registry.refresh();
        ScoredRoutingResult result = resolve(router(registry), IntentType.GENERAL_CHAT, Set.of(Capability.TEXT));
        assertEquals(PricingTier.FREE, result.pricingTier());
    }

    @Test
    void paidExcludedByDefault() {
        registry = registryWith(
                descriptor("free", PricingTier.FREE, Set.of(Capability.TEXT), "LIVE_CATALOGUE"),
                descriptor("paid", PricingTier.PAID, Set.of(Capability.TEXT), "LIVE_CATALOGUE"));
        registry.refresh();
        ScoredRoutingResult result = resolve(router(registry), IntentType.GENERAL_CHAT, Set.of(Capability.TEXT));
        assertEquals(PricingTier.FREE, result.pricingTier());
    }

    @Test
    void unknownPricingIsNotTreatedAsFree() {
        registry = registryWith(
                descriptor("unknown", PricingTier.UNKNOWN, Set.of(Capability.TEXT), "CONFIGURATION"),
                descriptor("free", PricingTier.FREE, Set.of(Capability.TEXT), "LIVE_CATALOGUE"));
        registry.refresh();
        ScoredRoutingResult result = resolve(router(registry), IntentType.GENERAL_CHAT, Set.of(Capability.TEXT));
        assertEquals("free", result.providerModelId());
    }

    @Test
    void localOnlyRejectsCloud() {
        registry = registryWith(
                descriptor("cloud", PricingTier.FREE, Set.of(Capability.TEXT), "LIVE_CATALOGUE"),
                descriptor("browser", PricingTier.LOCAL, Set.of(Capability.TEXT, Capability.LOCAL_INFERENCE),
                        "LIVE_CATALOGUE"));
        registry.refresh();
        RequestClassification local = new RequestClassification(IntentType.PRIVATE_LOCAL, ComplexityLevel.LOW,
                FreshnessRequirement.STABLE, PrivacyLevel.LOCAL_ONLY,
                Set.of(Capability.TEXT, Capability.LOCAL_INFERENCE), 0.95, List.of());
        assertThrows(ScoredRoutingException.class,
                () -> router(registry).resolve(local, req("auto"), cloudProvider()));
    }

    @Test
    void explicitModelBypassesScoredRouting() {
        ScoredRouter r = router(registryWith());
        boolean applies = r.appliesTo(req("gpt-4"), cloudProvider());
        assertFalse(applies);
    }

    @Test
    void offlineOllamaBypassesScoredRouting() {
        ScoredRouter r = router(registryWith());
        LlmProvider ollama = mock(LlmProvider.class);
        when(ollama.id()).thenReturn("ollama");
        boolean applies = r.appliesTo(req("auto"), ollama);
        assertFalse(applies);
    }

    @Test
    void featureDisabledPreservesLegacy() {
        registryProps = new ModelRegistryProperties(true, Duration.ofHours(1), Duration.ofSeconds(1),
                20, false, false, false);
        ScoredRouter r = router(registryWith());
        boolean applies = r.appliesTo(req("auto"), cloudProvider());
        assertFalse(applies);
    }

    @Test
    void appliesToReturnsTrueWhenConditionsMet() {
        ScoredRouter r = router(registryWith());
        assertTrue(r.appliesTo(req("auto"), cloudProvider()));
    }

    @Test
    void chainIsProviderHomogeneous() {
        registry = registryWith(
                descriptor("a", PricingTier.FREE, Set.of(Capability.TEXT), "LIVE_CATALOGUE"),
                descriptor("b", PricingTier.FREE, Set.of(Capability.TEXT), "LIVE_CATALOGUE"));
        registry.refresh();
        ScoredRoutingResult result = resolve(router(registry), IntentType.GENERAL_CHAT, Set.of(Capability.TEXT));
        assertTrue(result.chain().stream().allMatch(id -> id.equals("a") || id.equals("b")),
                "chain must contain only model IDs from the top provider");
    }

    @Test
    void emptyRegistryThrows() {
        registry = registryWith();
        registry.refresh();
        assertThrows(ScoredRoutingException.class,
                () -> router(registry).resolve(
                        new RequestClassification(IntentType.GENERAL_CHAT, ComplexityLevel.LOW,
                                FreshnessRequirement.STABLE, PrivacyLevel.PUBLIC, Set.of(Capability.TEXT), 0.5, List.of()),
                        req("auto"), cloudProvider()));
    }

    @Test
    void dryRunDoesNotChangeExecution() {
        registryProps = new ModelRegistryProperties(true, Duration.ofHours(1), Duration.ofSeconds(1),
                20, false, false, true);
        registry = registryWith(
                descriptor("free", PricingTier.FREE, Set.of(Capability.TEXT), "LIVE_CATALOGUE"));
        registry.refresh();
        ScoredRouter r = router(registry);
        boolean applies = r.appliesTo(req("auto"), cloudProvider());
        assertFalse(applies, "routing disabled → appliesTo must be false");
    }

    @Test
    void promptTextIsNotLogged() {
        registry = registryWith(
                descriptor("free", PricingTier.FREE, Set.of(Capability.TEXT), "LIVE_CATALOGUE"));
        registry.refresh();
        ScoredRouter r = router(registry);
        ScoredRoutingResult result = r.resolve(
                new RequestClassification(IntentType.GENERAL_CHAT, ComplexityLevel.LOW,
                        FreshnessRequirement.STABLE, PrivacyLevel.PUBLIC, Set.of(Capability.TEXT), 0.5, List.of()),
                req("auto"), cloudProvider());
        String reason = result.reason();
        assertFalse(reason.contains("prompt") && reason.contains(req("auto").content()),
                "reason must not contain prompt text");
    }

    private ChatRequest req(String model) {
        return new ChatRequest("conv-1", model, "general", "hello", false, null, "online");
    }

    private LlmProvider cloudProvider() {
        LlmProvider p = mock(LlmProvider.class);
        when(p.id()).thenReturn("openrouter");
        return p;
    }

    static ModelDescriptor descriptor(String id, PricingTier pricing, Set<Capability> caps, String source) {
        return new ModelDescriptor("test:" + id, ModelProvider.OPENROUTER, id, id,
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
