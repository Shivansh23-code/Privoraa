package com.privoraa.catalog;

import java.util.List;

/** Root of {@code model-catalog.json}. */
public record ModelCatalog(
        List<CatalogCategory> categories
) {}
