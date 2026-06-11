package com.privoraa.routing;

import java.util.List;
import java.util.Map;

/** Category → preferred free model, and a global fallback ordering. */
public final class RouterDefaults {

    private RouterDefaults() {
    }

    public static final Map<String, String> BY_CATEGORY = Map.of(
            "code", "qwen/qwen3-coder:free",
            "reasoning", "openai/gpt-oss-120b:free",
            "math", "openai/gpt-oss-120b:free",
            "general", "openai/gpt-oss-120b:free",
            "fast", "openai/gpt-oss-20b:free",
            "multilingual", "qwen/qwen3-next-80b-a3b-instruct:free"
    );

    /** When a category's preferred model is busy, fall through this chain.
     *  The router filters this against the live catalog, so stale entries are
     *  skipped automatically — but keep these to current free slugs. */
    public static final List<String> GLOBAL_FALLBACK = List.of(
            "openai/gpt-oss-120b:free",
            "openai/gpt-oss-20b:free",
            "google/gemma-4-31b-it:free",
            "meta-llama/llama-3.3-70b-instruct:free"
    );

    public static String forCategory(String category) {
        return BY_CATEGORY.getOrDefault(category, BY_CATEGORY.get("general"));
    }
}
