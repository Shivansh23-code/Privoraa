package com.privoraa.chat;

import com.privoraa.ai.classification.PrivacyPolicyEvaluator;
import com.privoraa.ai.classification.RequestClassifier;
import com.privoraa.ai.registry.ModelRegistry;
import com.privoraa.ai.registry.ModelRegistryProperties;
import com.privoraa.catalog.ActiveModelService;
import com.privoraa.chat.dto.ChatRequest;
import com.privoraa.common.ApiException;
import com.privoraa.config.ChatCompletionRepairProperties;
import com.privoraa.config.ChatContinuationProperties;
import com.privoraa.config.ChatOutputProperties;
import com.privoraa.config.FallbackProperties;
import com.privoraa.config.GeminiProperties;
import com.privoraa.conversation.Conversation;
import com.privoraa.conversation.ConversationService;
import com.privoraa.conversation.Message;
import com.privoraa.conversation.MessageRole;
import com.privoraa.llm.*;
import com.privoraa.llm.ProviderHealthTracker;
import com.privoraa.model.ModelCatalogService;
import com.privoraa.rag.DocumentService;
import com.privoraa.rag.RagContext;
import com.privoraa.rag.RagService;
import com.privoraa.ratelimit.RateLimitService;
import com.privoraa.routing.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;
import reactor.core.publisher.FluxSink;

