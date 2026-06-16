package com.privoraa.catalog;

import java.util.List;

/**
 * Catalog annotated for the current machine + install state. {@code fitsThisMachine}
 * compares the model's approximate size to the configured RAM budget; {@code installed}
 * reflects what Ollama already has pulled.
 */
public record CatalogView(
        int ramBudgetGb,
        String userPlan,
        List<Category> categories
) {
    public record Category(
            String key,
            String title,
            String blurb,
            List<Model> models
    ) {}

    public record Model(
            String tag,
            String displayName,
            String category,
            double sizeGbApprox,
            int minRamGbHint,
            int vramFitsGb,
            String tier,
            boolean isDefault,
            String blurb,
            boolean fitsThisMachine,
            boolean installed,
            String plan,
            boolean locked
    ) {}
}
