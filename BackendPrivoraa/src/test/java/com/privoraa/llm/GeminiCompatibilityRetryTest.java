package com.privoraa.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.privoraa.config.GeminiProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class GeminiCompatibilityRetryTest {

    private static final List<Map<String, Object>> MESSAGES =
            List.of(Map.of("role", "user", "content", "Reply with OK"));
    private static final ChatOptions OPTIONS = new ChatOptions(0.4, 100, 0.9, null, null);

    @Test
    void badRequestRetriesExactlyOnceWithCompatibilityBody() {
        AtomicInteger calls = new AtomicInteger();
        GeminiProvider provider = providerReturning(calls, HttpStatus.BAD_REQUEST, HttpStatus.OK);

        provider.streamChat("gemini-2.5-flash", MESSAGES, OPTIONS).collectList().block();

        assertEquals(2, calls.get());
    }

    @Test
    void invalidApiKeyDoesNotRetry() {
        AtomicInteger calls = new AtomicInteger();
        GeminiProvider provider = providerReturning(calls, HttpStatus.UNAUTHORIZED);

        assertThrows(RuntimeException.class,
                () -> provider.streamChat("gemini-2.5-flash", MESSAGES, OPTIONS).collectList().block());
        assertEquals(1, calls.get());
    }

    @Test
    void quotaErrorDoesNotRetry() {
        AtomicInteger calls = new AtomicInteger();
        GeminiProvider provider = providerReturning(calls, HttpStatus.TOO_MANY_REQUESTS);

        assertThrows(RuntimeException.class,
                () -> provider.streamChat("gemini-2.5-flash", MESSAGES, OPTIONS).collectList().block());
        assertEquals(1, calls.get());
    }

    private GeminiProvider providerReturning(AtomicInteger calls, HttpStatus... statuses) {
        WebClient web = WebClient.builder().exchangeFunction(request -> {
            int index = calls.getAndIncrement();
            HttpStatus status = statuses[Math.min(index, statuses.length - 1)];
            if (status.is2xxSuccessful()) {
                return Mono.just(ClientResponse.create(status)
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_EVENT_STREAM_VALUE)
                        .body("data: {\"choices\":[{\"delta\":{\"content\":\"OK\"}}]}\n\n"
                                + "data: [DONE]\n\n")
                        .build());
            }
            return Mono.just(ClientResponse.create(status)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .body("{\"error\":{\"status\":\"INVALID_ARGUMENT\",\"message\":\"Optional field rejected\"}}")
                    .build());
        }).build();
        return new GeminiProvider(web,
                new GeminiProperties("test-key", "https://example.invalid/v1beta/openai",
                        "gemini-2.5-flash", "gemini-2.5-flash"), new ObjectMapper());
    }
}
