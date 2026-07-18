package com.privoraa.ai.registry;

import com.privoraa.catalog.CatalogModel;
import com.privoraa.catalog.OllamaCatalogService;
import com.privoraa.catalog.OllamaModelService;
import com.privoraa.config.OllamaProperties;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class OllamaModelAdapter implements ProviderModelAdapter {
    private final OllamaModelService models;
    private final OllamaCatalogService catalogue;
    private final OllamaProperties properties;
    private final ModelCapabilityNormalizer capabilities;

    public OllamaModelAdapter(OllamaModelService models, OllamaCatalogService catalogue,
                              OllamaProperties properties, ModelCapabilityNormalizer capabilities) {
        this.models = models; this.catalogue = catalogue; this.properties = properties; this.capabilities = capabilities;
    }

    @Override public ModelProvider provider() { return ModelProvider.OLLAMA; }

    @Override
    public RegistryRefreshResult refresh() {
        Set<String> installed = models.installedTags();
        if (installed.isEmpty()) return RegistryRefreshResult.failure(provider(),
                RegistryReasonCode.CATALOGUE_UNAVAILABLE);
        Map<String, CatalogModel> curated = catalogue.raw().categories().stream()
                .flatMap(c -> c.models().stream()).collect(Collectors.toMap(
                        m -> normalize(m.tag()), Function.identity(), (a, b) -> a, LinkedHashMap::new));
        Instant now = Instant.now();
        List<ModelDescriptor> result = installed.stream().map(tag -> descriptor(tag, curated.get(normalize(tag)),
                ModelAvailability.AVAILABLE, RegistrySource.LIVE_CATALOGUE, now)).toList();
        return RegistryRefreshResult.success(provider(), result, RegistrySource.LIVE_CATALOGUE, 0);
    }

    @Override
    public List<ModelDescriptor> fallbackModels() {
        Instant now = Instant.now();
        return java.util.stream.Stream.of(properties.chatModel(), properties.embedModel()).distinct()
                .map(tag -> descriptor(tag, find(tag), ModelAvailability.UNKNOWN,
                        RegistrySource.CONFIGURATION, now)).toList();
    }

    private CatalogModel find(String tag) {
        return catalogue.raw().categories().stream().flatMap(c -> c.models().stream())
                .filter(m -> normalize(m.tag()).equals(normalize(tag))).findFirst().orElse(null);
    }

    private ModelDescriptor descriptor(String tag, CatalogModel curated, ModelAvailability availability,
                                       RegistrySource source, Instant now) {
        String display = curated == null ? tag : curated.displayName();
        String category = curated == null ? "" : curated.category();
        Map<String, String> metadata = curated == null ? Map.of() : Map.of(
                "category", category, "hardwareTier", curated.tier(), "plan", curated.plan() == null ? "free" : curated.plan());
        return new ModelDescriptor("ollama-server:" + tag, provider(), tag, display,
                ExecutionTopology.SERVER_HOST_LOCAL, availability, PricingTier.LOCAL,
                capabilities.normalize(tag, display, category, null, ExecutionTopology.SERVER_HOST_LOCAL),
                properties.numCtx(), null, true, true, source.name(), now, metadata);
    }

    private String normalize(String tag) { return tag.contains(":") ? tag : tag + ":latest"; }
}
