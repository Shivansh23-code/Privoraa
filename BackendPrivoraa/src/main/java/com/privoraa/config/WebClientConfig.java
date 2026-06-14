package com.privoraa.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * WebClient pointed at OpenRouter. The API key lives only here, server-side —
 * it never reaches the browser. Attribution headers make the app show up on
 * OpenRouter's leaderboard.
 */
@Configuration
public class WebClientConfig {

    @Bean
    public WebClient openRouterWebClient(OpenRouterProperties props) {
        WebClient.Builder builder = WebClient.builder()
                .baseUrl(props.baseUrl())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("HTTP-Referer", props.appUrl() == null ? "" : props.appUrl())
                .defaultHeader("X-Title", props.appTitle() == null ? "Privoraa" : props.appTitle())
                // OpenRouter streams large SSE payloads; bump the in-memory buffer.
                .codecs(c -> c.defaultCodecs().maxInMemorySize(8 * 1024 * 1024));

        if (props.configured()) {
            builder.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + props.apiKey());
        }
        return builder.build();
    }

    /**
     * WebClient pointed at the local Ollama server. No auth (Ollama is
     * unauthenticated on localhost). Streaming and embeddings can be large,
     * so the in-memory buffer is bumped like the OpenRouter client.
     */
    @Bean
    public WebClient ollamaWebClient(OllamaProperties props) {
        return WebClient.builder()
                .baseUrl(props.baseUrl())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .codecs(c -> c.defaultCodecs().maxInMemorySize(16 * 1024 * 1024))
                .build();
    }
}
