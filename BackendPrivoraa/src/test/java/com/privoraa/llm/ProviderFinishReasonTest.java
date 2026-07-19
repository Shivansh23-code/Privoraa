package com.privoraa.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests finish-reason extraction from streaming chunks for all three providers.
 * Providers are instantiated with mock dependencies since toEvent() only uses
 * the ObjectMapper (not WebClient or properties).
 */
class ProviderFinishReasonTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private OpenRouterClient openRouter;
    private GeminiProvider gemini;
    private OllamaProvider ollama;

    @BeforeEach
    void setUp() {
        openRouter = new OpenRouterClient(null, mapper, null);
        gemini = new GeminiProvider(null, null, mapper);
        ollama = new OllamaProvider(null, null);
    }

    // ---- OpenRouter ----

    @Test
    void openRouterExtractsStop() {
        StreamEvent e = openRouter.toEvent(
                "{\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}");
        assertNull(e.delta());
        assertEquals("stop", e.finishReason());
    }

    @Test
    void openRouterExtractsLength() {
        StreamEvent e = openRouter.toEvent(
                "{\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"length\"}]}");
        assertEquals("length", e.finishReason());
    }

    @Test
    void openRouterExtractsContentFilter() {
        StreamEvent e = openRouter.toEvent(
                "{\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"content_filter\"}]}");
        assertEquals("content_filter", e.finishReason());
    }

    @Test
    void openRouterDeltaHasNoFinishReason() {
        StreamEvent e = openRouter.toEvent(
                "{\"choices\":[{\"index\":0,\"delta\":{\"content\":\"Hello\"},\"finish_reason\":null}]}");
        assertEquals("Hello", e.delta());
        assertNull(e.finishReason());
    }

    @Test
    void openRouterMalformedChunkReturnsEmptyNonTerminalDelta() {
        StreamEvent e = openRouter.toEvent("garbage");
        assertEquals("", e.delta());
        assertNull(e.finishReason());
        assertFalse(e.terminal(), "malformed chunk must not be treated as terminal");
    }

    @Test
    void openRouterParsesFinalStreamUsageChunk() {
        StreamEvent e = openRouter.toEvent(
                "{\"choices\":[],\"usage\":{\"prompt_tokens\":12,\"completion_tokens\":34}}");
        assertEquals(12, e.promptTokens());
        assertEquals(34, e.completionTokens());
        assertFalse(e.terminal());
    }

    // ---- Gemini ----

    @Test
    void geminiExtractsStop() {
        StreamEvent e = gemini.toEvent(
                "{\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}");
        assertEquals("stop", e.finishReason());
    }

    @Test
    void geminiExtractsLength() {
        StreamEvent e = gemini.toEvent(
                "{\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"length\"}]}");
        assertEquals("length", e.finishReason());
    }

    @Test
    void geminiDeltaReturnsContent() {
        StreamEvent e = gemini.toEvent(
                "{\"choices\":[{\"index\":0,\"delta\":{\"content\":\"World\"},\"finish_reason\":null}]}");
        assertEquals("World", e.delta());
        assertNull(e.finishReason());
    }

    @Test
    void geminiParsesFinalStreamUsageChunk() {
        StreamEvent e = gemini.toEvent(
                "{\"choices\":[],\"usage\":{\"prompt_tokens\":21,\"completion_tokens\":43}}");
        assertEquals(21, e.promptTokens());
        assertEquals(43, e.completionTokens());
    }

    // ---- Ollama ----

    @Test
    void ollamaExtractsStop() {
        ObjectNode node = mapper.createObjectNode();
        node.put("done", true);
        node.put("done_reason", "stop");
        StreamEvent e = ollama.toEvent(node);
        assertNull(e.delta());
        assertEquals("stop", e.finishReason());
    }

    @Test
    void ollamaTerminalCarriesProviderUsage() {
        ObjectNode node = mapper.createObjectNode();
        node.put("done", true);
        node.put("done_reason", "stop");
        node.put("prompt_eval_count", 17);
        node.put("eval_count", 29);
        StreamEvent e = ollama.toEvent(node);
        assertEquals(17, e.promptTokens());
        assertEquals(29, e.completionTokens());
    }

    @Test
    void ollamaExtractsLength() {
        ObjectNode node = mapper.createObjectNode();
        node.put("done", true);
        node.put("done_reason", "length");
        StreamEvent e = ollama.toEvent(node);
        assertEquals("length", e.finishReason());
    }

    @Test
    void ollamaDeltaHasNoFinishReason() {
        ObjectNode node = mapper.createObjectNode();
        node.put("done", false);
        node.with("message").put("content", "Hi");
        StreamEvent e = ollama.toEvent(node);
        assertEquals("Hi", e.delta());
        assertNull(e.finishReason());
    }

    @Test
    void ollamaTerminalWithoutReasonProducesNullFinishReason() {
        // done:true without done_reason must NOT fabricate "stop".
        // The terminal event signals end-of-stream but the reason is unknown.
        ObjectNode node = mapper.createObjectNode();
        node.put("done", true);
        StreamEvent e = ollama.toEvent(node);
        assertNull(e.delta(), "terminal event must have null delta");
        assertNull(e.finishReason(), "must not fabricate a finish reason when done_reason is absent");
        assertTrue(e.terminal(), "done:true event must be marked terminal");
    }

    @Test
    void ollamaTerminalWithoutReasonReachesChatServiceAsTerminal() {
        // Prove the event would pass the provider filter and reach ChatService.
        // ChatService receives events only after they pass Flux.filter().
        // With the old filter (delta!=null || finishReason!=null) this event would be
        // silently dropped. With the new filter (terminal || delta!=null) it passes through.
        ObjectNode node = mapper.createObjectNode();
        node.put("done", true);
        StreamEvent e = ollama.toEvent(node);
        boolean passesNewFilter = e.terminal() || e.delta() != null;
        assertTrue(passesNewFilter, "done:true without reason must pass the provider filter");
    }

    @Test
    void ollamaNonDoneReturnsDelta() {
        ObjectNode node = mapper.createObjectNode();
        node.put("done", false);
        node.with("message").put("content", "delta-text");
        StreamEvent e = ollama.toEvent(node);
        assertEquals("delta-text", e.delta());
        assertNull(e.finishReason());
    }
}
