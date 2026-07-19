package com.privoraa.llm;

import com.privoraa.config.ChatOutputProperties;

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

    /** Minimum output tokens allowed after any clamping. */
    static final int MINIMUM_SAFE_OUTPUT = 256;

    /** Back-compat shape for the older (temperature, maxTokens) call sites. */
    public ChatOptions(Double temperature, Integer maxTokens) {
        this(temperature, maxTokens, null, null, null);
    }

    public static ChatOptions defaults() {
        return forCategory("general");
    }

    /**
     * Task-aware sampling with hardcoded budgets (legacy path). New code should
     * prefer {@link #forCategory(String, ChatOutputProperties)} for config-driven
     * budgets.
     */
    public static ChatOptions forCategory(String category) {
        String c = category == null ? "general" : category;
        return switch (c) {
            case "code" -> new ChatOptions(0.2, 8192, 0.9, 0.0, 0.0);
            case "math" -> new ChatOptions(0.2, 4096, 0.9, 0.0, 0.0);
            case "reasoning" -> new ChatOptions(0.4, 4096, 0.9, 0.0, 0.0);
            case "learning" -> new ChatOptions(0.4, 6144, 0.9, 0.0, 0.0);
            case "document" -> new ChatOptions(0.4, 6144, 0.9, 0.0, 0.0);
            case "vision" -> new ChatOptions(0.6, 4096, 0.9, 0.0, 0.0);
            case "fast" -> new ChatOptions(0.6, 2048, 0.9, 0.3, 0.2);
            // general, multilingual, …
            default -> new ChatOptions(0.6, 2048, 0.9, 0.3, 0.2);
        };
    }

    /**
     * Task-aware sampling with configurable output budgets. The category budget
     * is read from {@link ChatOutputProperties}, falling back to hardcoded values
     * when the properties are null. Call {@link #withOutputClamp(int, Integer, Integer, int, int, int)}
     * to clamp against model context and prompt length.
     */
    public static ChatOptions forCategory(String category, ChatOutputProperties props) {
        String c = category == null ? "general" : category;
        return switch (c) {
            case "code" -> new ChatOptions(0.2, budgetOr(props, "code", 8192), 0.9, 0.0, 0.0);
            case "math" -> new ChatOptions(0.2, budgetOr(props, "reasoning", 4096), 0.9, 0.0, 0.0);
            case "reasoning" -> new ChatOptions(0.4, budgetOr(props, "reasoning", 6144), 0.9, 0.0, 0.0);
            case "learning" -> new ChatOptions(0.4, budgetOr(props, "learning", 6144), 0.9, 0.0, 0.0);
            case "document" -> new ChatOptions(0.4, budgetOr(props, "document", 6144), 0.9, 0.0, 0.0);
            case "vision" -> new ChatOptions(0.6, budgetOr(props, "vision", 4096), 0.9, 0.0, 0.0);
            case "fast" -> new ChatOptions(0.6, budgetOr(props, "fast", 2048), 0.9, 0.3, 0.2);
            default -> new ChatOptions(0.6, budgetOr(props, "general", 4096), 0.9, 0.3, 0.2);
        };
    }

    private static int budgetOr(ChatOutputProperties props, String category, int fallback) {
        return props != null ? props.budgetForCategory(category) : fallback;
    }

    /**
     * Legacy clamp that halves the context window. Prefer
     * {@link #withOutputClamp(int, Integer, Integer, int, int)}.
     */
    public ChatOptions withClampedMaxTokens(Integer modelContextLength) {
        Integer budget = this.maxTokens;
        if (budget == null) return this;
        int ceiling;
        if (modelContextLength != null && modelContextLength > 0) {
            ceiling = Math.max(MINIMUM_SAFE_OUTPUT, modelContextLength / 2);
        } else {
            ceiling = 2048;
        }
        int clamped = Math.min(budget, ceiling);
        if (clamped == budget) return this;
        return new ChatOptions(temperature, clamped, topP, frequencyPenalty, presencePenalty);
    }

    /**
     * Clamp maxTokens against:
     * <ol>
     *   <li>the configured per-category budget (already applied by the caller)</li>
     *   <li>the model's declared {@code maxOutputTokens} / {@code max_completion_tokens}</li>
     *   <li>coarse available context = contextWindow - promptTokens - safetyMargin</li>
     *   <li>{@code unknownModelFallback} when contextWindow is unknown</li>
     * </ol>
     *
     * The final value is {@code max(MINIMUM_SAFE_OUTPUT, min(configuredBudget, descriptorLimit, availableContext))}.
     * When contextWindow is null, {@code unknownModelFallback} is used instead of availableContext.
     *
     * @param configuredBudget     per-category output budget from properties
     * @param contextWindow        model's total context window (null if unknown)
     * @param descriptorLimit      model's maxOutputTokens from registry (null if unknown)
     * @param promptTokens         estimated prompt token count
     * @param safetyMargin         headroom to leave for intermediate processing
     * @param unknownModelFallback ceiling when contextWindow is unknown
     * @return a new ChatOptions with clamped maxTokens, or {@code this} if unchanged
     */
    public ChatOptions withOutputClamp(int configuredBudget, Integer contextWindow,
                                       Integer descriptorLimit, int promptTokens,
                                       int safetyMargin, int unknownModelFallback) {
        int ceiling = configuredBudget;

        if (descriptorLimit != null && descriptorLimit > 0) {
            ceiling = Math.min(ceiling, descriptorLimit);
        }

        if (contextWindow != null && contextWindow > 0) {
            int available = contextWindow - promptTokens - safetyMargin;
            if (available > 0) {
                ceiling = Math.min(ceiling, available);
            } else {
                ceiling = Math.min(ceiling, Math.max(MINIMUM_SAFE_OUTPUT, contextWindow / 4));
            }
        } else {
            ceiling = Math.min(ceiling, unknownModelFallback);
        }

        int result = Math.max(MINIMUM_SAFE_OUTPUT, ceiling);
        if (maxTokens != null && result == maxTokens) return this;
        return new ChatOptions(temperature, result, topP, frequencyPenalty, presencePenalty);
    }
}
