package com.privoraa.llm;

import com.privoraa.config.OpenRouterProperties;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

/**
 * Adapter that exposes the existing {@link OpenRouterClient} as an {@link LlmProvider}.
 * Pure delegation — the cloud path is unchanged; this only lets the resolver treat
 * OpenRouter and Ollama uniformly.
 */
@Component
public class OpenRouterProvider implements LlmProvider {

    private final OpenRouterClient client;
    private final OpenRouterProperties props;

    public OpenRouterProvider(OpenRouterClient client, OpenRouterProperties props) {
        this.client = client;
        this.props = props;
    }

    @Override
    public String id() {
        return "openrouter";
    }

    @Override
    public Flux<String> streamChat(String model, List<Map<String, Object>> messages, ChatOptions opts) {
        Double temp = opts == null ? null : opts.temperature();
        Integer max = opts == null ? null : opts.maxTokens();
        return client.streamCompletion(model, messages, temp, max);
    }

    @Override
    public ChatResult chat(String model, List<Map<String, Object>> messages, ChatOptions opts) {
        Double temp = opts == null ? null : opts.temperature();
        Integer max = opts == null ? null : opts.maxTokens();
        return client.completion(model, messages, temp, max);
    }

    @Override
    public float[][] embed(List<String> texts, String model) {
        // OpenRouterClient embeds a single text; loop for the batch contract.
        float[][] out = new float[texts.size()][];
        for (int i = 0; i < texts.size(); i++) {
            out[i] = client.embed(texts.get(i));
        }
        return out;
    }

    @Override
    public ProviderHealth health() {
        boolean up = props.configured();
        return new ProviderHealth(up, up, up ? props.baseUrl() : null);
    }
}
