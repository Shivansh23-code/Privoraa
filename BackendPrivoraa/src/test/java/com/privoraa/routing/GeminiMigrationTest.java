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

class GeminiMigrationTest {

    private ModelRegistry registry;
    private GeminiProperties gemini;
    private LlmProviderResolver providers;
    private ModelRegistryProperties props;

    @BeforeEach
    void setUp() {
        props = new ModelRegistryProperties(true, Duration.ofHours(1), Duration.ofSeconds(1),
                20, false, true, false);
        gemini = mock(GeminiProperties.class);
        when(gemini.configured()).thenReturn(true);
        when(gemini.codeModel()).thenReturn("gemini-2.0-flash");
        when(gemini.fallbackModel()).thenReturn("gemini-2.5-flash");
        providers = mock(LlmProviderResolver.class);
    }

    @Test
    void geminiPromotionFiresForCodingIntent() {
        registry = new ModelRegistry(List.of(new GeminiAwareAdapter(gemini)), props,
                new PrivacyPolicyEvaluator());
        registry.refresh();
        ScoredRouter router = new ScoredRouter(registry, props, gemini, providers);
        LlmProvider cloud = mock(LlmProvider.class);
        when(cloud.id()).thenReturn("openrouter");
        RequestClassification coding = new RequestClassification(IntentType.CODING, ComplexityLevel.HIGH,
                FreshnessRequirement.STABLE, PrivacyLevel.PUBLIC, Set.of(Capability.CODE), 0.8, List.of());
        ScoredRoutingResult result = router.resolve(coding, new ChatRequest(null, "auto", "general",
                "write a function", false, null, null), cloud);
        assertNotNull(result);
        assertEquals("gemini-2.0-flash", result.providerModelId(),
                "Gemini code model should be promoted to rank 0 for coding");
        assertEquals(ModelProvider.GEMINI, result.provider());
    }

    @Test
    void geminiPromotionDoesNotFireWhenNotConfigured() {
        when(gemini.configured()).thenReturn(false);
        registry = new ModelRegistry(List.of(new GeminiAwareAdapter(gemini)), props,
                new PrivacyPolicyEvaluator());
        registry.refresh();
        ScoredRouter router = new ScoredRouter(registry, props, gemini, providers);
        LlmProvider cloud = mock(LlmProvider.class);
        when(cloud.id()).thenReturn("openrouter");
        RequestClassification coding = new RequestClassification(IntentType.CODING, ComplexityLevel.HIGH,
                FreshnessRequirement.STABLE, PrivacyLevel.PUBLIC, Set.of(Capability.CODE), 0.8, List.of());
        assertThrows(ScoredRoutingException.class, () -> router.resolve(coding,
                new ChatRequest(null, "auto", "general", "write a function", false, null, null), cloud));
    }

    @Test
    void geminiPromotionDoesNotFireForNonCodeIntent() {
        when(gemini.configured()).thenReturn(true);
        registry = new ModelRegistry(List.of(new GeminiAwareAdapter(gemini)), props,
                new PrivacyPolicyEvaluator());
        registry.refresh();
        ScoredRouter router = new ScoredRouter(registry, props, gemini, providers);
        LlmProvider cloud = mock(LlmProvider.class);
        when(cloud.id()).thenReturn("openrouter");
        RequestClassification general = new RequestClassification(IntentType.GENERAL_CHAT, ComplexityLevel.LOW,
                FreshnessRequirement.STABLE, PrivacyLevel.PUBLIC, Set.of(Capability.TEXT), 0.5, List.of());
        assertThrows(ScoredRoutingException.class, () -> router.resolve(general,
                new ChatRequest(null, "auto", "general", "hello", false, null, null), cloud));
    }

    @Test
    void geminiPromotionChainIncludesFallback() {
        when(gemini.configured()).thenReturn(true);
        registry = new ModelRegistry(List.of(new GeminiAwareAdapter(gemini,
                descriptor("free", PricingTier.FREE, Set.of(Capability.TEXT, Capability.CODE), "LIVE_CATALOGUE"))),
                props, new PrivacyPolicyEvaluator());
        registry.refresh();
        ScoredRouter router = new ScoredRouter(registry, props, gemini, providers);
        LlmProvider cloud = mock(LlmProvider.class);
        when(cloud.id()).thenReturn("openrouter");
        RequestClassification coding = new RequestClassification(IntentType.CODING, ComplexityLevel.HIGH,
                FreshnessRequirement.STABLE, PrivacyLevel.PUBLIC, Set.of(Capability.CODE), 0.8, List.of());
        ScoredRoutingResult result = router.resolve(coding, new ChatRequest(null, "auto", "general",
                "write code", false, null, null), cloud);
        assertNotNull(result);
        assertEquals("gemini-2.0-flash", result.providerModelId(),
                "Gemini must be first in chain when promoted");
    }

    static ModelDescriptor descriptor(String id, PricingTier pricing, Set<Capability> caps, String source) {
        return new ModelDescriptor("openrouter:" + id, ModelProvider.OPENROUTER, id, id,
                ExecutionTopology.CLOUD, ModelAvailability.UNKNOWN, pricing, caps, null, null,
                true, true, source, Instant.now(), java.util.Map.of());
    }

    /** Adapter that registers Gemini descriptors matching GeminiProperties. */
    private static final class GeminiAwareAdapter implements ProviderModelAdapter {
        private final GeminiProperties gemini;
        private final List<ModelDescriptor> additional;
        GeminiAwareAdapter(GeminiProperties gemini, ModelDescriptor... additional) {
            this.gemini = gemini;
            this.additional = List.of(additional);
        }
        public ModelProvider provider() { return ModelProvider.GEMINI; }
        public RegistryRefreshResult refresh() {
            return RegistryRefreshResult.success(provider(), models(), RegistrySource.CONFIGURATION, 0);
        }
        public List<ModelDescriptor> fallbackModels() { return models(); }
        private List<ModelDescriptor> models() {
            Instant now = Instant.now();
            List<ModelDescriptor> list = new java.util.ArrayList<>();
            list.add(new ModelDescriptor("gemini:" + gemini.codeModel(), ModelProvider.GEMINI,
                    gemini.codeModel(), gemini.codeModel(), ExecutionTopology.CLOUD,
                    ModelAvailability.UNKNOWN, PricingTier.UNKNOWN, Set.of(Capability.TEXT, Capability.CODE),
                    null, null, true, false, "CONFIGURATION", now, java.util.Map.of("configured", "true")));
            list.addAll(additional);
            return list;
        }
    }
}
