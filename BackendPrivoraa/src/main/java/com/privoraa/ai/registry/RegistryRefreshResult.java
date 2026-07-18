package com.privoraa.ai.registry;

import java.util.List;

public record RegistryRefreshResult(
        ModelProvider provider,
        boolean successful,
        List<ModelDescriptor> models,
        RegistrySource source,
        RegistryReasonCode reason,
        int malformedEntries
) {
    public RegistryRefreshResult {
        models = List.copyOf(models == null ? List.of() : models);
    }

    public static RegistryRefreshResult success(ModelProvider provider, List<ModelDescriptor> models,
                                                RegistrySource source, int malformed) {
        return new RegistryRefreshResult(provider, true, models, source,
                RegistryReasonCode.REFRESH_SUCCEEDED, malformed);
    }

    public static RegistryRefreshResult failure(ModelProvider provider, RegistryReasonCode reason) {
        return new RegistryRefreshResult(provider, false, List.of(), RegistrySource.STATIC_FALLBACK, reason, 0);
    }
}
