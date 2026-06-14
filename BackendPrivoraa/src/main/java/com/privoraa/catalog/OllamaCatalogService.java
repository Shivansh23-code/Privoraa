package com.privoraa.catalog;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.privoraa.config.HardwareProperties;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.List;
import java.util.Set;

/**
 * Loads the curated {@code model-catalog.json} once and annotates it per request
 * with {@code fitsThisMachine} (size vs. configured RAM budget) and {@code installed}
 * (what Ollama already has). The on-disk catalog stays provider-agnostic data.
 */
@Service
public class OllamaCatalogService {

    private final HardwareProperties hardware;
    private final ModelCatalog catalog;

    public OllamaCatalogService(HardwareProperties hardware, ObjectMapper mapper) {
        this.hardware = hardware;
        this.catalog = load(mapper);
    }

    private ModelCatalog load(ObjectMapper mapper) {
        try (InputStream in = new ClassPathResource("model-catalog.json").getInputStream()) {
            return mapper.readValue(in, ModelCatalog.class);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load model-catalog.json", e);
        }
    }

    /** The raw curated catalog (unannotated). */
    public ModelCatalog raw() {
        return catalog;
    }

    /** Annotate every model with fit + installed flags for the given installed tags. */
    public CatalogView annotate(Set<String> installedTags) {
        int budget = hardware.ramBudgetGb();
        // A model "fits" if its on-disk size leaves working headroom within the RAM
        // budget — roughly half the budget once the OS, the JVM, and KV-cache are
        // accounted for. This lines up with the curated tiers (3-4B fit on 8 GB,
        // 7-8B are "stretch").
        double fitThreshold = budget * 0.5;

        List<CatalogView.Category> cats = catalog.categories().stream()
                .map(c -> new CatalogView.Category(
                        c.key(), c.title(), c.blurb(),
                        c.models().stream()
                                .map(m -> new CatalogView.Model(
                                        m.tag(), m.displayName(), m.category(),
                                        m.sizeGbApprox(), m.minRamGbHint(), m.vramFitsGb(),
                                        m.tier(), m.isDefault(), m.blurb(),
                                        m.sizeGbApprox() <= fitThreshold,
                                        installedTags.contains(normalize(m.tag()))))
                                .toList()))
                .toList();
        return new CatalogView(budget, cats);
    }

    /** Ollama reports installed models as "tag:latest"; treat a bare tag as ":latest". */
    static String normalize(String tag) {
        return tag.contains(":") ? tag : tag + ":latest";
    }
}
