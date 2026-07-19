package com.privoraa.ai.registry;

import com.privoraa.ai.classification.Capability;
import com.privoraa.config.GeminiProperties;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class GeminiModelAdapter implements ProviderModelAdapter {
    private final GeminiProperties properties;
    private final ModelCapabilityNormalizer capabilities;
    private final ModelRegistryProperties registryProperties;

    public GeminiModelAdapter(GeminiProperties properties, ModelCapabilityNormalizer capabilities,
                              ModelRegistryProperties registryProperties) {
        this.properties = properties;
        this.capabilities = capabilities;
        this.registryProperties = registryProperties;
    }

    @Override public ModelProvider provider() { return ModelProvider.GEMINI; }

    @Override
    public RegistryRefreshResult refresh() {
        return new RegistryRefreshResult(provider(), true, configuredModels(), RegistrySource.CONFIGURATION,
                RegistryReasonCode.CONFIGURATION_ONLY, 0);
    }

    @Override public List<ModelDescriptor> fallbackModels() { return configuredModels(); }

    private List<ModelDescriptor> configuredModels() {
        LinkedHashSet<String> ids = new LinkedHashSet<>(List.of(properties.codeModel(), properties.fallbackModel()));
        Instant now = Instant.now();
        return ids.stream().map(id -> {
            Set<Capability> caps = capabilities.normalize(id, id, "code", null, ExecutionTopology.CLOUD);
            var expanded = new java.util.HashSet<>(caps); expanded.add(Capability.CODE);
            Integer context = id.startsWith("gemini-2.") ? 1_048_576 : null;
            Integer output = null;
            if (id.startsWith("gemini-2.5")) output = 65_536;
            else if (id.startsWith("gemini-2.0")) output = 8_192;
            return new ModelDescriptor("gemini:" + id, provider(), id, id, ExecutionTopology.CLOUD,
                    ModelAvailability.UNKNOWN, PricingTier.UNKNOWN, Set.copyOf(expanded), context, output,
                    true, false, RegistrySource.CONFIGURATION.name(), now,
                    Map.of("configured", Boolean.toString(properties.configured())));
        }).toList();
    }
}
