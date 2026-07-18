package com.privoraa.ai.registry;

import java.util.List;

public interface ProviderModelAdapter {
    ModelProvider provider();
    RegistryRefreshResult refresh();
    List<ModelDescriptor> fallbackModels();
}
