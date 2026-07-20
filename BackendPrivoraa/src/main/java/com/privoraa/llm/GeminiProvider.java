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
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

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

    /** Metadata-only startup check; lists models and does not generate tokens. */
    @EventListener(ApplicationReadyEvent.class)
    public void verifyConfiguredModels() {
        if (!props.configured()) return;
        web.get().uri("/models")
                .retrieve()
                .bodyToMono(JsonNode.class)
                .map(root -> root.path("data"))
                .subscribe(models -> {
                    boolean codeAvailable = containsModel(models, props.codeModel());
                    boolean fallbackAvailable = containsModel(models, props.fallbackModel());
                    log.info("Gemini model health provider=gemini codeModel={} codeAvailable={} "
                                    + "fallbackModel={} fallbackAvailable={} quotaImpact=metadata-only",
                            props.codeModel(), codeAvailable, props.fallbackModel(), fallbackAvailable);
                }, error -> log.warn("Gemini model health provider=gemini status=unavailable errorType={}",
                        error.getClass().getSimpleName()));
    }

    private static boolean containsModel(JsonNode models, String expected) {
        if (!models.isArray() || expected == null) return false;
        for (JsonNode model : models) {
            String id = model.path("id").asText("");
            if (expected.equals(id) || ("models/" + expected).equals(id)) return true;
        }
        return false;
    }

    @Override
    public Flux<StreamEvent> streamChat(String model, List<Map<String, Object>> messages, ChatOptions opts) {
        if (!props.configured()) {
            return Flux.error(notConfigured());
        }
        return streamAttempt(model, messages, opts, false, 1)
                .onErrorResume(GeminiUpstreamException.class,
                        error -> error.compatibilityError()
                                ? streamAttempt(model, messages, opts, true, 2)
                                : Flux.error(error));
    }

    private Flux<StreamEvent> streamAttempt(String model, List<Map<String, Object>> messages,
                                             ChatOptions opts, boolean minimal, int attempt) {
        Map<String, Object> body = buildBody(model, messages, opts, true, minimal);
        logRequest(model, opts, body, attempt);
        AtomicInteger chunks = new AtomicInteger();
        AtomicInteger contentChunks = new AtomicInteger();
        AtomicInteger contentChars = new AtomicInteger();
        AtomicReference<String> capturedFinish = new AtomicReference<>();
        AtomicReference<Instant> started = new AtomicReference<>(Instant.now());
        return web.post()
                .uri("/chat/completions")
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, resp -> resp.bodyToMono(String.class)
                        .defaultIfEmpty("")
                        .flatMap(b -> upstreamError(model, opts, body, attempt,
                                resp.statusCode().value(), b)))
                .bodyToFlux(new ParameterizedTypeReference<ServerSentEvent<String>>() {})
                .mapNotNull(ServerSentEvent::data)
                .takeWhile(data -> !"[DONE]".equals(data.trim()))
                .map(this::toEvent)
                .filter(e -> e.terminal() || e.delta() != null
                        || e.promptTokens() > 0 || e.completionTokens() > 0)
                .doOnNext(e -> {
                    chunks.incrementAndGet();
                    if (e.delta() != null && !e.delta().isEmpty()) {
                        contentChunks.incrementAndGet();
                        contentChars.addAndGet(e.delta().length());
                    }
                    if (e.terminal() && e.finishReason() != null) {
                        capturedFinish.set(e.finishReason());
                    }
                })
                .doFinally(signal -> {
                    Duration elapsed = Duration.between(started.get(), Instant.now());
                    String finish = capturedFinish.get();
                    log.info("Gemini stream completed provider=gemini model={} requestAttempt={} "
                                    + "chunks={} contentChunks={} contentChars={} "
                                    + "finishReason={} elapsedMs={} signal={}",
                            model, attempt, chunks.get(), contentChunks.get(),
                            contentChars.get(), finish != null ? finish : "null",
                            elapsed.toMillis(), signal);
                });
    }

    @Override
    public ChatResult chat(String model, List<Map<String, Object>> messages, ChatOptions opts) {
        if (!props.configured()) {
            throw notConfigured();
        }
        return chatAttempt(model, messages, opts, false, 1);
    }

    private ChatResult chatAttempt(String model, List<Map<String, Object>> messages,
                                   ChatOptions opts, boolean minimal, int attempt) {
        Map<String, Object> body = buildBody(model, messages, opts, false, minimal);
        logRequest(model, opts, body, attempt);
        try {
        JsonNode resp = web.post()
                .uri("/chat/completions")
                .bodyValue(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, r -> r.bodyToMono(String.class)
                        .defaultIfEmpty("")
                        .flatMap(b -> upstreamError(model, opts, body, attempt,
                                r.statusCode().value(), b)))
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
        } catch (GeminiUpstreamException error) {
            if (error.compatibilityError()) {
                return chatAttempt(model, messages, opts, true, 2);
            }
            throw error;
        }
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
        return buildBody(model, messages, opts, stream, false);
    }

    private Map<String, Object> buildBody(String model, List<Map<String, Object>> messages,
                                          ChatOptions opts, boolean stream, boolean minimal) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("stream", stream);
        if (opts != null) {
            if (!minimal && opts.temperature() != null) {
                body.put("temperature", opts.temperature());
            }
            if (opts.maxTokens() != null) {
                // Google's compatibility endpoint has historically accepted the
                // legacy OpenAI output-limit field. Never send both max fields.
                body.put("max_tokens", opts.maxTokens());
            }
            if (!minimal && opts.topP() != null) {
                body.put("top_p", opts.topP());
            }
            // Gemini's OpenAI-compatible endpoint is strict about unknown fields and
            // does not reliably accept frequency/presence penalties — omit them
            // (they're 0 for coding anyway) to avoid a 400.
        }
        return body;
    }

    private void logRequest(String model, ChatOptions opts, Map<String, Object> body, int attempt) {
        log.debug("Provider request provider=gemini modelId={} finalRequestedOutputTokens={} "
                        + "tokenFieldName=max_tokens fields={} requestAttempt={} endpoint={}/chat/completions",
                model, opts == null ? null : opts.maxTokens(), body.keySet(), attempt, props.baseUrl());
    }

    private Mono<? extends Throwable> upstreamError(String model, ChatOptions opts,
                                                     Map<String, Object> request, int attempt,
                                                     int status, String rawBody) {
        UpstreamDetail detail = parseError(rawBody);
        log.warn("Gemini request failed provider=gemini model={} status={} upstreamCode={} upstreamType={} "
                        + "message=\"{}\" fields={} finalRequestedOutputTokens={} endpoint={}/chat/completions requestAttempt={}",
                model, status, detail.code(), detail.type(), detail.message(), request.keySet(),
                opts == null ? null : opts.maxTokens(), props.baseUrl(), attempt);
        boolean compatibility = status == 400 && attempt == 1 && isCompatibilityError(detail);
        if (compatibility) {
            log.warn("Retrying Gemini compatibility request provider=gemini model={} removedFields={} requestAttempt=2",
                    model, request.keySet().stream()
                            .filter(field -> !List.of("model", "messages", "stream", "max_tokens").contains(field))
                            .toList());
        }
        return Mono.error(new GeminiUpstreamException(status, detail.code(), compatibility));
    }

    private UpstreamDetail parseError(String raw) {
        String code = "UNKNOWN";
        String type = "UNKNOWN";
        String message = "No upstream detail supplied";
        try {
            JsonNode error = mapper.readTree(raw).path("error");
            code = error.path("status").asText(error.path("type").asText(
                    error.path("code").asText("UNKNOWN")));
            type = error.path("type").asText(error.path("status").asText("UNKNOWN"));
            message = error.path("message").asText(message);
        } catch (Exception ignored) {
            message = "Malformed upstream error response";
        }
        return new UpstreamDetail(sanitize(code), sanitize(type), sanitize(message));
    }

    private static boolean isCompatibilityError(UpstreamDetail detail) {
        String text = (detail.code() + " " + detail.type() + " " + detail.message()).toLowerCase();
        return text.contains("unknown field") || text.contains("unrecognized field")
                || text.contains("unsupported field") || text.contains("optional field")
                || text.contains("unknown parameter") || text.contains("unsupported parameter");
    }

    private static String sanitize(String value) {
        String t = value.replaceAll("(?i)(bearer\\s+|key[=:]\\s*)[^\\s,;]+", "$1[REDACTED]")
                .replaceAll("(?i)data:image/[^;]+;base64,[A-Za-z0-9+/=]+", "[REDACTED_IMAGE]")
                .replaceAll("\"[^\"]{80,}\"", "\"[REDACTED_LONG_VALUE]\"")
                .replaceAll("\\s+", " ").trim();
        return t.length() > 300 ? t.substring(0, 300) + "…" : t;
    }

    private record UpstreamDetail(String code, String type, String message) {}

    private static final class GeminiUpstreamException extends ApiException {
        private final boolean compatibilityError;

        private GeminiUpstreamException(int status, String upstreamCode, boolean compatibilityError) {
            super(HttpStatus.BAD_GATEWAY, friendlyMessage(status, upstreamCode));
            this.compatibilityError = compatibilityError;
        }

        boolean compatibilityError() { return compatibilityError; }

        private static String friendlyMessage(int status, String upstreamCode) {
            return switch (status) {
                case 401, 403 -> "The Gemini service credentials were rejected. Please contact support.";
                case 429 -> "The Gemini service is temporarily rate limited. Please try again shortly.";
                default -> "Gemini could not process this request. Please try again.";
            };
        }
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
