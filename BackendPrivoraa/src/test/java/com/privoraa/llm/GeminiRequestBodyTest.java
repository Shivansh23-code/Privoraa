package com.privoraa.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.privoraa.config.ChatOutputProperties;
import com.privoraa.config.GeminiProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Map;

/**
 * Verifies the Gemini request body contains the expected max output token field
 * after config-driven budget selection and clamping.
 */
class GeminiRequestBodyTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private GeminiProvider gemini;
    private final ChatOutputProperties props = new ChatOutputProperties(
            2048, 4096, 6144, 8192, 6144, 6144, 4096, 4096, 512);

    @BeforeEach
    void setUp() {
        gemini = new GeminiProvider(null, null, mapper);
    }

    @Test
    void geminiBodyContainsMaxTokens() {
        List<Map<String, Object>> messages = List.of(
                Map.of("role", "user", "content", "Hello"));
        ChatOptions opts = ChatOptions.forCategory("code", props);
        opts = opts.withOutputClamp(props.codeMaxTokens(), 128_000, null, 50, 512, 4096);
        Map<String, Object> body = gemini.buildBody("gemini-2.0-flash", messages, opts, false);
        assertEquals(Integer.valueOf(8192), body.get("max_tokens"),
                "Gemini body should contain max_tokens matching the code budget");
    }

    @Test
    void geminiBodyObeysDescriptorLimit() {
        List<Map<String, Object>> messages = List.of(
                Map.of("role", "user", "content", "Teach me arrays"));
        ChatOptions opts = ChatOptions.forCategory("learning", props);
        // descriptor limits to 4096, learning budget is 6144
        opts = opts.withOutputClamp(props.learningMaxTokens(), 128_000, 4096, 100, 512, 4096);
        Map<String, Object> body = gemini.buildBody("gemini-2.5-flash", messages, opts, false);
        assertEquals(Integer.valueOf(4096), body.get("max_tokens"),
                "Gemini body should respect descriptor maxOutputTokens");
    }

    @Test
    void geminiBodyRespectsAvailableContext() {
        List<Map<String, Object>> messages = List.of(
                Map.of("role", "user", "content", "A".repeat(2000)));
        ChatOptions opts = ChatOptions.forCategory("general", props);
        // context=8192, prompt=500, safety=512 → available=7180
        // min(4096, 7180) = 4096 → stays at general budget
        opts = opts.withOutputClamp(props.generalMaxTokens(), 8192, null, 500, 512, 4096);
        Map<String, Object> body = gemini.buildBody("gemini-2.0-flash", messages, opts, false);
        assertEquals(Integer.valueOf(4096), body.get("max_tokens"),
                "Gemini body should respect available context after prompt deduction");
    }

    @Test
    void geminiBodyUsesConfiguredFallbackForUnknownContext() {
        List<Map<String, Object>> messages = List.of(
                Map.of("role", "user", "content", "Hi"));
        ChatOptions opts = ChatOptions.forCategory("code", props);
        // null context → clamp to min(8192, 4096) = 4096 (configured unknown-model-max-tokens)
        opts = opts.withOutputClamp(props.codeMaxTokens(), null, null, 50, 512, 4096);
        Map<String, Object> body = gemini.buildBody("gemini-2.0-flash", messages, opts, false);
        assertEquals(Integer.valueOf(4096), body.get("max_tokens"),
                "Gemini body should use configured unknown-model-max-tokens (4096) when context unknown");
    }

    @Test
    void geminiBodyOmitsMaxTokensWhenOptsNull() {
        List<Map<String, Object>> messages = List.of(
                Map.of("role", "user", "content", "Hi"));
        Map<String, Object> body = gemini.buildBody("gemini-2.0-flash", messages, null, false);
        assertNull(body.get("max_tokens"), "max_tokens should be absent when opts is null");
    }

    @Test
    void geminiBodyOmitsMaxTokensWhenMaxTokensNull() {
        List<Map<String, Object>> messages = List.of(
                Map.of("role", "user", "content", "Hi"));
        ChatOptions opts = new ChatOptions(0.6, null, 0.9, null, null);
        Map<String, Object> body = gemini.buildBody("gemini-2.0-flash", messages, opts, false);
        assertNull(body.get("max_tokens"), "max_tokens should be absent when maxTokens is null");
    }
}
