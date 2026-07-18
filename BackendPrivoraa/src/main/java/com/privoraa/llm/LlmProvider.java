package com.privoraa.llm;

import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

/**
 * A chat + embedding backend. Two implementations exist behind the
 * {@code privoraa.llm.provider} switch: {@link OllamaProvider} (local, offline)
 * and {@link OpenRouterProvider} (cloud). The OpenRouter path is unchanged —
 * its provider is a thin adapter over the existing {@code OpenRouterClient}.
 */
public interface LlmProvider {

    /** Stable id used in config and {@code /api/llm/health}: "ollama" or "openrouter". */
    String id();

    /** Stream a chat completion, emitting deltas and a terminal finish-reason event. */
    Flux<StreamEvent> streamChat(String model, List<Map<String, Object>> messages, ChatOptions opts);

    /** Non-streaming chat completion with token usage when the backend reports it. */
    ChatResult chat(String model, List<Map<String, Object>> messages, ChatOptions opts);

    /** Embed one or more texts with the given model. Row i corresponds to texts.get(i). */
    float[][] embed(List<String> texts, String model);

    /** Liveness / version of this backend. */
    ProviderHealth health();
}
