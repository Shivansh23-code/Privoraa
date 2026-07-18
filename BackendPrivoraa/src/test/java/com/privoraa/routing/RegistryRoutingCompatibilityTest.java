package com.privoraa.routing;

import com.privoraa.ai.classification.*;
import com.privoraa.ai.registry.*;
import com.privoraa.chat.dto.ChatRequest;
import com.privoraa.config.GeminiProperties;
import com.privoraa.llm.LlmProvider;
import com.privoraa.llm.LlmProviderResolver;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RegistryRoutingCompatibilityTest {

    @Test
    void featureDisabledUsesExactLegacyPath() {
        ModelRegistryProperties disabled = new ModelRegistryProperties(true, Duration.ofHours(1),
                Duration.ofSeconds(1), 20, false, false, false);
        ScoredRouter router = new ScoredRouter(
                mock(ModelRegistry.class), disabled,
                mock(GeminiProperties.class), mock(LlmProviderResolver.class));
        LlmProvider cloud = mock(LlmProvider.class);
        when(cloud.id()).thenReturn("openrouter");
        assertFalse(router.appliesTo(new ChatRequest(null, "auto", "general", "hi", false, null, null), cloud));
    }

    @Test
    void explicitModelBypassesScoredRouting() {
        ModelRegistryProperties enabled = new ModelRegistryProperties(true, Duration.ofHours(1),
                Duration.ofSeconds(1), 20, false, true, false);
        ScoredRouter router = new ScoredRouter(
                mock(ModelRegistry.class), enabled,
                mock(GeminiProperties.class), mock(LlmProviderResolver.class));
        LlmProvider cloud = mock(LlmProvider.class);
        when(cloud.id()).thenReturn("openrouter");
        assertFalse(router.appliesTo(new ChatRequest(null, "gpt-4", "general", "hi", false, null, null), cloud));
    }

    @Test
    void offlineOllamaBypassesScoredRouting() {
        ModelRegistryProperties enabled = new ModelRegistryProperties(true, Duration.ofHours(1),
                Duration.ofSeconds(1), 20, false, true, false);
        ScoredRouter router = new ScoredRouter(
                mock(ModelRegistry.class), enabled,
                mock(GeminiProperties.class), mock(LlmProviderResolver.class));
        LlmProvider ollama = mock(LlmProvider.class);
        when(ollama.id()).thenReturn("ollama");
        assertFalse(router.appliesTo(new ChatRequest(null, "auto", "general", "hi", false, null, null), ollama));
    }

    @Test
    void emptyRegistryThrowsScoredRoutingException() {
        ModelRegistryProperties props = new ModelRegistryProperties(true, Duration.ofHours(1),
                Duration.ofSeconds(1), 20, false, true, false);
        ModelRegistry empty = new ModelRegistry(List.of(), props, new PrivacyPolicyEvaluator());
        empty.refresh();
        GeminiProperties gemini = mock(GeminiProperties.class);
        when(gemini.configured()).thenReturn(false);
        ScoredRouter router = new ScoredRouter(empty, props, gemini, mock(LlmProviderResolver.class));
        LlmProvider cloud = mock(LlmProvider.class);
        when(cloud.id()).thenReturn("openrouter");
        assertThrows(ScoredRoutingException.class, () -> router.resolve(
                new RequestClassification(IntentType.GENERAL_CHAT, ComplexityLevel.LOW,
                        FreshnessRequirement.STABLE, PrivacyLevel.PUBLIC, Set.of(Capability.TEXT), 0.5, List.of()),
                new ChatRequest(null, "auto", "general", "hi", false, null, null), cloud));
    }

    @Test
    void noCompatibleModelThrowsScoredRoutingException() {
        ModelRegistryProperties props = new ModelRegistryProperties(true, Duration.ofHours(1),
                Duration.ofSeconds(1), 20, false, true, false);
        ModelRegistry reg = new ModelRegistry(List.of(new StaticAdapter(List.of(
                descriptor("vision", PricingTier.FREE, Set.of(Capability.VISION), "LIVE_CATALOGUE")
        ))), props, new PrivacyPolicyEvaluator());
        reg.refresh();
        GeminiProperties gemini = mock(GeminiProperties.class);
        when(gemini.configured()).thenReturn(false);
        ScoredRouter router = new ScoredRouter(reg, props, gemini, mock(LlmProviderResolver.class));
        LlmProvider cloud = mock(LlmProvider.class);
        when(cloud.id()).thenReturn("openrouter");
        assertThrows(ScoredRoutingException.class, () -> router.resolve(
                new RequestClassification(IntentType.GENERAL_CHAT, ComplexityLevel.LOW,
                        FreshnessRequirement.STABLE, PrivacyLevel.PUBLIC, Set.of(Capability.CODE), 0.5, List.of()),
                new ChatRequest(null, "auto", "general", "write code", false, null, null), cloud));
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
