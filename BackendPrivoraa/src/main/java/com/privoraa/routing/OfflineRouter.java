package com.privoraa.routing;

import com.privoraa.catalog.OllamaModelService;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Offline counterpart to {@link ModelRouter}: when the active provider is Ollama,
 * "Auto" should pick the best INSTALLED local model for the prompt — not silently
 * fall through to a single default. Mirrors the same {@link IntentClassifier}
 * categories, mapped to curated Ollama tags from the offline catalog, and filtered
 * against what the user has actually downloaded.
 */
@Component
public class OfflineRouter {

    private final IntentClassifier classifier;
    private final OllamaModelService ollama;

    /** Intent category -> preferred Ollama tags (best first), per model-catalog.json. */
    private static final Map<String, List<String>> BY_CATEGORY = Map.of(
            "code", List.of("qwen2.5-coder:3b", "qwen2.5-coder:1.5b", "qwen2.5-coder:7b"),
            "reasoning", List.of("qwen3:4b", "deepseek-r1:1.5b", "deepseek-r1:7b", "qwen3:8b"),
            "math", List.of("qwen3:4b", "deepseek-r1:1.5b", "qwen3:8b"),
            "general", List.of("llama3.2:3b", "qwen2.5:3b", "gemma3:4b"),
            "fast", List.of("llama3.2:1b", "gemma3:1b", "qwen2.5:1.5b"),
            "multilingual", List.of("qwen2.5:3b", "qwen2.5:1.5b", "llama3.2:3b")
    );

    private static final List<String> VISION = List.of("moondream", "llava:7b", "llama3.2-vision:11b");

    public OfflineRouter(IntentClassifier classifier, OllamaModelService ollama) {
        this.classifier = classifier;
        this.ollama = ollama;
    }

    /**
     * Resolve the local model for a request. {@code fallback} is the user's active
     * model, used when nothing better is installed.
     */
    public Routed resolve(String requestedModel, String text, String mode, boolean useRag,
                          boolean hasImage, String fallback) {
        // Explicit pick from the picker — honor it.
        if (requestedModel != null && !requestedModel.isBlank() && !"auto".equals(requestedModel)) {
            return new Routed(requestedModel, requestedModel, "general",
                    "You chose " + requestedModel, List.of(requestedModel));
        }

        Set<String> installed = ollama.installedTags();

        if (hasImage) {
            String vision = firstInstalled(VISION, installed);
            if (vision != null) {
                return new Routed(vision, vision, "vision", "Reading your image locally", List.of(vision));
            }
            return new Routed(fallback, fallback, "vision",
                    "No local vision model installed — install moondream to read images",
                    List.of(fallback));
        }

        Intent intent = classifier.classify(text, mode, useRag);
        String pick = firstInstalled(BY_CATEGORY.getOrDefault(intent.category(), List.of()), installed);
        if (pick == null) {
            pick = fallback; // nothing in this category installed — use the active model
        }
        return new Routed(pick, pick, intent.category(), intent.reason(), List.of(pick));
    }

    private String firstInstalled(List<String> candidates, Set<String> installed) {
        for (String tag : candidates) {
            if (installed.contains(tag) || installed.contains(normalize(tag))) {
                return tag;
            }
        }
        return null;
    }

    /** Ollama reports installed models as "tag:latest"; a bare tag implies ":latest". */
    private static String normalize(String tag) {
        return tag.contains(":") ? tag : tag + ":latest";
    }
}
