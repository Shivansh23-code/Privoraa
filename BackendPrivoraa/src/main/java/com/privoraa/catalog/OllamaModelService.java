package com.privoraa.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.privoraa.common.ApiException;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Proxies model-management calls to the local Ollama server: list installed
 * ({@code /api/tags}), pull with streamed progress ({@code /api/pull}), and delete
 * ({@code /api/delete}). Pulls/inference always hit the user's own Ollama.
 */
@Service
public class OllamaModelService {

    private final WebClient web;

    public OllamaModelService(WebClient ollamaWebClient) {
        this.web = ollamaWebClient;
    }

    /** Tags Ollama already has, e.g. {"llama3.2:3b", "nomic-embed-text:latest"}. */
    public Set<String> installedTags() {
        Set<String> tags = new LinkedHashSet<>();
        try {
            JsonNode resp = web.get().uri("/api/tags").retrieve().bodyToMono(JsonNode.class).block();
            if (resp != null) {
                resp.path("models").forEach(m -> {
                    String name = m.path("name").asText(null);
                    if (name != null) {
                        tags.add(name);
                    }
                });
            }
        } catch (Exception e) {
            // Ollama down -> report nothing installed rather than failing the catalog.
            return Set.of();
        }
        return tags;
    }

    /** Raw installed list (name + size + modified) for the "Installed models" view. */
    public JsonNode installedRaw() {
        try {
            return web.get().uri("/api/tags").retrieve().bodyToMono(JsonNode.class).block();
        } catch (Exception e) {
            throw unreachable(e);
        }
    }

    /**
     * Stream a model pull as progress objects {status, completed, total, percent}.
     * Ollama emits NDJSON; the final object has status "success".
     */
    public Flux<Map<String, Object>> pullStream(String tag) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", tag);
        body.put("stream", true);
        return web.post()
                .uri("/api/pull")
                .bodyValue(body)
                .retrieve()
                .bodyToFlux(JsonNode.class)
                .map(OllamaModelService::toProgress)
                .onErrorMap(this::unreachable);
    }

    /** Delete an installed model to reclaim disk. */
    public void delete(String tag) {
        try {
            web.method(HttpMethod.DELETE)
                    .uri("/api/delete")
                    .bodyValue(Map.of("name", tag))
                    .retrieve()
                    .toBodilessEntity()
                    .block();
        } catch (Exception e) {
            throw unreachable(e);
        }
    }

    private static Map<String, Object> toProgress(JsonNode node) {
        String status = node.path("status").asText("");
        long completed = node.path("completed").asLong(0);
        long total = node.path("total").asLong(0);
        int percent = total > 0 ? (int) Math.min(100, completed * 100 / total) : (
                "success".equalsIgnoreCase(status) ? 100 : 0);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", status);
        out.put("completed", completed);
        out.put("total", total);
        out.put("percent", percent);
        if (node.hasNonNull("error")) {
            out.put("error", node.path("error").asText());
        }
        return out;
    }

    private ApiException unreachable(Throwable e) {
        if (e instanceof ApiException api) {
            return api;
        }
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                "Local Ollama is unreachable. Is Ollama running? (" + e.getClass().getSimpleName() + ")");
    }
}
