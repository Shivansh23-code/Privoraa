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
     *  Ordered to alternate UPSTREAM PROVIDERS (OpenAI → Google → Meta → Alibaba →
     *  NVIDIA), because free-tier 429s are largely per-provider — so the next model
     *  in the chain is likely served by a provider that isn't throttled.
     *  The router filters this against the live catalog, so stale entries are
     *  skipped automatically. */
    public static final List<String> GLOBAL_FALLBACK = List.of(
            "openai/gpt-oss-120b:free",
            "deepseek/deepseek-chat-v3-0324:free",
            "google/gemma-4-31b-it:free",
            "meta-llama/llama-3.3-70b-instruct:free",
            "qwen/qwen3-next-80b-a3b-instruct:free",
            "nvidia/nemotron-nano-9b-v2:free",
            "openai/gpt-oss-20b:free"
    );

    /** Vision-capable free models, tried in order when an image is attached. */
    public static final List<String> VISION_CHAIN = List.of(
            "nvidia/nemotron-nano-12b-v2-vl:free",
            "nvidia/nemotron-nano-omni-30b-a3b:free",
            "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
    );

    public static String forCategory(String category) {
        return BY_CATEGORY.getOrDefault(category, BY_CATEGORY.get("general"));
    }
}
