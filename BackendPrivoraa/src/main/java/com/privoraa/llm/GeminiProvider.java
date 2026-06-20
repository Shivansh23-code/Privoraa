package com.privoraa.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.privoraa.common.ApiException;
import com.privoraa.config.GeminiProperties;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Google Gemini via its OpenAI-compatible endpoint. Used as a free but much
 * stronger CODING backend than the OpenRouter free tier: {@code ChatService}
 * routes "code" intents here when GEMINI_API_KEY is set. The cloud (OpenRouter)
 * and offline (Ollama) paths are unchanged. The wire format is OpenAI-compatible,
 * so this mirrors the OpenRouter client's streaming/parsing.
 */
@Component
public class GeminiProvider implements LlmProvider {

    private final WebClient web;
    private final GeminiProperties props;
    private final ObjectMapper mapper;

    public GeminiProvider(WebClient geminiWebClient, GeminiProperties props, ObjectMapper mapper) {
        this.web = geminiWebClient;
        this.props = props;
        this.mapper = mapper;
    }

    @Override
    public String id() {
        return "gemini";
    }

    public boolean configured() {
        return props.configured();
    }

    @Override
    public Flux<String> streamChat(String model, List<Map<String, Object>> messages, ChatOptions opts) {
        if (!props.configured()) {
            return Flux.error(notConfigured());
        }
        Map<String, Object> body = buildBody(model, messages, opts, true);
        return web.post()
                .uri("/chat/completions")
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(body)
                .retrieve()
                // Surface the real upstream reason instead of a generic "busy" — a
                // 400 (bad request), 401/403 (bad key) or 429 (free-tier limit) all
                // look the same otherwise.
                .onStatus(HttpStatusCode::isError, resp -> resp.bodyToMono(String.class)
                        .defaultIfEmpty("")
                        .map(b -> upstreamError(resp.statusCode().value(), b)))
                .bodyToFlux(new ParameterizedTypeReference<ServerSentEvent<String>>() {})
                .mapNotNull(ServerSentEvent::data)
                .takeWhile(data -> !"[DONE]".equals(data.trim()))
                .map(this::extractDelta)
                .filter(s -> !s.isEmpty());
    }

    @Override
    public ChatResult chat(String model, List<Map<String, Object>> messages, ChatOptions opts) {
        if (!props.configured()) {
            throw notConfigured();
        }
        Map<String, Object> body = buildBody(model, messages, opts, false);
        JsonNode resp = web.post()
                .uri("/chat/completions")
                .bodyValue(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, r -> r.bodyToMono(String.class)
                        .defaultIfEmpty("")
                        .map(b -> upstreamError(r.statusCode().value(), b)))
                .bodyToMono(JsonNode.class)
                .block();
        if (resp == null) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Empty response from Gemini");
        }
        String content = resp.path("choices").path(0).path("message").path("content").asText("");
        int prompt = resp.path("usage").path("prompt_tokens").asInt(0);
        int completion = resp.path("usage").path("completion_tokens").asInt(0);
        return new ChatResult(content, prompt, completion);
    }

    @Override
    public float[][] embed(List<String> texts, String model) {
        // Embeddings stay on Ollama / the built-in encoder; Gemini here is chat-only.
        throw new ApiException(HttpStatus.NOT_IMPLEMENTED, "Gemini provider is chat-only in Privoraa");
    }

    @Override
    public ProviderHealth health() {
        boolean up = props.configured();
        return new ProviderHealth(up, up, up ? props.baseUrl() : null);
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
            // Gemini's OpenAI-compatible endpoint is strict about unknown fields and
            // does not reliably accept frequency/presence penalties — omit them
            // (they're 0 for coding anyway) to avoid a 400.
        }
        return body;
    }

    private ApiException upstreamError(int code, String body) {
        String detail = (body == null || body.isBlank()) ? "" : " — " + truncate(body);
        String msg = switch (code) {
            case 400 -> "Gemini rejected the request (HTTP 400)" + detail;
            case 401, 403 -> "Gemini rejected the API key (HTTP " + code
                    + "). Check the GEMINI_API_KEY value." + detail;
            case 429 -> "Gemini free-tier limit reached (HTTP 429) — wait a moment and try again.";
            default -> "Gemini upstream error (HTTP " + code + ")" + detail;
        };
        return new ApiException(HttpStatus.BAD_GATEWAY, msg);
    }

    private static String truncate(String s) {
        String t = s.replaceAll("\\s+", " ").trim();
        return t.length() > 300 ? t.substring(0, 300) + "…" : t;
    }

    private String extractDelta(String data) {
        try {
            JsonNode node = mapper.readTree(data);
            JsonNode content = node.path("choices").path(0).path("delta").path("content");
            return content.isTextual() ? content.asText() : "";
        } catch (Exception e) {
            return "";
        }
    }

    private ApiException notConfigured() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                "Gemini is not configured on this server (missing GEMINI_API_KEY).");
    }
}
