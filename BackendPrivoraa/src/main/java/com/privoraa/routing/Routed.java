package com.privoraa.routing;

import java.util.List;

/**
 * The outcome of routing: the chosen model plus an ordered fallback chain to try
 * if it's rate-limited or fails.
 */
public record Routed(
        String modelId,
        String modelName,
        String category,
        String reason,
        List<String> chain
) {}