import java.io.IOException;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ChatServiceStreamingIntegrationTest {
    private ConversationService conversations;
    private RagService rag;
    private DocumentService documents;
    private PromptBuilder prompts;
    private ModelRouter router;
    private ScriptedProvider provider;
    private ChatContinuationProperties continuation;
    private RateLimitService rateLimit;

    @BeforeEach
    void setUp() {
        conversations = mock(ConversationService.class);
        rag = mock(RagService.class);
        documents = mock(DocumentService.class);
        prompts = mock(PromptBuilder.class);
        router = mock(ModelRouter.class);
        provider = new ScriptedProvider();
        continuation = new ChatContinuationProperties(true, 3, 4096, 24000, 120, 600);
        rateLimit = mock(RateLimitService.class);

        when(conversations.getOrCreate(anyString(), any(), anyString())).thenReturn(
                Conversation.builder().id("conversation-1").mode("general").title("test").build());
        when(conversations.messages("conversation-1")).thenReturn(List.of());
        when(documents.hasReadyDocuments(anyString())).thenReturn(false);
        when(rag.retrieve(anyString(), anyString())).thenReturn(RagContext.empty());
        when(prompts.build(anyString(), anyList(), any(RagContext.class), any())).thenReturn(
                List.of(Map.of("role", "user", "content", "original prompt")));
        when(prompts.estimatePromptTokens(anyList())).thenReturn(10);
        when(router.resolve(any(), anyString(), anyString(), anyBoolean())).thenReturn(
                new Routed("m1", "m1", "general", "test route", List.of("m1")));
    }

    // ---- LENGTH → continuation path ----
    @Test
    void lengthThenStopCombinesOnceAndRunsSingleTurnWorkOnce() throws Exception {
        when(documents.hasReadyDocuments("user-1")).thenReturn(true);
        RagContext context = new RagContext("context", List.of());
        when(rag.retrieve("user-1", "original prompt")).thenReturn(context);
        provider.enqueue("m1", segment("First paragraph. ", "length", 20, 3));
        provider.enqueue("m1", segment("First paragraph. Second paragraph.", "stop", 30, 5));

        CapturingEmitter emitter = run(true, List.of("m1"));
        Map<String, Object> done = emitter.awaitDone();

        assertEquals("stop", done.get("finishReason"));
        assertEquals("complete", done.get("completionStatus"));
        assertEquals(2, done.get("segments"));
        assertEquals(true, done.get("continued"));
        assertEquals(50, done.get("promptTokens"));
        assertEquals(8, done.get("completionTokens"));
        assertEquals(false, done.get("tokenCountEstimated"));
        assertEquals(1, emitter.count("meta"));
        assertEquals(1, emitter.count("done"));
        verify(conversations, times(1)).addUserMessage(eq("conversation-1"), eq("original prompt"),
                isNull(), eq("auto"), isNull(), eq(List.of()), isNull());
        verify(conversations, times(1)).addAssistantMessage(eq("conversation-1"),
                eq("First paragraph. Second paragraph."), anyString(), anyString(), anyString(), eq(50), eq(8), eq("complete"), eq("openrouter"));
        verify(documents, times(1)).hasReadyDocuments("user-1");
        verify(rag, times(1)).retrieve("user-1", "original prompt");
        verifyNoMoreInteractions(rag);
        assertEquals(2, provider.requests.size());
        assertEquals("assistant", provider.requests.get(1).get(1).get("role"));
        assertEquals("user", provider.requests.get(1).get(2).get("role"));
        assertTrue(provider.requests.get(1).get(2).get("content").toString().startsWith("Continue exactly"));
        assertFalse(emitter.containsData("Continue exactly"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"length", "MAX_TOKENS", "max_tokens"})
    void providerTokenLimitAliasesAlwaysContinue(String finishReason) throws Exception {
        provider.enqueue("m1", segment("First part and", finishReason, 10, 3));
        provider.enqueue("m1", segment(" the completed ending.", "stop", 11, 4));
        Map<String, Object> done = run(false, List.of("m1")).awaitDone();
        assertEquals(2, done.get("segments"));
        assertEquals(true, done.get("continued"));
        assertEquals("complete", done.get("completionStatus"));
        assertEquals("First part and the completed ending.", done.get("finalContent"));
    }

    @Test
    void manualContinuationUpdatesSameAssistantWithoutCreatingMessages() throws Exception {
        Conversation conversation = Conversation.builder().id("conversation-1").mode("general").build();
        Message target = Message.builder().id("assistant-1").conversation(conversation)
                .role(MessageRole.ASSISTANT).content("The name may be registered as").build();
        when(conversations.requireOwnedAssistant("user-1", "conversation-1", "assistant-1")).thenReturn(target);
        when(conversations.messages("conversation-1")).thenReturn(List.of(target));
        provider.enqueue("m1", segment(" a private company.", "stop", 10, 4));

        ChatRequest request = new ChatRequest("conversation-1", "auto", "general", "Continue exactly",
                false, null, null, null, null, null, true, "assistant-1", target.getContent());
        CapturingEmitter emitter = new CapturingEmitter();
        service().stream("user-1", request, emitter);
        Map<String, Object> done = emitter.awaitDone();

        assertEquals("The name may be registered as a private company.", done.get("finalContent"));
        assertEquals(1, emitter.count("done"));
        assertEquals(1, provider.requests.getFirst().stream().filter(m -> "assistant".equals(m.get("role"))).count());
        verify(conversations, never()).addUserMessage(anyString(), anyString(), any(), any(), any(), anyList(), any());
        verify(conversations, never()).addAssistantMessage(anyString(), anyString(), anyString(), anyString(), anyString(), anyInt(), anyInt(), any(), any());
        verify(conversations, times(1)).updateAssistantMessage(eq("user-1"), eq("conversation-1"),
                eq("assistant-1"), eq("The name may be registered as a private company."),
                anyString(), anyString(), anyString(), anyInt(), anyInt(), eq("complete"), eq("openrouter"));
    }

    @Test
    void unknownIncompleteGetsAtMostOneContinuation() throws Exception {
        provider.enqueue("m1", segment("The company is registered as", "mystery_reason", 10, 4));
        provider.enqueue("m1", segment(" a private company and", "mystery_reason", 11, 4));
        Map<String, Object> done = run(false, List.of("m1")).awaitDone();
        assertEquals(2, provider.requests.size());
        assertEquals("incomplete", done.get("completionStatus"));
        assertEquals(1, ((Number) done.get("segments")).intValue() - 1);
    }

    @Test
    void unknownReasonWithCompleteStructureFinalizesNormally() throws Exception {
        provider.enqueue("m1", segment("This response is complete.", "future_stop", 10, 4));
        Map<String, Object> done = run(false, List.of("m1")).awaitDone();
        assertEquals("complete", done.get("completionStatus"));
        assertEquals(1, provider.requests.size());
    }

    // ---- Complete STOP → no repair ----
    @Test
    void completeStopDoesNotRepair() throws Exception {
        provider.enqueue("m1", segment("Complete.", "stop", 10, 2));
        Map<String, Object> done = run(false, List.of("m1")).awaitDone();
        assertEquals(1, done.get("segments"));
        assertEquals(false, done.get("continued"));
        assertEquals(1, provider.requests.size());
        assertEquals(false, done.get("repairAttempted"));
        assertEquals(false, done.get("completionRepaired"));
        assertEquals(0, done.get("repairSegments"));
        assertEquals("normal_stop", done.get("finalizationReason"));
        assertEquals("complete structure", done.get("contentAnalysisReason"));
    }

    // ---- STOP + arbitrary unfinished prose → one repair ----
    @Test
    void suspiciousStopIsRepairedOnceWithoutRepeatingTurnWork() throws Exception {
        provider.enqueue("m1", segment("First sentence. However, the cost", "stop", 10, 4));
        provider.enqueue("m1", segment(" increases with every insertion.", "stop", 12, 5));

        CapturingEmitter emitter = run(false, List.of("m1"));
        Map<String, Object> done = emitter.awaitDone();

        assertEquals("First sentence. However, the cost increases with every insertion.",
                done.get("finalContent"));
        assertEquals(true, done.get("repairAttempted"));
        assertEquals(true, done.get("completionRepaired"));
        assertEquals(1, done.get("repairSegments"));
        assertEquals(false, done.get("tailTrimmed"));
        assertEquals(1, emitter.count("done"));
        assertEquals(2, provider.requests.size());
        assertEquals(512, provider.options.get(1).maxTokens());
        verify(rateLimit, times(1)).check("user-1");
        verify(router, times(1)).resolve(any(), anyString(), anyString(), anyBoolean());
        verify(conversations, times(1)).addUserMessage(eq("conversation-1"), eq("original prompt"),
                isNull(), eq("auto"), isNull(), eq(List.of()), isNull());
        verify(conversations, times(1)).addAssistantMessage(eq("conversation-1"),
                eq((String) done.get("finalContent")), anyString(), anyString(), anyString(), anyInt(), anyInt(), anyString(), anyString());
        assertEquals("assistant", provider.requests.get(1).get(1).get("role"));
        assertEquals("user", provider.requests.get(1).get(2).get("role"));
        assertTrue(provider.requests.get(1).get(2).get("content").toString()
                .startsWith("Complete only the unfinished final thought"));
        assertFalse(emitter.containsData("Complete only the unfinished final thought"));
    }

    // ---- Repair error → safe structural trim ----
    @Test
    void repairErrorFallsBackToSafeTrim() throws Exception {
        provider.enqueue("m1", segment("First sentence. However, the cost", "stop", 10, 4));
        provider.enqueue("m1", Flux.error(new IllegalStateException("quota")));
        Map<String, Object> done = run(false, List.of("m1")).awaitDone();
        assertEquals("First sentence. However, the cost", done.get("finalContent"));
        assertEquals(true, done.get("repairAttempted"));
        assertEquals(false, done.get("completionRepaired"));
        assertEquals(false, done.get("tailTrimmed"));
    }

    // ---- Repair remains incomplete → safe structural trim ----
    @Test
    void stillSuspiciousRepairFallsBackToSafeTrim() throws Exception {
        provider.enqueue("m1", segment("First sentence. However, the cost", "stop", 10, 4));
        provider.enqueue("m1", segment(" and", "stop", 12, 1));
        Map<String, Object> done = run(false, List.of("m1")).awaitDone();
        assertEquals("First sentence. However, the cost and", done.get("finalContent"));
        assertEquals(false, done.get("completionRepaired"));
        assertEquals(false, done.get("tailTrimmed"));
    }

    // ---- Repair with "ArrayList or linked" style (structural) ----
    @Test
    void productionOrLinkedTailIsRepairedOnce() throws Exception {
        provider.enqueue("m1", segment(
                "Arrays are fundamental because they offer fast access. " +
                "However, their fixed size makes them less suitable for dynamic collections. " +
                "For such cases, other data structures like ArrayList or linked",
                "stop", 10, 12));
        provider.enqueue("m1", segment(" lists may be more appropriate.", "stop", 12, 6));

        CapturingEmitter emitter = run(false, List.of("m1"));
        Map<String, Object> done = emitter.awaitDone();

        assertEquals(
                "Arrays are fundamental because they offer fast access. " +
                "However, their fixed size makes them less suitable for dynamic collections. " +
                "For such cases, other data structures like ArrayList or linked lists may be more appropriate.",
                done.get("finalContent"));
        assertEquals(true, done.get("repairAttempted"));
        assertEquals(true, done.get("completionRepaired"));
        assertEquals(1, done.get("repairSegments"));
        assertEquals(false, done.get("tailTrimmed"));
        assertEquals(1, emitter.count("done"));
        assertEquals(2, provider.requests.size());
        assertEquals(512, provider.options.get(1).maxTokens());
        verify(conversations, times(1)).addUserMessage(eq("conversation-1"), eq("original prompt"),
                isNull(), eq("auto"), isNull(), eq(List.of()), isNull());
        verify(conversations, times(1)).addAssistantMessage(eq("conversation-1"),
                eq((String) done.get("finalContent")), anyString(), anyString(), anyString(), anyInt(), anyInt(), anyString(), anyString());
    }

    // ---- Repair error with structural dangling → safe trim ----
    @Test
    void productionOrLinkedRepairErrorFallsBackToSafeTrim() throws Exception {
        provider.enqueue("m1", segment(
                "Arrays are fundamental because they offer fast access. " +
                "However, their fixed size makes them less suitable for dynamic collections. " +
                "For such cases, other data structures like ArrayList or linked",
                "stop", 10, 12));
        provider.enqueue("m1", Flux.error(new IllegalStateException("quota")));

        CapturingEmitter em = run(false, List.of("m1"));
        Map<String, Object> done = em.awaitDone();

        assertEquals(
                "Arrays are fundamental because they offer fast access. " +
                "However, their fixed size makes them less suitable for dynamic collections. " +
                "For such cases, other data structures like ArrayList or linked",
                done.get("finalContent"));
        assertEquals(true, done.get("repairAttempted"));
        assertEquals(false, done.get("completionRepaired"));
        assertEquals(false, done.get("tailTrimmed"));
        assertEquals(1, em.count("done"));
        verify(conversations, times(1)).addAssistantMessage(eq("conversation-1"),
                eq((String) done.get("finalContent")), anyString(), anyString(), anyString(), anyInt(), anyInt(), anyString(), anyString());
    }

    // ---- Repair still suspicious → safe structural trim ----
    @Test
    void productionOrLinkedStillSuspiciousRepairFallsBackToSafeTrim() throws Exception {
        provider.enqueue("m1", segment(
                "Arrays are fundamental because they offer fast access. " +
                "However, their fixed size makes them less suitable for dynamic collections. " +
                "For such cases, other data structures like ArrayList or linked",
                "stop", 10, 12));
        provider.enqueue("m1", segment(" and", "stop", 12, 1));

        CapturingEmitter em = run(false, List.of("m1"));
        Map<String, Object> done = em.awaitDone();

        assertEquals(
                "Arrays are fundamental because they offer fast access. " +
                "However, their fixed size makes them less suitable for dynamic collections. " +
                "For such cases, other data structures like ArrayList or linked and",
                done.get("finalContent"));
        assertEquals(true, done.get("repairAttempted"));
        assertEquals(false, done.get("completionRepaired"));
        assertEquals(false, done.get("tailTrimmed"));
        assertEquals(1, em.count("done"));
        verify(conversations, times(1)).addAssistantMessage(eq("conversation-1"),
                eq((String) done.get("finalContent")), anyString(), anyString(), anyString(), anyInt(), anyInt(), anyString(), anyString());
    }

    // ---- Three LENGTHs → limit_reached ----
    @Test
    void threeLengthsReachConfiguredLimitWithOneDone() throws Exception {
        provider.enqueue("m1", segment("A", "length", 10, 1));
        provider.enqueue("m1", segment("B", "length", 11, 1));
        provider.enqueue("m1", segment("C", "length", 12, 1));
        CapturingEmitter emitter = run(false, List.of("m1"));
        Map<String, Object> done = emitter.awaitDone();
        assertEquals("length", done.get("finishReason"));
        assertEquals("limit_reached", done.get("completionStatus"));
        assertEquals("max_segments", done.get("finalizationReason"));
        assertEquals(3, done.get("segments"));
        assertEquals(1, emitter.count("done"));
        verify(conversations, times(1)).addAssistantMessage(anyString(), eq("ABC"), anyString(),
                anyString(), anyString(), anyInt(), anyInt(), eq("limit_reached"), eq("openrouter"));
    }

    // ---- LENGTH → safe trim (continuation disabled) ----
    @Test
    void incompleteTailIsTrimmedInDonePayloadAndPersistence() throws Exception {
        continuation = new ChatContinuationProperties(false, 3, 4096, 24000, 120, 600);
        provider.enqueue("m1", segment("First sentence. Second sentence. This is why",
                "length", 10, 8));

        Map<String, Object> done = run(false, List.of("m1")).awaitDone();

        assertEquals("First sentence. Second sentence. This is why", done.get("finalContent"));
        assertEquals(false, done.get("tailTrimmed"));
        verify(conversations).addAssistantMessage(eq("conversation-1"),
                eq("First sentence. Second sentence. This is why"), anyString(), anyString(), anyString(), eq(10), eq(8), eq("limit_reached"), eq("openrouter"));
    }

    // ---- Continuation error retains content ----
    @Test
    void continuationErrorRetainsContentAndFinalizesOnce() throws Exception {
        provider.enqueue("m1", segment("Kept. ", "length", 10, 2));
        provider.enqueue("m1", Flux.concat(Flux.just(StreamEvent.delta("More.")),
                Flux.error(new IllegalStateException("upstream"))));
        CapturingEmitter emitter = run(false, List.of("m1"));
        Map<String, Object> done = emitter.awaitDone();
        assertEquals("incomplete", done.get("completionStatus"));
        assertEquals("provider_error", done.get("finalizationReason"));
        assertEquals(1, emitter.count("done"));
        verify(conversations, times(1)).addAssistantMessage(anyString(), eq("Kept. More."), anyString(),
                anyString(), anyString(), anyInt(), anyInt(), eq("incomplete"), eq("openrouter"));
    }

    @Test
    void providerErrorBeforeContentEmitsErrorWithoutPersistingEmptyAssistant() throws Exception {
        provider.enqueue("m1", Flux.error(new ApiException(
                org.springframework.http.HttpStatus.BAD_GATEWAY,
                "The Gemini service is temporarily rate limited. Please try again shortly.")));

        CapturingEmitter emitter = run(false, List.of("m1"));

        assertTrue(emitter.awaitEvent("error"));
        assertEquals(0, emitter.count("done"));
        assertEquals("The Gemini service is temporarily rate limited. Please try again shortly.",
                emitter.data("error").get("message"));
        verify(conversations, never()).addAssistantMessage(anyString(), anyString(), anyString(),
                anyString(), anyString(), anyInt(), anyInt(), any(), any());
    }

    @Test
    void providerTimeoutHasDistinctFinalizationReason() throws Exception {
        continuation = new ChatContinuationProperties(true, 3, 4096, 24000, 1, 600);
        provider.enqueue("m1", Flux.never());
        Map<String, Object> done = run(false, List.of("m1")).awaitDone();
        assertEquals("timeout", done.get("finalizationReason"));
        assertEquals(1, done.get("segments"));
    }

    // ---- Cancellation ----
    @Test
    void cancellationDisposesActiveStreamAndFinalizesAbortedOnce() throws Exception {
        AtomicReference<FluxSink<StreamEvent>> sink = new AtomicReference<>();
        CountDownLatch cancelled = new CountDownLatch(1);
        provider.enqueue("m1", Flux.create(s -> {
            sink.set(s);
            s.onCancel(cancelled::countDown);
            s.next(StreamEvent.delta("Partial"));
        }));
        CapturingEmitter emitter = run(false, List.of("m1"));
        assertTrue(emitter.awaitEvent("token"));
        emitter.triggerClientCompletion();
        Map<String, Object> done = emitter.awaitDone();
        assertEquals("aborted", done.get("completionStatus"));
        assertEquals(false, done.get("repairAttempted"));
        assertEquals(1, emitter.count("done"));
        assertTrue(cancelled.await(2, TimeUnit.SECONDS));
        sink.get().next(StreamEvent.done("length"));
        assertEquals(1, provider.requests.size());
    }

    // ---- Model switch before tokens ----
    @Test
    void failureBeforeTokensSwitchesModelWithoutSecondMeta() throws Exception {
        provider.enqueue("m1", Flux.error(new IllegalStateException("unavailable")));
        provider.enqueue("m2", segment("Fallback answer", "stop", 10, 2));
        CapturingEmitter emitter = run(false, List.of("m1", "m2"));
        Map<String, Object> done = emitter.awaitDone();
        assertEquals("m2", done.get("model"));
        assertEquals(1, emitter.count("meta"));
        assertEquals(1, emitter.count("model_switch"));
        assertEquals(1, emitter.count("done"));
    }

    // ---- Failure after tokens never switches ----
    @Test
    void failureAfterTokensNeverRestartsWithFallback() throws Exception {
        provider.enqueue("m1", Flux.concat(Flux.just(StreamEvent.delta("Partial")),
                Flux.error(new IllegalStateException("failed"))));
        CapturingEmitter emitter = run(false, List.of("m1", "m2"));
        assertEquals("incomplete", emitter.awaitDone().get("completionStatus"));
        assertEquals(0, emitter.count("model_switch"));
        assertEquals(1, provider.requests.size());
    }

    // ---- Safety filter never continues ----
    @Test
    void safetyNeverContinues() throws Exception {
        provider.enqueue("m1", segment("Safe partial", "content_filter", 10, 2));
        Map<String, Object> done = run(false, List.of("m1")).awaitDone();
        assertEquals("content_filter", done.get("finishReason"));
        assertEquals("incomplete", done.get("completionStatus"));
        assertEquals(1, provider.requests.size());
        assertEquals(false, done.get("repairAttempted"));
    }

    // ---- Learning category override ----
    @Test
    void teachingJavaUsesLearningBudgetCategoryWhileKeepingCodeModelRoute() throws Exception {
        when(router.resolve(any(), anyString(), anyString(), anyBoolean())).thenReturn(
                new Routed("m1", "m1", "code", "legacy code match", List.of("m1")));
        provider.enqueue("m1", segment("Lesson", "stop", 10, 2));
        CapturingEmitter emitter = new CapturingEmitter();
        service().stream("user-1", new ChatRequest("conversation-1", "auto", "general",
                "Teach arrays with Java examples", false, null, null), emitter);
        emitter.awaitDone();
        assertEquals("learning", emitter.data("meta").get("category"));
    }

    // ---- NEW integration tests for the redesigned pipeline ----

    @Test
    void completeStopIncludesFinalizationReason() throws Exception {
        provider.enqueue("m1", segment("Everything is fine here.", "stop", 10, 2));
        Map<String, Object> done = run(false, List.of("m1")).awaitDone();
        assertNotNull(done.get("finalizationReason"));
        assertEquals("normal_stop", done.get("finalizationReason"));
        assertEquals("complete structure", done.get("contentAnalysisReason"));
        assertNotNull(done.get("rawFinishReason"));
        assertEquals("stop", done.get("rawFinishReason"));
    }

    @Test
    void oneDoneEventPerStream() throws Exception {
        provider.enqueue("m1", segment("Complete.", "stop", 10, 2));
        CapturingEmitter emitter = run(false, List.of("m1"));
        emitter.awaitDone();
        assertEquals(1, emitter.count("done"));
    }

    @Test
    void oneAssistantPersistence() throws Exception {
        provider.enqueue("m1", segment("Complete.", "stop", 10, 2));
        run(false, List.of("m1")).awaitDone();
        verify(conversations, times(1)).addAssistantMessage(anyString(), anyString(),
                anyString(), anyString(), anyString(), anyInt(), anyInt(), anyString(), anyString());
    }

    @Test
    void oneUserPersistence() throws Exception {
        provider.enqueue("m1", segment("Complete.", "stop", 10, 2));
        run(false, List.of("m1")).awaitDone();
        verify(conversations, times(1)).addUserMessage(anyString(), anyString(),
                isNull(), anyString(), isNull(), eq(List.of()), isNull());
    }

    @Test
    void structuralFinalizationProvidesGenericReason() throws Exception {
        provider.enqueue("m1", segment("First. But the trailing", "stop", 10, 3));
        CapturingEmitter emitter = run(false, List.of("m1"));
        Map<String, Object> done = emitter.awaitDone();
        assertNotNull(done.get("finalizationReason"));
    }

    // ---- Arbitrary incomplete endings (not keyword-based) ----
    @Test
    void arbitraryRandomProseFragmentTriggersRepair() throws Exception {
        provider.enqueue("m1", segment(
                "Data structures are important for efficient algorithms. " +
                "The quicksort algorithm and", "stop", 10, 8));
        provider.enqueue("m1", segment(" its variants are widely used.", "stop", 12, 4));
        CapturingEmitter emitter = run(false, List.of("m1"));
        Map<String, Object> done = emitter.awaitDone();
        assertEquals(true, done.get("repairAttempted"));
    }

    @Test
    void completeMultiParagraphWithoutConclusionIsNotRepaired() throws Exception {
        provider.enqueue("m1", segment(
                "First paragraph describing the concept.\n\n" +
                "Second paragraph with more details.\n\n" +
                "Third paragraph wrapping things up properly.", "stop", 10, 10));
        CapturingEmitter emitter = run(false, List.of("m1"));
        Map<String, Object> done = emitter.awaitDone();
        assertEquals(false, done.get("repairAttempted"));
        assertEquals(false, done.get("tailTrimmed"));
    }

    @Test
    void summarySectionIsNotRepaired() throws Exception {
        provider.enqueue("m1", segment(
                "## Summary\nThis is a complete summary with proper ending.", "stop", 10, 6));
        CapturingEmitter emitter = run(false, List.of("m1"));
        Map<String, Object> done = emitter.awaitDone();
        assertEquals(false, done.get("repairAttempted"));
    }

    @Test
    void incompleteListAfterCompleteParagraphTrimsToList() throws Exception {
        provider.enqueue("m1", segment(
                "Complete paragraph here.\n\n- Item one\n- Item two\n- Item thr", "stop", 10, 8));
        CapturingEmitter emitter = run(false, List.of("m1"));
        Map<String, Object> done = emitter.awaitDone();
        assertEquals("Complete paragraph here.\n\n- Item one\n- Item two\n- Item thr", done.get("finalContent"));
        assertEquals(false, done.get("tailTrimmed"));
    }

    @Test
    void openCodeFenceAfterProseTrimsToProse() throws Exception {
        provider.enqueue("m1", segment(
                "First paragraph.\n\n```python\nprint('hello')\nprint('unfinis", "stop", 10, 8));
        CapturingEmitter emitter = run(false, List.of("m1"));
        Map<String, Object> done = emitter.awaitDone();
        assertEquals("First paragraph.\n\n```python\nprint('hello')\nprint('unfinis", done.get("finalContent"));
        assertEquals(false, done.get("tailTrimmed"));
    }

    @Test
    void plannedFirstSegmentPersistsPartialAndEmitsOneDone() throws Exception {
        String prompt = "Create a complete Spring Boot CRUD API including Entity, DTO, Repository, Service, "
                + "Controller, Exception Handling, Validation, Security Configuration, JWT, and Maven dependencies.";
        provider.enqueue("m1", segment("## Entity\n```java\nclass Entity {}\n```\n\nAssigned sections complete.", "stop", 20, 12));
        CapturingEmitter emitter = new CapturingEmitter();
        service().stream("user-1", new ChatRequest("conversation-1", "auto", "general",
                prompt, false, null, null), emitter);

        Map<String, Object> done = emitter.awaitDone();
        assertEquals("partial", done.get("completionStatus"));
        assertEquals("PLANNED_SEGMENTATION", done.get("finalizationReason"));
        assertEquals(true, done.get("hasRemainingContent"));
        assertEquals(1, done.get("segmentIndex"));
        assertEquals(1, emitter.count("done"));
        assertTrue(provider.requests.getFirst().stream().anyMatch(message ->
                message.get("content").toString().contains("Reserve for the next response")));
        verify(conversations).addAssistantMessage(eq("conversation-1"), anyString(), anyString(),
                anyString(), anyString(), anyInt(), anyInt(), eq("partial"), eq("openrouter"), anyString());
    }

    @Test
    void plannedContinuationUpdatesSameMessageAndCompletesWithoutRepeatingSections() throws Exception {
        String prompt = "Create a complete Spring Boot CRUD API including Entity, DTO, Repository, Service, "
                + "Controller, Exception Handling, Validation, Security Configuration, JWT, and Maven dependencies.";
        SemanticResponsePlanner planner = new SemanticResponsePlanner();
        SemanticResponsePlanner.Plan plan = planner.plan(prompt, 4096);
        Conversation conversation = Conversation.builder().id("conversation-1").mode("general").build();
        Message target = Message.builder().id("assistant-1").conversation(conversation)
                .role(MessageRole.ASSISTANT).content("Completed first segment.\n")
                .responsePlanJson(planner.write(plan)).modelUsed("m1").selectedProvider("openrouter").build();
        when(conversations.requireOwnedAssistant("user-1", "conversation-1", "assistant-1")).thenReturn(target);
        when(conversations.messages("conversation-1")).thenReturn(List.of(target));
        provider.enqueue("m1", segment("Remaining sections complete.", "stop", 15, 6));

        ChatRequest request = new ChatRequest("conversation-1", "m1", "general", "Continue exactly",
                false, null, null, null, null, null, true, "assistant-1", target.getContent());
        CapturingEmitter emitter = new CapturingEmitter();
        service().stream("user-1", request, emitter);
        Map<String, Object> done = emitter.awaitDone();

        assertEquals("complete", done.get("completionStatus"));
        assertEquals(false, done.get("hasRemainingContent"));
        assertEquals(2, done.get("segmentIndex"));
        assertEquals(1, emitter.count("done"));
        String continuationInstruction = provider.requests.getFirst().getLast().get("content").toString();
        assertTrue(continuationInstruction.contains("Do not repeat completed content"));
        assertTrue(continuationInstruction.contains(plan.remainingSections().getFirst()));
        verify(conversations, never()).addUserMessage(anyString(), anyString(), any(), any(), any(), anyList(), any());
        verify(conversations, never()).addAssistantMessage(anyString(), anyString(), anyString(), anyString(),
                anyString(), anyInt(), anyInt(), any(), any());
        verify(conversations).updateAssistantMessage(eq("user-1"), eq("conversation-1"), eq("assistant-1"),
                eq("Completed first segment.\nRemaining sections complete."), anyString(), anyString(), anyString(),
                anyInt(), anyInt(), eq("complete"), eq("openrouter"), anyString());
    }

    @Test
    void plannedFinalSegmentMayAutoContinueAfterTokenLimitWithoutLosingPlanOrMessageIdentity() throws Exception {
        String prompt = "Create a complete API including Entity, DTO, Repository, Service, Controller, "
                + "Exception Handling, Validation, Security, JWT, and Dependencies.";
        SemanticResponsePlanner planner = new SemanticResponsePlanner();
        SemanticResponsePlanner.Plan first = planner.plan(prompt, 4096);
        Conversation conversation = Conversation.builder().id("conversation-1").mode("general").build();
        Message target = Message.builder().id("assistant-1").conversation(conversation)
                .role(MessageRole.ASSISTANT).content("First segment. ")
                .responsePlanJson(planner.write(first)).modelUsed("m1").selectedProvider("openrouter").build();
        when(conversations.requireOwnedAssistant("user-1", "conversation-1", "assistant-1")).thenReturn(target);
        when(conversations.messages("conversation-1")).thenReturn(List.of(target));
        provider.enqueue("m1", segment("Remaining section", "length", 11, 3));
        provider.enqueue("m1", segment("Remaining section complete.", "stop", 12, 4));

        ChatRequest request = new ChatRequest("conversation-1", "m1", "general", "Continue exactly",
                false, null, null, null, null, null, true, "assistant-1", target.getContent());
        CapturingEmitter emitter = new CapturingEmitter();
        service().stream("user-1", request, emitter);
        Map<String, Object> done = emitter.awaitDone();

        assertEquals("complete", done.get("completionStatus"));
        assertEquals("complete", done.get("finalizationReason"));
        assertEquals("m1", done.get("model"));
        assertEquals(23, done.get("promptTokens"));
        assertEquals(7, done.get("completionTokens"));
        assertEquals(2, done.get("segments"));
        assertEquals(1, emitter.count("done"));
        assertEquals(2, provider.requests.size());
        verify(conversations, never()).addUserMessage(anyString(), anyString(), any(), any(), any(), anyList(), any());
        verify(conversations, never()).addAssistantMessage(anyString(), anyString(), anyString(), anyString(),
                anyString(), anyInt(), anyInt(), any(), any());
        verify(conversations).updateAssistantMessage(eq("user-1"), eq("conversation-1"), eq("assistant-1"),
                eq("First segment. Remaining section complete."), eq("m1"), anyString(), anyString(),
                eq(23), eq(7), eq("complete"), eq("openrouter"), argThat(json -> {
                    SemanticResponsePlanner.Plan persisted = planner.read(json);
                    return persisted != null && persisted.segmentIndex() == 2
                            && !persisted.hasRemainingContent();
                }));
    }

    // --------------------------------------------------------------- helpers

    private CapturingEmitter run(boolean useRag, List<String> chain) {
        when(router.resolve(any(), anyString(), anyString(), anyBoolean())).thenReturn(
                new Routed(chain.getFirst(), chain.getFirst(), "general", "test route", chain));
        ChatService service = service();
        CapturingEmitter emitter = new CapturingEmitter();
        service.stream("user-1", new ChatRequest("conversation-1", "auto", "general",
                "original prompt", useRag, null, null), emitter);
        return emitter;
    }

    private ChatService service() {
        LlmProviderResolver resolver = mock(LlmProviderResolver.class);
        when(resolver.active()).thenReturn(provider);
        ModelRegistryProperties registryProps = new ModelRegistryProperties(true, Duration.ofHours(1),
                Duration.ofSeconds(1), 20, false, false, false);
        ModelRegistry registry = new ModelRegistry(List.of(), registryProps, new PrivacyPolicyEvaluator());
        ScoredRouter scored = mock(ScoredRouter.class);
        when(scored.appliesTo(any(), any())).thenReturn(false);
        return new ChatService(rateLimit, conversations, router, mock(OfflineRouter.class),
                rag, documents, prompts, resolver, mock(ActiveModelService.class), mock(ModelCatalogService.class),
                new GeminiProperties("", null, null, null), new RequestClassifier(new IntentClassifier()),
                new PrivacyPolicyEvaluator(), scored,
                new ChatOutputProperties(2048, 6144, 8192, 12288, 8192, 10240, 4096, 4096, 512),
                registry, continuation,
                new ChatCompletionRepairProperties(true, 1, 512),
                new SemanticResponsePlanner(),
                mock(ProviderHealthTracker.class),
                new FallbackProperties(null, null, null, null, true, 4));
    }

    private static Flux<StreamEvent> segment(String text, String finish, int prompt, int completion) {
        return Flux.just(StreamEvent.delta(text), new StreamEvent(null, finish, true, prompt, completion));
    }

    private static final class ScriptedProvider implements LlmProvider {
        final Map<String, Deque<Flux<StreamEvent>>> scripts = new HashMap<>();
        final List<List<Map<String, Object>>> requests = new CopyOnWriteArrayList<>();
        final List<ChatOptions> options = new CopyOnWriteArrayList<>();
        void enqueue(String model, Flux<StreamEvent> flux) {
            scripts.computeIfAbsent(model, ignored -> new ArrayDeque<>()).add(flux);
        }
        @Override public String id() { return "openrouter"; }
        @Override public Flux<StreamEvent> streamChat(String model, List<Map<String, Object>> messages, ChatOptions options) {
            requests.add(List.copyOf(messages));
            this.options.add(options);
            Deque<Flux<StreamEvent>> queue = scripts.get(model);
            return queue == null || queue.isEmpty() ? Flux.error(new AssertionError("No script for " + model)) : queue.removeFirst();
        }
        @Override public ChatResult chat(String model, List<Map<String, Object>> messages, ChatOptions options) { throw new UnsupportedOperationException(); }
        @Override public float[][] embed(List<String> texts, String model) { throw new UnsupportedOperationException(); }
        @Override public ProviderHealth health() { return new ProviderHealth(true, true, "test"); }
    }

    private static final class CapturingEmitter extends SseEmitter {
        private final List<Captured> events = new CopyOnWriteArrayList<>();
        private final CountDownLatch done = new CountDownLatch(1);
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
        }

        @Override public synchronized void onCompletion(Runnable callback) { completion = callback; }
        @Override public synchronized void complete() { if (completion != null) completion.run(); }
        void triggerClientCompletion() { if (completion != null) completion.run(); }
        boolean awaitEvent(String name) throws InterruptedException {
            for (int i = 0; i < 100; i++) {
                if (count(name) > 0) return true;
                Thread.sleep(10);
            }
            return false;
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> awaitDone() throws InterruptedException {
            assertTrue(done.await(5, TimeUnit.SECONDS), "stream did not emit done");
            return (Map<String, Object>) events.stream().filter(e -> "done".equals(e.name)).findFirst().orElseThrow().data;
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
}
