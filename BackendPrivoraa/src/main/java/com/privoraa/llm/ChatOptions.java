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
     * repetition that makes free models feel robotic. maxTokens stays null so the
     * model finishes naturally instead of being truncated mid-thought.
     */
    public static ChatOptions forCategory(String category) {
        String c = category == null ? "general" : category;
        return switch (c) {
            case "code" -> new ChatOptions(0.2, null, 0.9, 0.0, 0.0);
            case "math" -> new ChatOptions(0.2, null, 0.9, 0.0, 0.0);
            case "reasoning" -> new ChatOptions(0.4, null, 0.9, 0.0, 0.0);
            // general, fast, multilingual, vision, …
            default -> new ChatOptions(0.6, null, 0.9, 0.3, 0.2);
        };
    }
}
