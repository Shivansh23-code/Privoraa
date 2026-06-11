package com.privoraa.routing;

import com.privoraa.model.ModelCatalogService;
import com.privoraa.model.ModelDto;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * "Deep Route": given a message + mode, pick the best free model (when the user
 * leaves the picker on "auto"), with a health-aware fallback chain. Honest about
 * what it is — heuristics + catalog lookup + ordered fallback, not a trained net.
 */
@Component
public class ModelRouter {

    private final IntentClassifier classifier;
    private final ModelCatalogService catalog;

    public ModelRouter(IntentClassifier classifier, ModelCatalogService catalog) {
        this.classifier = classifier;
        this.catalog = catalog;
    }

    public Routed resolve(String requestedModel, String text, String mode, boolean useRag) {
        List<ModelDto> models = catalog.getModels(false);

        if (requestedModel != null && !requestedModel.isBlank() && !"auto".equals(requestedModel)) {
            ModelDto chosen = find(models, requestedModel);
            String name = chosen != null ? chosen.name() : requestedModel;
            String category = chosen != null ? chosen.category() : "general";
            return new Routed(requestedModel, name, category,
                    "You chose " + name, buildChain(models, requestedModel));
        }

        Intent intent = classifier.classify(text, mode, useRag);
        String preferredId = resolvePreferred(models, intent.category());
        ModelDto chosen = find(models, preferredId);
        String name = chosen != null ? chosen.name() : preferredId;
        return new Routed(preferredId, name, intent.category(), intent.reason(), buildChain(models, preferredId));
    }

    /**
     * Route an image-bearing request to a vision-capable model. Falls back through
     * {@link RouterDefaults#VISION_CHAIN}; if none are live, it still tries the first
     * so the user gets a clear upstream error rather than a silent mis-route.
     */
    public Routed visionRoute(String text) {
        List<ModelDto> models = catalog.getModels(false);
        Set<String> live = new LinkedHashSet<>();
        for (ModelDto m : models) {
            live.add(m.id());
        }
        List<String> chain = new ArrayList<>();
        for (String id : RouterDefaults.VISION_CHAIN) {
            if (live.contains(id)) {
                chain.add(id);
            }
        }
        if (chain.isEmpty()) {
            chain.add(RouterDefaults.VISION_CHAIN.get(0));
        }
        String primary = chain.get(0);
        ModelDto chosen = find(models, primary);
        String name = chosen != null ? chosen.name() : primary;
        return new Routed(primary, name, "vision", "Reading your image", chain);
    }

    private String resolvePreferred(List<ModelDto> models, String category) {
        String preferred = RouterDefaults.forCategory(category);
        if (find(models, preferred) != null) {
            return preferred;
        }
        // Default model not in the live catalog — pick any free model in the category.
        return models.stream()
                .filter(ModelDto::isFree)
                .filter(m -> m.category().equals(category) || "math".equals(category) && m.category().equals("reasoning"))
                .map(ModelDto::id)
                .findFirst()
                .orElse(preferred);
    }

    /**
     * Build the fallback chain, filtered against the live catalog so retired
     * model slugs are never attempted. Order: the requested/preferred model
     * first, then the curated fallbacks that are actually live, then any other
     * live free model as a backstop. Capped to keep latency bounded.
     */
    private List<String> buildChain(List<ModelDto> models, String first) {
        Set<String> live = new LinkedHashSet<>();
        for (ModelDto m : models) {
            live.add(m.id());
        }

        Set<String> chain = new LinkedHashSet<>();
        chain.add(first); // honor the requested/preferred model first
        for (String id : RouterDefaults.GLOBAL_FALLBACK) {
            if (live.contains(id)) {
                chain.add(id);
            }
        }
        // Backstop: pad with any other free model the live catalog currently offers.
        for (ModelDto m : models) {
            if (m.isFree()) {
                chain.add(m.id());
            }
        }
        return new ArrayList<>(chain).subList(0, Math.min(chain.size(), 6));
    }

    private ModelDto find(List<ModelDto> models, String id) {
        return models.stream().filter(m -> m.id().equals(id)).findFirst().orElse(null);
    }
}
