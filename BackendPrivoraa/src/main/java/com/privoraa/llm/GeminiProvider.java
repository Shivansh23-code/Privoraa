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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
    private static final Logger log = LoggerFactory.getLogger(GeminiProvider.class);

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
    public Flux<StreamEvent> streamChat(String model, List<Map<String, Object>> messages, ChatOptions opts) {
        if (!props.configured()) {
            return Flux.error(notConfigured());
        }
        Map<String, Object> body = buildBody(model, messages, opts, true);
        logRequest(model, opts, 1);
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
                .map(this::toEvent)
                .filter(e -> e.terminal() || e.delta() != null);
    }

    @Override
    public ChatResult chat(String model, List<Map<String, Object>> messages, ChatOptions opts) {
        if (!props.configured()) {
            throw notConfigured();
        }
        Map<String, Object> body = buildBody(model, messages, opts, false);
        logRequest(model, opts, 1);
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
        String finishReason = resp.path("choices").path(0).path("finish_reason").asText(null);
        return new ChatResult(content, prompt, completion, finishReason);
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

    /** Package-private for testability. */
    Map<String, Object> buildBody(String model, List<Map<String, Object>> messages,
                                  ChatOptions opts, boolean stream) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("stream", stream);
        if (stream) body.put("stream_options", Map.of("include_usage", true));
        if (opts != null) {
            if (opts.temperature() != null) {
                body.put("temperature", opts.temperature());
            }
            if (opts.maxTokens() != null) {
                // Google's OpenAI-compatible Chat Completions contract follows
                // the current OpenAI field. Do not mix this with native
                // generationConfig.maxOutputTokens.
                body.put("max_completion_tokens", opts.maxTokens());
            }
            if (opts.topP() != null) {
                body.put("top_p", opts.topP());
            }
            // Gemini's OpenAI-compatible endpoint is strict about unknown fields and
            // does not reliably accept frequency/presence penalties — omit them
            // (they're 0 for coding anyway) to avoid a 400.
        }
        // Gemini 2.5 Flash's default thinking budget is charged against the output
        // budget and can leave only ~1.2k visible tokens. Explanatory/code answers
        // here need visible output, so explicitly disable optional thinking.
        if (model != null && model.startsWith("gemini-2.5-flash")) {
            body.put("reasoning_effort", "none");
        }
        return body;
    }

    private void logRequest(String model, ChatOptions opts, int attempt) {
        log.debug("Provider request provider=gemini modelId={} finalRequestedOutputTokens={} "
                        + "tokenFieldName=max_completion_tokens requestAttempt={} endpoint={}/chat/completions",
                model, opts == null ? null : opts.maxTokens(), attempt, props.baseUrl());
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

    /** Package-private for testability. */
    StreamEvent toEvent(String data) {
        try {
            JsonNode node = mapper.readTree(data);
            JsonNode choices = node.path("choices");
            JsonNode usage = node.path("usage");
            if ((!choices.isArray() || choices.isEmpty()) && usage.isObject()) {
                return StreamEvent.usage(usage.path("prompt_tokens").asInt(0),
                        usage.path("completion_tokens").asInt(0));
            }
            if (choices.isArray() && choices.size() > 0) {
                JsonNode choice = choices.get(0);
                String finishReason = choice.path("finish_reason").asText(null);
                if (finishReason != null && !finishReason.isEmpty() && !"null".equals(finishReason)) {
                    return new StreamEvent(null, finishReason, true,
                            usage.path("prompt_tokens").asInt(0), usage.path("completion_tokens").asInt(0));
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
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                "Gemini is not configured on this server (missing GEMINI_API_KEY).");
    }
}
