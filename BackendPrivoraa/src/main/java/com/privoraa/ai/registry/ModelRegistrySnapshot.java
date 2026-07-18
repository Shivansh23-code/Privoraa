package com.privoraa.ai.registry;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record ModelRegistrySnapshot(
        Instant refreshedAt,
        Map<String, ModelDescriptor> modelsById,
        Map<ModelProvider, RegistryRefreshResult> providerResults
) {
    public ModelRegistrySnapshot {
        refreshedAt = refreshedAt == null ? Instant.EPOCH : refreshedAt;
        modelsById = Map.copyOf(modelsById == null ? Map.of() : modelsById);
        providerResults = Map.copyOf(providerResults == null ? Map.of() : providerResults);
    }

    public List<ModelDescriptor> models() {
        return List.copyOf(modelsById.values());
    }
}
