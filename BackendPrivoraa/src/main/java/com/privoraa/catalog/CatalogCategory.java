package com.privoraa.catalog;

import java.util.List;

/** A category tile in the discovery screen with its curated models. */
public record CatalogCategory(
        String key,
        String title,
        String blurb,
        List<CatalogModel> models
) {}
