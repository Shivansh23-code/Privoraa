package com.privoraa.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class ProviderRequestBodyTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final List<Map<String, Object>> messages = List.of(Map.of("role", "user", "content", "safe"));

    @Test void openRouterSerializesOnlySupportedLimitField() throws Exception {
        Map<String, Object> body = new OpenRouterClient(null, mapper, null)
                .buildBody("model", messages, new ChatOptions(.4, 6144), true);
        String json = mapper.writeValueAsString(body);
        assertEquals(6144, mapper.readTree(json).path("max_tokens").asInt());
        assertFalse(body.containsKey("max_completion_tokens"));
        assertTrue(mapper.readTree(json).path("stream_options").path("include_usage").asBoolean());
    }

    @Test void geminiSerializesVerifiedCompatibleLimitWithoutOptionalFields() throws Exception {
        Map<String, Object> body = new GeminiProvider(null, null, mapper)
                .buildBody("gemini-2.5-flash", messages, new ChatOptions(.4, 6144), true);
        String json = mapper.writeValueAsString(body);
        assertEquals(6144, mapper.readTree(json).path("max_tokens").asInt());
        assertFalse(body.containsKey("max_completion_tokens"));
        assertFalse(body.containsKey("reasoning_effort"));
        assertFalse(body.containsKey("stream_options"));
    }

    @Test void ollamaSerializesNumPredictInsideOptions() throws Exception {
        var props = new com.privoraa.config.OllamaProperties("http://localhost", "model", "embed", "60s", 4096, 30);
        Map<String, Object> body = new OllamaProvider(null, props)
                .chatBody("model", messages, new ChatOptions(.4, 6144), true);
        JsonNodeAssert.assertPath(mapper.readTree(mapper.writeValueAsString(body)), "/options/num_predict", 6144);
        assertFalse(body.containsKey("max_tokens"));
    }

    private static final class JsonNodeAssert {
        static void assertPath(com.fasterxml.jackson.databind.JsonNode node, String path, int expected) {
            assertEquals(expected, node.at(path).asInt());
        }
    }
}
