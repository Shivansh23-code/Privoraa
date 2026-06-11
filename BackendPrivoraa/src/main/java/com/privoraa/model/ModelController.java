package com.privoraa.model;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/models")
@Tag(name = "Models", description = "Available OpenRouter models (cached)")
public class ModelController {

    private final ModelCatalogService service;

    public ModelController(ModelCatalogService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "List models, optionally free-only")
    public List<ModelDto> list(@RequestParam(name = "freeOnly", defaultValue = "true") boolean freeOnly) {
        return service.getModels(freeOnly);
    }
}
