package com.privoraa.ai.registry;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.privoraa.ai.classification.Capability;
import com.privoraa.catalog.*;
import com.privoraa.config.GeminiProperties;
import com.privoraa.config.OllamaProperties;
import com.privoraa.llm.OpenRouterClient;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProviderModelAdapterTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final ModelCapabilityNormalizer normalizer = new ModelCapabilityNormalizer();
    private final ModelRegistryProperties registryProperties =
            new ModelRegistryProperties(true, Duration.ofHours(1), Duration.ofSeconds(1), 20, false, false, false);

    @Test
    void openRouterNormalizesPricingVisionAndMalformedEntries() throws Exception {
        OpenRouterClient client = mock(OpenRouterClient.class);
        OpenRouterModelAdapter adapter = new OpenRouterModelAdapter(client, normalizer, registryProperties);
        JsonNode freeVision = mapper.readTree("""
                {"id":"vendor/vision:free","name":"Vision","context_length":64000,
                 "pricing":{"prompt":"0","completion":"0"},
                 "architecture":{"input_modalities":["text","image"]}}""");
        ModelDescriptor free = adapter.normalize(freeVision, Instant.now());
        assertEquals(PricingTier.FREE, free.pricingTier());
        assertTrue(free.capabilities().containsAll(Set.of(Capability.VISION, Capability.LONG_CONTEXT)));
        assertTrue(free.selectable());

        JsonNode paid = mapper.readTree("{\"id\":\"vendor/paid\",\"pricing\":{\"prompt\":\"0.1\",\"completion\":\"0\"}}");
        assertEquals(PricingTier.PAID, adapter.normalize(paid, Instant.now()).pricingTier());
        JsonNode unknown = mapper.readTree("{\"id\":\"vendor/unknown:free\"}");
        assertEquals(PricingTier.UNKNOWN, adapter.normalize(unknown, Instant.now()).pricingTier());
        assertNull(adapter.normalize(mapper.readTree("{}"), Instant.now()));
    }

    @Test
    void openRouterRefreshSkipsMalformedAndFallsBackOnFailure() throws Exception {
        OpenRouterClient client = mock(OpenRouterClient.class);
        OpenRouterModelAdapter adapter = new OpenRouterModelAdapter(client, normalizer, registryProperties);
        when(client.listModels()).thenReturn(List.of(mapper.readTree("{}"),
                mapper.readTree("{\"id\":\"ok\",\"pricing\":{\"prompt\":\"0\",\"completion\":\"0\"}}")));
        RegistryRefreshResult live = adapter.refresh();
        assertTrue(live.successful()); assertEquals(1, live.malformedEntries());
        when(client.listModels()).thenThrow(new RuntimeException("down"));
        RegistryRefreshResult fallback = adapter.refresh();
        assertFalse(fallback.successful()); assertFalse(fallback.models().isEmpty());
        assertEquals(RegistrySource.STATIC_FALLBACK, fallback.source());
    }

    @Test
    void geminiUsesConfigurationWithoutInventingPriceOrLimits() {
        GeminiModelAdapter adapter = new GeminiModelAdapter(
                new GeminiProperties("key", null, "gemini-code", "gemini-fallback"),
                normalizer, registryProperties);
        List<ModelDescriptor> models = adapter.refresh().models();
        assertEquals(2, models.size());
        assertTrue(models.stream().allMatch(m -> m.topology() == ExecutionTopology.CLOUD));
        assertTrue(models.stream().allMatch(m -> m.pricingTier() == PricingTier.UNKNOWN
                && m.contextWindow() == null && m.maxOutputTokens() == null && !m.selectable()));
    }

    @Test
    void ollamaFallbackIsServerHostLocalAndLocallyPriced() {
        OllamaModelService models = mock(OllamaModelService.class);
        OllamaCatalogService catalogue = mock(OllamaCatalogService.class);
        CatalogModel curated = new CatalogModel("llama3.2:3b", "Llama", "daily", 2, 8, 4,
                "fits", true, "", "free");
        when(catalogue.raw()).thenReturn(new ModelCatalog(List.of(
                new CatalogCategory("daily", "Daily", "", List.of(curated)))));
        OllamaModelAdapter adapter = new OllamaModelAdapter(models, catalogue,
                new OllamaProperties(null, "llama3.2:3b", "nomic-embed-text", null, null, null), normalizer);
        List<ModelDescriptor> fallback = adapter.fallbackModels();
        assertTrue(fallback.stream().allMatch(m -> m.topology() == ExecutionTopology.SERVER_HOST_LOCAL));
        assertTrue(fallback.stream().allMatch(m -> m.pricingTier() == PricingTier.LOCAL));
        assertTrue(fallback.stream().noneMatch(m -> m.topology() == ExecutionTopology.BROWSER_DEVICE_LOCAL));
    }
}
