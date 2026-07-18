package com.privoraa.routing;

import com.privoraa.model.ModelCatalogService;
import com.privoraa.model.ModelDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ModelRouterCompatibilityTest {

    @Test
    void richerClassificationDoesNotChangeLegacyModelOrdering() {
        ModelCatalogService catalog = mock(ModelCatalogService.class);
        when(catalog.getModels(false)).thenReturn(List.of(
                model("qwen/qwen3-coder:free", "code"),
                model("openai/gpt-oss-120b:free", "reasoning"),
                model("openai/gpt-oss-20b:free", "fast")));

        Routed routed = new ModelRouter(new IntentClassifier(), catalog)
                .resolve("auto", "There is a bug in this Java function", "general", false);

        assertEquals("code", routed.category());
        assertEquals("qwen/qwen3-coder:free", routed.modelId());
        assertEquals(List.of("qwen/qwen3-coder:free", "openai/gpt-oss-120b:free",
                "openai/gpt-oss-20b:free"), routed.chain());
    }

    private ModelDto model(String id, String category) {
        return new ModelDto(id, id, id, "", category, 32_000, true);
    }
}
