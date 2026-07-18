package com.privoraa.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.privoraa.common.ApiException;
import com.privoraa.config.OpenRouterProperties;
import io.github.resilience4j.retry.annotation.Retry;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Talks to OpenRouter's OpenAI-compatible API. The only place the API key is used.
 * Streaming is consumed as Server-Sent Events; the #1 streaming bug — keep-alive
 * comment lines like ": OPENROUTER PROCESSING" — is handled for free because the
 * SSE decoder drops comments and only surfaces `data:` payloads.
 */
@Component
public class OpenRouterClient {

    private final WebClient webClient;
    private final ObjectMapper mapper;
    private final OpenRouterProperties props;

    public OpenRouterClient(WebClient openRouterWebClient, ObjectMapper objectMapper, OpenRouterProperties props) {
        this.webClient = openRouterWebClient;
        this.mapper = objectMapper;
        this.props = props;
    }

    /** Stream a chat completion, emitting deltas and a terminal finish-reason event. */
    public Flux<StreamEvent> streamCompletion(String model, List<Map<String, Object>> messages,
                                               Double temperature, Integer maxTokens) {
        return streamCompletion(model, messages, new ChatOptions(temperature, maxTokens));
    }

    /** Stream a chat completion with full sampling options, emitting deltas + finish reason. */
    public Flux<StreamEvent> streamCompletion(String model, List<Map<String, Object>> messages, ChatOptions opts) {
        if (!props.configured()) {
            return Flux.error(notConfigured());
        }
        Map<String, Object> body = buildBody(model, messages, opts, true);
        return webClient.post()
                .uri("/chat/completions")
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(body)
                .retrieve()
                .bodyToFlux(new ParameterizedTypeReference<ServerSentEvent<String>>() {})
                // Keep-alive comment lines (": OPENROUTER PROCESSING") arrive as events
                // with null data. Reactor's map() forbids null, so use mapNotNull to drop
                // them — otherwise the stream NPEs before the first token.
                .mapNotNull(ServerSentEvent::data)
                .takeWhile(data -> !"[DONE]".equals(data.trim()))
                .map(this::toEvent)
                .filter(e -> e.terminal() || e.delta() != null)
                // Free models frequently return a transient 429. The status is known
                // before any token is emitted, so retrying the request is safe. A short
                // backoff clears brief bursts; if it persists, ChatService falls back to
                // the next (different-provider) model in the chain.
                .retryWhen(reactor.util.retry.Retry.backoff(1, Duration.ofMillis(900))
                        .maxBackoff(Duration.ofSeconds(2))
                        .filter(t -> OpenRouterClient.isRateLimited(t)));
    }

    /** True if the error is (or wraps) an HTTP 429 from the upstream. */
    public static boolean isRateLimited(Throwable t) {
        for (Throwable e = t; e != null; e = e.getCause()) {
            if (e instanceof WebClientResponseException w && w.getStatusCode().value() == 429) {
                return true;
            }
        }
        return false;
    }

    /** Non-streaming completion with exact token usage from the response. */
    @Retry(name = "openrouter")
    public ChatResult completion(String model, List<Map<String, Object>> messages,
                                 Double temperature, Integer maxTokens) {
        return completionWithOptions(model, messages, new ChatOptions(temperature, maxTokens));
    }

    /** Non-streaming completion with full sampling options. */
    @Retry(name = "openrouter")
    public ChatResult completion(String model, List<Map<String, Object>> messages, ChatOptions opts) {
        return completionWithOptions(model, messages, opts);
    }

    private ChatResult completionWithOptions(String model, List<Map<String, Object>> messages, ChatOptions opts) {
        if (!props.configured()) {
            throw notConfigured();
        }
        Map<String, Object> body = buildBody(model, messages, opts, false);
        JsonNode resp = webClient.post()
                .uri("/chat/completions")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();
        if (resp == null) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY, "Empty response from model");
        }
        String content = resp.path("choices").path(0).path("message").path("content").asText("");
        int prompt = resp.path("usage").path("prompt_tokens").asInt(0);
        int completion = resp.path("usage").path("completion_tokens").asInt(0);
        String finishReason = resp.path("choices").path(0).path("finish_reason").asText(null);
        return new ChatResult(content, prompt, completion, finishReason);
    }

    /** Fetch the full model catalog (public endpoint; works without a key). */
    @Retry(name = "openrouter")
    public List<JsonNode> listModels() {
        JsonNode resp = webClient.get()
                .uri("/models")
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();
        List<JsonNode> out = new ArrayList<>();
        if (resp != null) {
            resp.path("data").forEach(out::add);
        }
        return out;
    }

    /** Embed a single text. Requires an embedding model to be configured. */
    @Retry(name = "openrouter")
    public float[] embed(String input) {
        if (!props.embeddingsConfigured()) {
            throw new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "Embedding model not configured");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", props.embeddingModel());
        body.put("input", input);
        JsonNode resp = webClient.post()
                .uri("/embeddings")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();
        JsonNode arr = resp == null ? null : resp.path("data").path(0).path("embedding");
        if (arr == null || !arr.isArray()) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY, "No embedding returned");
        }
        float[] vec = new float[arr.size()];
        for (int i = 0; i < arr.size(); i++) {
            vec[i] = (float) arr.get(i).asDouble();
        }
        return vec;
    }

    private Map<String, Object> buildBody(String model, List<Map<String, Object>> messages,
                                          ChatOptions opts, boolean stream) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("stream", stream);
        if (opts != null) {
            if (opts.temperature() != null) {
                body.put("temperature", opts.temperature());
            }
            if (opts.maxTokens() != null) {
                body.put("max_tokens", opts.maxTokens());
            }
            if (opts.topP() != null) {
                body.put("top_p", opts.topP());
            }
            if (opts.frequencyPenalty() != null) {
                body.put("frequency_penalty", opts.frequencyPenalty());
            }
            if (opts.presencePenalty() != null) {
                body.put("presence_penalty", opts.presencePenalty());
            }
        }
        return body;
    }

    /** Package-private for testability. */
    StreamEvent toEvent(String data) {
        try {
            JsonNode node = mapper.readTree(data);
            JsonNode choices = node.path("choices");
            if (choices.isArray() && choices.size() > 0) {
                JsonNode choice = choices.get(0);
                // The final chunk before [DONE] carries finish_reason.
                String finishReason = choice.path("finish_reason").asText(null);
                if (finishReason != null && !finishReason.isEmpty() && !"null".equals(finishReason)) {
                    return StreamEvent.done(finishReason);
                }
                JsonNode content = choice.path("delta").path("content");
                if (content.isTextual()) {
                    return StreamEvent.delta(content.asText());
                }
            }
        } catch (Exception e) {
            // ignore malformed chunks
        }
        return StreamEvent.delta("");
    }

    private ApiException notConfigured() {
        return new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                "AI is not configured on this server (missing OPENROUTER_API_KEY).");
    }
}
