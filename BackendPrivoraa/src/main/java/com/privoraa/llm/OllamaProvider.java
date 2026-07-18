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
    public Flux<StreamEvent> streamChat(String model, List<Map<String, Object>> messages, ChatOptions opts) {
        Map<String, Object> body = chatBody(model, messages, opts, true);
        return web.post()
                .uri("/api/chat")
                .bodyValue(body)
                .retrieve()
                // Ollama emits application/x-ndjson; the Jackson decoder yields one
                // JsonNode per line. The final line has done:true and empty content
                // with done_reason indicating why generation stopped.
                .bodyToFlux(JsonNode.class)
                .timeout(Duration.ofSeconds(props.timeoutSeconds()))
                .takeUntil(node -> node.path("done").asBoolean(false))
                .map(this::toEvent)
                .filter(e -> e.terminal() || e.delta() != null)
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
        String finishReason = resp.path("done_reason").asText(null);
        return new ChatResult(content, prompt, completion, finishReason);
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
        if (opts != null) {
            if (opts.temperature() != null) {
                options.put("temperature", opts.temperature());
            }
            if (opts.maxTokens() != null) {
                options.put("num_predict", opts.maxTokens());
            }
            if (opts.topP() != null) {
                options.put("top_p", opts.topP());
            }
            if (opts.frequencyPenalty() != null) {
                options.put("frequency_penalty", opts.frequencyPenalty());
            }
            if (opts.presencePenalty() != null) {
                options.put("presence_penalty", opts.presencePenalty());
            }
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
     * Ollama's /api/chat wants {role, content} with content as a plain string, and
     * images passed separately as a base64 {@code images} array on the message. The
     * prompt builder hands us OpenAI-style multimodal content (a list of text +
     * image_url parts); split those so text chat works and a vision model (e.g.
     * llava / llama3.2-vision / moondream) can actually "see" attached images.
     */
    private List<Map<String, Object>> normalize(List<Map<String, Object>> messages) {
        List<Map<String, Object>> out = new ArrayList<>(messages.size());
        for (Map<String, Object> m : messages) {
            Map<String, Object> copy = new LinkedHashMap<>();
            copy.put("role", m.getOrDefault("role", "user"));

            Object content = m.get("content");
            if (content instanceof List<?> parts) {
                StringBuilder text = new StringBuilder();
                List<String> images = new ArrayList<>();
                for (Object part : parts) {
                    if (!(part instanceof Map<?, ?> p)) {
                        continue;
                    }
                    if ("text".equals(p.get("type"))) {
                        text.append(p.get("text"));
                    } else if ("image_url".equals(p.get("type"))) {
                        String b64 = base64FromImagePart(p.get("image_url"));
                        if (b64 != null) {
                            images.add(b64);
                        }
                    }
                }
                copy.put("content", text.toString());
                if (!images.isEmpty()) {
                    copy.put("images", images);
                }
            } else {
                copy.put("content", String.valueOf(content));
            }
            out.add(copy);
        }
        return out;
    }

    /** Extract raw base64 from a data URL ("data:image/png;base64,XXXX" -> "XXXX"). */
    private String base64FromImagePart(Object imageUrl) {
        String url = imageUrl instanceof Map<?, ?> u ? String.valueOf(u.get("url")) : String.valueOf(imageUrl);
        if (url == null) {
            return null;
        }
        int idx = url.indexOf("base64,");
        return idx >= 0 ? url.substring(idx + "base64,".length()) : null; // remote URLs unsupported by Ollama
    }

    private Throwable mapError(Throwable t) {
        if (t instanceof ApiException) {
            return t;
        }
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                "Local Ollama is unreachable at " + props.baseUrl()
                        + ". Is Ollama running? (" + t.getClass().getSimpleName() + ")");
    }

    /** Package-private for testability. */
    StreamEvent toEvent(JsonNode node) {
        if (node.path("done").asBoolean(false)) {
            String reason = node.path("done_reason").asText(null);
            return reason != null ? StreamEvent.done(reason) : StreamEvent.done(null);
        }
        String content = node.path("message").path("content").asText("");
        return StreamEvent.delta(content);
    }
}
