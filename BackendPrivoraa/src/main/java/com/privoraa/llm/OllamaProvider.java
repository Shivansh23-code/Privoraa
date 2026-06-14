package com.privoraa.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.privoraa.common.ApiException;
import com.privoraa.config.OllamaProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Local Ollama backend (http://localhost:11434). Chat uses {@code POST /api/chat}
 * with {@code stream:true}; Ollama returns NDJSON (one JSON object per line), which
 * Spring's decoder splits for us, so each line's {@code message.content} becomes a
 * delta in the same {@code Flux<String>} the OpenRouter path produced. Embeddings
 * use {@code POST /api/embed}; health uses {@code GET /api/version}.
 *
 * keep_alive and num_ctx are sent on every call so the chat and embed models do
 * not both pin memory and OOM an 8 GB machine.
 */
@Component
public class OllamaProvider implements LlmProvider {

    private static final Logger log = LoggerFactory.getLogger(OllamaProvider.class);

    private final WebClient web;
    private final OllamaProperties props;

    public OllamaProvider(WebClient ollamaWebClient, OllamaProperties props) {
        this.web = ollamaWebClient;
        this.props = props;
    }

    @Override
    public String id() {
        return "ollama";
    }

    @Override
    public Flux<String> streamChat(String model, List<Map<String, Object>> messages, ChatOptions opts) {
        Map<String, Object> body = chatBody(model, messages, opts, true);
        return web.post()
                .uri("/api/chat")
                .bodyValue(body)
                .retrieve()
                // Ollama emits application/x-ndjson; the Jackson decoder yields one
                // JsonNode per line. The final line has done:true and empty content.
                .bodyToFlux(JsonNode.class)
                .timeout(Duration.ofSeconds(props.timeoutSeconds()))
                .takeUntil(node -> node.path("done").asBoolean(false))
                .mapNotNull(node -> node.path("message").path("content").asText(""))
                .filter(s -> !s.isEmpty())
                .onErrorMap(this::mapError);
    }

    @Override
    public ChatResult chat(String model, List<Map<String, Object>> messages, ChatOptions opts) {
        Map<String, Object> body = chatBody(model, messages, opts, false);
        JsonNode resp = web.post()
                .uri("/api/chat")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(Duration.ofSeconds(props.timeoutSeconds()))
                .onErrorMap(this::mapError)
                .block();
        if (resp == null) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Empty response from Ollama");
        }
        String content = resp.path("message").path("content").asText("");
        int prompt = resp.path("prompt_eval_count").asInt(0);
        int completion = resp.path("eval_count").asInt(0);
        return new ChatResult(content, prompt, completion);
    }

    @Override
    public float[][] embed(List<String> texts, String model) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("input", texts);
        body.put("keep_alive", props.keepAlive());
        JsonNode resp = web.post()
                .uri("/api/embed")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(Duration.ofSeconds(props.timeoutSeconds()))
                .onErrorMap(this::mapError)
                .block();
        JsonNode arr = resp == null ? null : resp.path("embeddings");
        if (arr == null || !arr.isArray() || arr.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "No embeddings returned by Ollama (is '" + model + "' pulled?)");
        }
        float[][] out = new float[arr.size()][];
        for (int i = 0; i < arr.size(); i++) {
            JsonNode row = arr.get(i);
            float[] vec = new float[row.size()];
            for (int j = 0; j < row.size(); j++) {
                vec[j] = (float) row.get(j).asDouble();
            }
            out[i] = vec;
        }
        return out;
    }

    @Override
    public ProviderHealth health() {
        try {
            JsonNode resp = web.get()
                    .uri("/api/version")
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .timeout(Duration.ofSeconds(3))
                    .block();
            String version = resp == null ? null : resp.path("version").asText(null);
            return new ProviderHealth(true, true, version);
        } catch (Exception e) {
            // Connection refused / timeout -> Ollama not installed or not running.
            log.debug("Ollama health check failed: {}", e.getMessage());
            return ProviderHealth.down();
        }
    }

    // ----------------------------------------------------------------- helpers

    private Map<String, Object> chatBody(String model, List<Map<String, Object>> messages,
                                         ChatOptions opts, boolean stream) {
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("num_ctx", props.numCtx());
        if (opts != null && opts.temperature() != null) {
            options.put("temperature", opts.temperature());
        }
        if (opts != null && opts.maxTokens() != null) {
            options.put("num_predict", opts.maxTokens());
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", normalize(messages));
        body.put("stream", stream);
        body.put("keep_alive", props.keepAlive());
        body.put("options", options);
        return body;
    }

    /**
     * Ollama's /api/chat wants {role, content} with content as a plain string.
     * The prompt builder may hand us OpenAI-style multimodal content (a list of
     * parts); flatten any text parts so non-vision chat still works locally.
     */
    private List<Map<String, Object>> normalize(List<Map<String, Object>> messages) {
        List<Map<String, Object>> out = new ArrayList<>(messages.size());
        for (Map<String, Object> m : messages) {
            Object content = m.get("content");
            Map<String, Object> copy = new LinkedHashMap<>();
            copy.put("role", m.getOrDefault("role", "user"));
            copy.put("content", content instanceof List<?> parts ? flattenText(parts) : String.valueOf(content));
            out.add(copy);
        }
        return out;
    }

    private String flattenText(List<?> parts) {
        StringBuilder sb = new StringBuilder();
        for (Object part : parts) {
            if (part instanceof Map<?, ?> p && "text".equals(p.get("type"))) {
                sb.append(p.get("text"));
            }
        }
        return sb.toString();
    }

    private Throwable mapError(Throwable t) {
        if (t instanceof ApiException) {
            return t;
        }
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                "Local Ollama is unreachable at " + props.baseUrl()
                        + ". Is Ollama running? (" + t.getClass().getSimpleName() + ")");
    }
}
