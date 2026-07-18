package com.privoraa.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.privoraa.llm.OpenRouterClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Normalized, cached view of OpenRouter's catalog. Falls back to a static list of
 * known free models when the upstream is unreachable, so the app stays usable.
 * The free roster shifts monthly — the live fetch is the source of truth.
 */
@Service
public class ModelCatalogService {

    private static final Logger log = LoggerFactory.getLogger(ModelCatalogService.class);

    private final OpenRouterClient client;
    /** Self-reference so internal calls go through the caching proxy. */
    private final ModelCatalogService self;

    public ModelCatalogService(OpenRouterClient client, @Lazy @Autowired ModelCatalogService self) {
        this.client = client;
        this.self = self;
    }

    @Cacheable(value = "models", key = "#freeOnly")
    public List<ModelDto> getModels(boolean freeOnly) {
        try {
            List<JsonNode> raw = client.listModels();
            List<ModelDto> mapped = raw.stream()
                    .map(this::map)
                    .filter(m -> !freeOnly || m.isFree())
                    .toList();
            if (!mapped.isEmpty()) {
                return mapped;
            }
            log.warn("OpenRouter returned no models; using static fallback");
        } catch (Exception e) {
            log.warn("Failed to fetch OpenRouter models ({}); using static fallback", e.getMessage());
        }
        return freeOnly ? FALLBACK : FALLBACK;
    }

    public Optional<ModelDto> find(String id) {
        return self.getModels(false).stream().filter(m -> m.id().equals(id)).findFirst();
    }

    private ModelDto map(JsonNode node) {
        String id = node.path("id").asText("");
        String name = node.path("name").asText(id);
        Integer ctx = node.has("context_length") ? node.get("context_length").asInt() : null;

        String prompt = node.path("pricing").path("prompt").asText("");
        String completion = node.path("pricing").path("completion").asText("");
        boolean free = id.endsWith(":free")
                || (isZero(prompt) && isZero(completion));

        return new ModelDto(id, name, shortName(name), describe(id), category(id, name), ctx, free);
    }

    private boolean isZero(String price) {
        try {
            return Double.parseDouble(price) == 0d;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private String shortName(String name) {
        String n = name.replace(" (free)", "").trim();
        return n.length() > 18 ? n.substring(0, 18) : n;
    }

    private String describe(String id) {
        return switch (category(id, id)) {
            case "code" -> "Code generation, review and debugging.";
            case "reasoning" -> "Reasoning & math — rigorous, step by step.";
            case "fast" -> "Fast, low-latency responses.";
            case "multilingual" -> "Large multilingual model.";
            default -> "General-purpose chat.";
        };
    }

    private String category(String id, String name) {
        String s = (id + " " + name).toLowerCase();
        if (s.contains("coder") || s.contains("code")) {
            return "code";
        }
        if (s.contains("deepseek-r1") || s.contains("-r1") || s.contains("reason") || s.contains("qwq")) {
            return "reasoning";
        }
        if (s.contains("flash") || s.contains("gemini") || s.contains("mini") || s.contains("8b")) {
            return "fast";
        }
        if (s.contains("235b") || s.contains("multilingual") || s.contains("aya")) {
            return "multilingual";
        }
        return "general";
    }

    /** Mirrors the frontend's static fallback (kept in sync intentionally). */
    static final List<ModelDto> FALLBACK = List.of(
            new ModelDto("openai/gpt-oss-120b:free", "GPT-OSS 120B", "GPT-OSS 120B",
                    "Strong general-purpose reasoning.", "general", 131000, true),
            new ModelDto("openai/gpt-oss-20b:free", "GPT-OSS 20B", "GPT-OSS 20B",
                    "Fast, low-latency responses.", "fast", 131000, true),
            new ModelDto("qwen/qwen3-coder:free", "Qwen3 Coder", "Qwen3 Coder",
                    "Code generation, review and debugging.", "code", 256000, true),
            new ModelDto("google/gemma-4-31b-it:free", "Gemma 4 31B", "Gemma 4 31B",
                    "Capable general-purpose chat.", "general", 131000, true),
            new ModelDto("qwen/qwen3-next-80b-a3b-instruct:free", "Qwen3 Next 80B", "Qwen3 Next 80B",
                    "Large multilingual model.", "multilingual", 262000, true)
    );

    /** Stable read-only fallback reused by the Phase 2 registry adapter. */
    public static List<ModelDto> fallbackModels() {
        return FALLBACK;
    }
}
