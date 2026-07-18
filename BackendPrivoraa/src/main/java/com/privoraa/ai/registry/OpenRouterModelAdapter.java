package com.privoraa.ai.registry;

import com.fasterxml.jackson.databind.JsonNode;
import com.privoraa.ai.classification.Capability;
import com.privoraa.llm.OpenRouterClient;
import com.privoraa.model.ModelCatalogService;
import com.privoraa.model.ModelDto;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class OpenRouterModelAdapter implements ProviderModelAdapter {
    private final OpenRouterClient client;
    private final ModelCapabilityNormalizer capabilities;
    private final ModelRegistryProperties properties;

    public OpenRouterModelAdapter(OpenRouterClient client, ModelCapabilityNormalizer capabilities,
                                  ModelRegistryProperties properties) {
        this.client = client;
        this.capabilities = capabilities;
        this.properties = properties;
    }

    @Override public ModelProvider provider() { return ModelProvider.OPENROUTER; }

    @Override
    public RegistryRefreshResult refresh() {
        try {
            List<ModelDescriptor> models = new ArrayList<>();
            int malformed = 0;
            for (JsonNode entry : client.listModels()) {
                ModelDescriptor descriptor = normalize(entry, Instant.now());
                if (descriptor == null) malformed++; else models.add(descriptor);
            }
            if (models.isEmpty()) return fallbackResult();
            return RegistryRefreshResult.success(provider(), models, RegistrySource.LIVE_CATALOGUE, malformed);
        } catch (Exception ex) {
            return fallbackResult();
        }
    }

    private RegistryRefreshResult fallbackResult() {
        return new RegistryRefreshResult(provider(), false, fallbackModels(), RegistrySource.STATIC_FALLBACK,
                RegistryReasonCode.STATIC_FALLBACK_USED, 0);
    }

    ModelDescriptor normalize(JsonNode node, Instant observedAt) {
        if (node == null) return null;
        String id = node.path("id").asText("").trim();
        if (id.isEmpty()) return null;
        String name = node.path("name").asText(id).trim();
        PricingTier pricing = pricing(node.path("pricing"));
        Integer context = positive(node.get("context_length"));
        Integer output = positive(node.path("top_provider").get("max_completion_tokens"));
        Set<Capability> normalized = capabilities.normalize(id, name, "", node,
                ExecutionTopology.CLOUD);
        if (context != null && context >= 32_000) {
            normalized = new java.util.HashSet<>(normalized);
            normalized.add(Capability.LONG_CONTEXT);
            normalized = Set.copyOf(normalized);
        }
        Map<String, String> metadata = new LinkedHashMap<>();
        put(metadata, "architecture", node.path("architecture").path("modality").asText(null));
        put(metadata, "inputModalities", node.path("architecture").path("input_modalities").toString());
        boolean selectable = pricing == PricingTier.FREE || (properties.includePaid() && pricing == PricingTier.PAID);
        return new ModelDescriptor("openrouter:" + id, provider(), id, name,
                ExecutionTopology.CLOUD, ModelAvailability.UNKNOWN, pricing, normalized,
                context, output, true, selectable, RegistrySource.LIVE_CATALOGUE.name(), observedAt, metadata);
    }

    private PricingTier pricing(JsonNode pricing) {
        if (pricing == null || pricing.isMissingNode() || !pricing.isObject()) return PricingTier.UNKNOWN;
        String prompt = pricing.path("prompt").asText(null);
        String completion = pricing.path("completion").asText(null);
        if (prompt == null || completion == null) return PricingTier.UNKNOWN;
        try {
            double p = Double.parseDouble(prompt);
            double c = Double.parseDouble(completion);
            return p == 0d && c == 0d ? PricingTier.FREE : PricingTier.PAID;
        } catch (NumberFormatException ex) {
            return PricingTier.UNKNOWN;
        }
    }

    private Integer positive(JsonNode node) {
        return node != null && node.isNumber() && node.asInt() > 0 ? node.asInt() : null;
    }

    private void put(Map<String, String> metadata, String key, String value) {
        if (value != null && !value.isBlank() && metadata.size() < properties.maxMetadataEntries())
            metadata.put(key, value);
    }

    @Override
    public List<ModelDescriptor> fallbackModels() {
        Instant now = Instant.now();
        return ModelCatalogService.fallbackModels().stream().map(m -> fallback(m, now)).toList();
    }

    private ModelDescriptor fallback(ModelDto model, Instant now) {
        Set<Capability> caps = capabilities.normalize(model.id(), model.name(), model.category(), null,
                ExecutionTopology.CLOUD);
        if (model.contextLength() != null && model.contextLength() >= 32_000) {
            var expanded = new java.util.HashSet<>(caps); expanded.add(Capability.LONG_CONTEXT); caps = Set.copyOf(expanded);
        }
        return new ModelDescriptor("openrouter:" + model.id(), provider(), model.id(), model.name(),
                ExecutionTopology.CLOUD, ModelAvailability.UNKNOWN, PricingTier.FREE, caps,
                model.contextLength(), null, true, true, RegistrySource.STATIC_FALLBACK.name(), now,
                Map.of("category", model.category()));
    }
}
