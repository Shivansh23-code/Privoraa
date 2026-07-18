package com.privoraa.llm;

/**
 * Per-call generation options shared by all providers. Provider-specific knobs
 * (Ollama's num_ctx / keep_alive) are read by each provider from its own config,
 * not threaded here.
 *
 * Beyond temperature/maxTokens we carry top_p and the frequency/presence
 * penalties: free models read as robotic and repetitive on the default flat
 * settings, and tuning these per task is the cheapest quality win there is.
 * All fields are nullable — a null means "let the provider/server decide".
 */
public record ChatOptions(Double temperature, Integer maxTokens, Double topP,
                          Double frequencyPenalty, Double presencePenalty) {

    /** Conservative output ceiling when the model's context length is unknown. */
    static final int UNKNOWN_MODEL_MAX_TOKENS = 2048;

    /** Back-compat shape for the older (temperature, maxTokens) call sites. */
    public ChatOptions(Double temperature, Integer maxTokens) {
        this(temperature, maxTokens, null, null, null);
    }

    public static ChatOptions defaults() {
        return forCategory("general");
    }

    /**
     * Task-aware sampling. Deterministic work (code, math) wants a low
     * temperature and no penalties (it must be free to repeat keywords/identifiers);
     * open-ended work wants a touch more warmth plus light penalties to curb the
     * repetition that makes free models feel robotic.
     *
     * maxTokens caps output length per category to prevent free-model truncation
     * at tiny provider defaults. Call {@link #withClampedMaxTokens(Integer)} to
     * further clamp against the resolved model's context length.
     */
    public static ChatOptions forCategory(String category) {
        String c = category == null ? "general" : category;
        return switch (c) {
            case "code" -> new ChatOptions(0.2, 8192, 0.9, 0.0, 0.0);
            case "math" -> new ChatOptions(0.2, 4096, 0.9, 0.0, 0.0);
            case "reasoning" -> new ChatOptions(0.4, 4096, 0.9, 0.0, 0.0);
            // general, fast, multilingual, vision, …
            default -> new ChatOptions(0.6, 2048, 0.9, 0.3, 0.2);
        };
    }

    /**
     * Return a copy with maxTokens clamped against the model's declared total
     * context length. Output is limited to half the declared context so the
     * model still has room for the system prompt and conversation history.
     * This is a coarse safeguard — it does NOT calculate exact remaining
     * context after subtracting history, RAG context, and the prompt itself.
     * When the context length is unknown a conservative 2048-token ceiling is
     * applied.
     */
    public ChatOptions withClampedMaxTokens(Integer modelContextLength) {
        Integer budget = this.maxTokens;
        if (budget == null) return this;
        int ceiling;
        if (modelContextLength != null && modelContextLength > 0) {
            ceiling = Math.max(256, modelContextLength / 2);
        } else {
            ceiling = UNKNOWN_MODEL_MAX_TOKENS;
        }
        int clamped = Math.min(budget, ceiling);
        if (clamped == budget) return this;
        return new ChatOptions(temperature, clamped, topP, frequencyPenalty, presencePenalty);
    }
}
