package com.privoraa.chat;

import com.privoraa.ai.classification.ExecutionTarget;
import com.privoraa.ai.classification.PrivacyPolicyEvaluator;
import com.privoraa.ai.classification.PrivacyPolicyViolationException;
import com.privoraa.ai.classification.RequestClassifier;
import com.privoraa.ai.registry.*;
import com.privoraa.catalog.ActiveModelService;
import com.privoraa.chat.dto.ChatRequest;
import com.privoraa.config.ChatCompletionRepairProperties;
import com.privoraa.config.ChatContinuationProperties;
import com.privoraa.config.ChatOutputProperties;
import com.privoraa.config.FallbackProperties;
import com.privoraa.config.GeminiProperties;
import com.privoraa.conversation.Conversation;
import com.privoraa.conversation.ConversationService;
import com.privoraa.llm.*;
import com.privoraa.model.ModelCatalogService;
import com.privoraa.rag.DocumentService;
import com.privoraa.rag.RagContext;
import com.privoraa.rag.RagService;
import com.privoraa.ratelimit.RateLimitService;
import com.privoraa.routing.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ChatServiceFallbackIntegrationTest {

    private static final String CONVERSATION_ID = "conversation-1";

    private ConversationService conversations;
    private RagService rag;
    private DocumentService documents;
    private PromptBuilder prompts;
    private ModelRouter router;
    private ScriptedProvider gemini;
    private ScriptedProvider openrouter;
    private ChatContinuationProperties continuation;
    private RateLimitService rateLimit;
    private FallbackProperties fallbackProps;
    private ProviderHealthTracker healthTracker;
    private GeminiProperties geminiProps;
    private ModelRegistry registry;

    @BeforeEach
    void setUp() {
        conversations = mock(ConversationService.class);
        rag = mock(RagService.class);
        documents = mock(DocumentService.class);
        prompts = mock(PromptBuilder.class);
        router = mock(ModelRouter.class);
        gemini = new ScriptedProvider("gemini");
        openrouter = new ScriptedProvider("openrouter");
        continuation = new ChatContinuationProperties(true, 3, 4096, 24000, 120, 600);
        rateLimit = mock(RateLimitService.class);
        fallbackProps = new FallbackProperties(Duration.ofSeconds(30), Duration.ofSeconds(30),
                Duration.ofSeconds(30), Duration.ofSeconds(30), true, 4);
        healthTracker = new ProviderHealthTracker(fallbackProps);
        geminiProps = new GeminiProperties("test-key", null, null, null);

        when(conversations.getOrCreate(anyString(), any(), anyString())).thenReturn(
                Conversation.builder().id(CONVERSATION_ID).mode("general").title("test").build());
        when(conversations.messages(CONVERSATION_ID)).thenReturn(List.of());
        when(documents.hasReadyDocuments(anyString())).thenReturn(false);
        when(rag.retrieve(anyString(), anyString())).thenReturn(RagContext.empty());
        when(prompts.build(anyString(), anyList(), any(RagContext.class), any())).thenReturn(
                List.of(Map.of("role", "user", "content", "original prompt")));
        when(prompts.estimatePromptTokens(anyList())).thenReturn(10);

        // Default: "auto" modelId so isAuto check passes in tryAutoFallback
        when(router.resolve(any(), anyString(), anyString(), anyBoolean())).thenReturn(
                new Routed("auto", "auto", "general", "test route", List.of("auto")));

        ModelRegistryProperties registryProps = new ModelRegistryProperties(true, Duration.ofHours(1),
                Duration.ofSeconds(1), 20, false, false, false);
        registry = new ModelRegistry(
                List.of(new TestOpenRouterAdapter()),
                registryProps, new PrivacyPolicyEvaluator());
    }

    // ============================================================
    // Case 1 — Auto mode + Gemini success
    // ============================================================

    @Test
    void autoModeGeminiSuccess() throws Exception {
        gemini.enqueue("auto", segment("Hello.", "stop", 10, 5));

        CapturingEmitter emitter = runDefault();
        Map<String, Object> done = emitter.awaitDone();

        assertEquals("stop", done.get("finishReason"));
        assertEquals(1, emitter.count("done"));
        assertEquals(0, emitter.count("error"));
        assertEquals(1, gemini.requests.size());
        assertEquals(0, openrouter.requests.size());
        assertEquals("auto", done.get("model"));
        verify(conversations, times(1)).addAssistantMessage(eq(CONVERSATION_ID),
                eq("Hello."), anyString(), anyString(), anyString(), anyInt(), anyInt(),
                eq("complete"), eq("gemini"));
    }

    // ============================================================
    // Case 2 — Auto mode + Gemini 429 → OpenRouter fallback
    // ============================================================

    @Test
    void autoModeGemini429FallsBackToOpenRouter() throws Exception {
        gemini.enqueue("auto", Flux.error(
                WebClientResponseException.create(429, "Too Many Requests", null, null, null)));
        openrouter.enqueue("openrouter/auto", segment("Fallback reply.", "stop", 10, 8));

        CapturingEmitter emitter = runDefault();
        Map<String, Object> done = emitter.awaitDone();

        assertEquals("stop", done.get("finishReason"));
        assertEquals(1, emitter.count("done"));
        assertEquals(0, emitter.count("error"));
        assertEquals(1, emitter.count("model_switch"));
        assertTrue(emitter.containsData("Gemini failed before content; falling back to OpenRouter"));
        assertEquals("openrouter/auto", done.get("model"));
        assertEquals(1, gemini.requests.size());
        assertEquals(1, openrouter.requests.size());
        // Persisted assistant row uses OpenRouter provider
        verify(conversations, times(1)).addAssistantMessage(eq(CONVERSATION_ID),
                eq("Fallback reply."), anyString(), anyString(), anyString(), anyInt(), anyInt(),
                eq("complete"), eq("openrouter"));
        // No duplicate user messages
        verify(conversations, times(1)).addUserMessage(anyString(), anyString(), any(), any(), any(), anyList(), any());
        // Completion tokens only from successful provider
        verify(conversations).addAssistantMessage(eq(CONVERSATION_ID),
                eq("Fallback reply."), anyString(), anyString(), anyString(),
                eq(10), eq(8), eq("complete"), eq("openrouter"));
    }

    // ============================================================
    // Case 3 — Explicit Gemini model + 429 → no fallback
    // ============================================================

    @Test
    void explicitGemini429NoFallback() throws Exception {
        when(router.resolve(any(), anyString(), anyString(), anyBoolean())).thenReturn(
                new Routed("gemini-2.5-flash", "gemini-2.5-flash", "general", "explicit",
                        List.of("gemini-2.5-flash")));
        gemini.enqueue("gemini-2.5-flash", Flux.error(
                WebClientResponseException.create(429, "Too Many Requests", null, null, null)));

        CapturingEmitter emitter = runDefault();
        Map<String, Object> done = emitter.awaitDone(); // null when error sent
        assertNull(done);

        assertEquals(1, emitter.count("error"));
        assertEquals(0, emitter.count("done"));
        assertEquals(0, openrouter.requests.size());
        // No assistant row persisted (empty failure before content)
        verify(conversations, never()).addAssistantMessage(anyString(), anyString(), anyString(),
                anyString(), anyString(), anyInt(), anyInt(), anyString(), anyString());
        assertFalse(healthTracker.isHealthy("gemini", "gemini-2.5-flash"));
    }

    // ============================================================
    // Case 4 — Failure after first Gemini token → no fallback,
    //          content preserved in same assistant message
    // ============================================================

    @Test
    void partialGeminiContentPreservedNoFallback() throws Exception {
        // Gemini emits a token then errors — accumulated content stays
        gemini.enqueue("auto", Flux.concat(
                Flux.just(StreamEvent.delta("Partial ")),
                Flux.error(WebClientResponseException.create(503, "Service Unavailable", null, null, null))));

        CapturingEmitter emitter = runDefault();
        Map<String, Object> done = emitter.awaitDone();

        assertEquals("provider_error", done.get("finishReason"));
        assertEquals("incomplete", done.get("completionStatus"));
        assertEquals("Partial ", done.get("finalContent"));
        assertEquals(1, emitter.count("done"));
        assertEquals(0, emitter.count("model_switch"));
        assertEquals(0, openrouter.requests.size());
        // Assistant persisted with the partial content.
        // promptTokens = 10 (estimated from messages), completionTokens = 2 (estimated
        // from chars = max(1, 8/4))
        verify(conversations, times(1)).addAssistantMessage(eq(CONVERSATION_ID),
                eq("Partial "), anyString(), anyString(), anyString(),
                eq(10), eq(2), eq("incomplete"), eq("gemini"));
    }

    // ============================================================
    // Case 5 — Privacy/Vault restricted → no fallback
    // ============================================================

    @Test
    void privacyRestrictedNoFallback() throws Exception {
        gemini.enqueue("auto", Flux.error(
                WebClientResponseException.create(429, "Too Many Requests", null, null, null)));

        // Use a privacy evaluator that rejects CLOUD_PROVIDER
        PrivacyPolicyEvaluator rejecting = mock(PrivacyPolicyEvaluator.class);
        doThrow(new PrivacyPolicyViolationException("local_only"))
                .when(rejecting).requireAllowed(any(), eq(ExecutionTarget.CLOUD_PROVIDER));

        CapturingEmitter emitter = runWithPrivacy(rejecting);
        Map<String, Object> done = emitter.awaitDone();
        assertNull(done);

        assertEquals(1, emitter.count("error"));
        assertEquals(0, emitter.count("done"));
        assertEquals(0, openrouter.requests.size());
        verify(conversations, never()).addAssistantMessage(anyString(), anyString(), anyString(),
                anyString(), anyString(), anyInt(), anyInt(), anyString(), anyString());
    }

    // ============================================================
    // Case 6 — All fallback candidates fail
    // ============================================================

    @Test
    void allCandidatesFail() throws Exception {
        gemini.enqueue("auto", Flux.error(
                WebClientResponseException.create(503, "Service Unavailable", null, null, null)));
        openrouter.enqueue("openrouter/auto", Flux.error(
                WebClientResponseException.create(503, "OpenRouter down", null, null, null)));

        CapturingEmitter emitter = runDefault();
        Map<String, Object> done = emitter.awaitDone();
        assertNull(done);

        assertEquals(1, emitter.count("error"));
        assertEquals(0, emitter.count("done"));
        // No empty assistant row persisted
        verify(conversations, never()).addAssistantMessage(anyString(), anyString(), anyString(),
                anyString(), anyString(), anyInt(), anyInt(), anyString(), anyString());
        // Both providers marked unhealthy
        assertFalse(healthTracker.isHealthy("gemini", "auto"));
        assertFalse(healthTracker.isHealthy("openrouter", "openrouter/auto"));
    }

    // ============================================================
    // Case 7 — Cooldown: unhealthy candidate skipped, healthy one
    //          tried; success resets health
    // ============================================================

    @Test
    void cooldownSkipsUnhealthyCandidate() throws Exception {
        healthTracker.recordRetryableFailure("openrouter", "openrouter/auto",
                RetryableErrorClassifier.Category.RETRYABLE_SERVER_ERROR,
                Duration.ofSeconds(300));
        assertFalse(healthTracker.isHealthy("openrouter", "openrouter/auto"));

        gemini.enqueue("auto", Flux.error(
                WebClientResponseException.create(429, "Too Many Requests", null, null, null)));

        CapturingEmitter emitter = runDefault();
        Map<String, Object> done = emitter.awaitDone();
        assertNull(done);

        assertEquals(1, emitter.count("error"));
        assertEquals(0, emitter.count("done"));
        assertEquals(0, openrouter.requests.size());
        verify(conversations, never()).addAssistantMessage(anyString(), anyString(), anyString(),
                anyString(), anyString(), anyInt(), anyInt(), anyString(), anyString());
    }

    @Test
    void fallbackSuccessResetsHealth() throws Exception {
        // Self-contained: local tracker with near-zero cooldowns so pre-recorded
        // failure expires before the fallback check.
        FallbackProperties tinyCooldown = new FallbackProperties(
                Duration.ofMillis(1), Duration.ofMillis(1), Duration.ofMillis(1), Duration.ofMillis(1), true, 4);
        ProviderHealthTracker localTracker = new ProviderHealthTracker(tinyCooldown);
        localTracker.recordRetryableFailure("openrouter", "openrouter/auto",
                RetryableErrorClassifier.Category.RETRYABLE_SERVER_ERROR);
        assertFalse(localTracker.isHealthy("openrouter", "openrouter/auto"));

        gemini.enqueue("auto", Flux.error(
                WebClientResponseException.create(429, "Too Many Requests", null, null, null)));
        openrouter.enqueue("openrouter/auto", segment("Fallback reply.", "stop", 10, 8));

        CapturingEmitter emitter = runWithTracker(localTracker);
        Map<String, Object> done = emitter.awaitDone();
        assertEquals("stop", done.get("finishReason"));
        assertEquals(1, emitter.count("done"));

        // After success, health is reset (no cooldown)
        assertTrue(localTracker.isHealthy("openrouter", "openrouter/auto"));
        assertEquals(1, openrouter.requests.size());
        verify(conversations, times(1)).addAssistantMessage(eq(CONVERSATION_ID),
                eq("Fallback reply."), anyString(), anyString(), anyString(), anyInt(), anyInt(),
                eq("complete"), eq("openrouter"));
    }

    // ============================================================
    // Case 8 — Token accounting: failed attempt tokens do not
    //          inflate final persisted totals
    // ============================================================

    @Test
    void failedAttemptTokensNotCountedInFinal() throws Exception {
        // Gemini reports completionTokens=100 before erroring
        gemini.enqueue("auto", Flux.concat(
                Flux.just(new StreamEvent(null, null, false, 50, 100)),
                Flux.error(WebClientResponseException.create(429, "Too Many Requests", null, null, null))));
        openrouter.enqueue("openrouter/auto", segment("Clean reply.", "stop", 10, 8));

        CapturingEmitter emitter = runDefault();
        Map<String, Object> done = emitter.awaitDone();

        assertEquals("stop", done.get("finishReason"));
        assertEquals("Clean reply.", done.get("finalContent"));
        // Prompt tokens include user prompt (10) + Gemini prompt (50) = 60?
        // Actually the service subtracts estimated from provider-reported.
        // Final persistence uses only OpenRouter tokens:
        verify(conversations).addAssistantMessage(eq(CONVERSATION_ID),
                eq("Clean reply."), anyString(), anyString(), anyString(),
                eq(10), eq(8), eq("complete"), eq("openrouter"));
    }

    // ============================================================
    // helpers
    // ============================================================

    private static Flux<StreamEvent> segment(String text, String finish, int prompt, int completion) {
        return Flux.just(StreamEvent.delta(text), new StreamEvent(null, finish, true, prompt, completion));
    }

    private CapturingEmitter runDefault() {
        return runWithComponents(new PrivacyPolicyEvaluator(), healthTracker);
    }

    private CapturingEmitter runWithPrivacy(PrivacyPolicyEvaluator privacyEvaluator) {
        return runWithComponents(privacyEvaluator, healthTracker);
    }

    private CapturingEmitter runWithTracker(ProviderHealthTracker tracker) {
        return runWithComponents(new PrivacyPolicyEvaluator(), tracker);
    }

    private CapturingEmitter runWithComponents(PrivacyPolicyEvaluator privacyEvaluator,
                                                ProviderHealthTracker tracker) {
        LlmProviderResolver resolver = mock(LlmProviderResolver.class);
        when(resolver.active()).thenReturn(gemini);
        when(resolver.byId("gemini")).thenReturn(gemini);
        when(resolver.byId("openrouter")).thenReturn(openrouter);

        ScoredRouter scored = mock(ScoredRouter.class);
        when(scored.appliesTo(any(), any())).thenReturn(false);

        ChatOutputProperties output = new ChatOutputProperties(2048, 6144, 8192, 12288, 8192, 10240, 4096, 4096, 512);
        ChatContinuationProperties cont = new ChatContinuationProperties(true, 3, 4096, 24000, 120, 600);

        ChatService service = new ChatService(rateLimit, conversations, router, mock(OfflineRouter.class),
                rag, documents, prompts, resolver, mock(ActiveModelService.class), mock(ModelCatalogService.class),
                geminiProps, new RequestClassifier(new IntentClassifier()),
                privacyEvaluator, scored, output, registry, cont,
                new ChatCompletionRepairProperties(true, 1, 512),
                new SemanticResponsePlanner(), tracker, fallbackProps);

        CapturingEmitter emitter = new CapturingEmitter();
        ChatRequest req = new ChatRequest(CONVERSATION_ID, "auto", "general",
                "original prompt", false, null, null);
        service.stream("user-1", req, emitter);
        return emitter;
    }

    // --------------------------------------------------------------- test doubles

    private static final class ScriptedProvider implements LlmProvider {
        final String id;
        final Map<String, Deque<Flux<StreamEvent>>> scripts = new HashMap<>();
        final List<List<Map<String, Object>>> requests = new CopyOnWriteArrayList<>();
        final List<ChatOptions> options = new CopyOnWriteArrayList<>();

        ScriptedProvider(String id) { this.id = id; }

        void enqueue(String model, Flux<StreamEvent> flux) {
            scripts.computeIfAbsent(model, ignored -> new ArrayDeque<>()).add(flux);
        }

        @Override public String id() { return id; }

        @Override
        public Flux<StreamEvent> streamChat(String model, List<Map<String, Object>> messages, ChatOptions options) {
            requests.add(List.copyOf(messages));
            this.options.add(options);
            Deque<Flux<StreamEvent>> queue = scripts.get(model);
            return queue == null || queue.isEmpty()
                    ? Flux.error(new AssertionError("No script for " + id + "/" + model))
                    : queue.removeFirst();
        }

        @Override public ChatResult chat(String model, List<Map<String, Object>> messages, ChatOptions options) {
            throw new UnsupportedOperationException();
        }

        @Override public float[][] embed(List<String> texts, String model) { throw new UnsupportedOperationException(); }

        @Override public ProviderHealth health() { return new ProviderHealth(true, true, "test"); }
    }

    private static final class CapturingEmitter extends SseEmitter {
        private final List<Captured> events = new CopyOnWriteArrayList<>();
        private final CountDownLatch done = new CountDownLatch(1);
        private final CountDownLatch errorDone = new CountDownLatch(1);
        private volatile Runnable completion;

        CapturingEmitter() { super(0L); }

        @Override public void send(SseEventBuilder builder) throws IOException {
            StringBuilder wire = new StringBuilder();
            Object data = null;
            for (var part : builder.build()) {
                Object value = part.getData();
                if (value instanceof String string) wire.append(string);
                else data = value;
            }
            String protocol = wire.toString();
            int eventStart = protocol.indexOf("event:");
            int eventEnd = eventStart < 0 ? -1 : protocol.indexOf('\n', eventStart);
            String name = eventStart < 0 ? null : protocol.substring(eventStart + 6,
                    eventEnd < 0 ? protocol.length() : eventEnd).trim();
            events.add(new Captured(name, data));
            if ("done".equals(name)) done.countDown();
            if ("error".equals(name)) errorDone.countDown();
        }

        @Override public synchronized void onCompletion(Runnable callback) { completion = callback; }
        @Override public synchronized void complete() { if (completion != null) completion.run(); }

        @SuppressWarnings("unchecked")
        Map<String, Object> awaitDone() throws InterruptedException {
            boolean fired = done.await(5, TimeUnit.SECONDS);
            if (!fired) {
                errorDone.await(5, TimeUnit.SECONDS);
                return null;
            }
            return (Map<String, Object>) events.stream().filter(e -> "done".equals(e.name))
                    .findFirst().orElseThrow().data;
        }

        long count(String name) { return events.stream().filter(e -> name.equals(e.name)).count(); }

        boolean containsData(String text) {
            return events.stream().anyMatch(e -> e.data != null && e.data.toString().contains(text));
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> data(String name) {
            return (Map<String, Object>) events.stream().filter(e -> name.equals(e.name))
                    .findFirst().orElseThrow().data;
        }

        private record Captured(String name, Object data) {}
    }

    private static final class TestOpenRouterAdapter implements ProviderModelAdapter {
        @Override public ModelProvider provider() { return ModelProvider.OPENROUTER; }
        @Override public RegistryRefreshResult refresh() {
            return RegistryRefreshResult.failure(ModelProvider.OPENROUTER, RegistryReasonCode.STATIC_FALLBACK_USED);
        }
        @Override public List<ModelDescriptor> fallbackModels() {
            return List.of(new ModelDescriptor(
                    "openrouter/auto", ModelProvider.OPENROUTER, "openrouter/auto", "Test OpenRouter",
                    ExecutionTopology.CLOUD, ModelAvailability.AVAILABLE, PricingTier.FREE,
                    Set.of(), 4096, 4096, true, true, "test", Instant.now(), Map.of()));
        }
    }
}
