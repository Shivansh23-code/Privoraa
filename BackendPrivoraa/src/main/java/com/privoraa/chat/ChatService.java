package com.privoraa.chat;

import com.privoraa.ai.classification.ExecutionTarget;
import com.privoraa.ai.classification.ExecutionTarget;
import com.privoraa.ai.classification.PrivacyPolicyEvaluator;
import com.privoraa.ai.classification.PrivacyPolicyViolationException;
import com.privoraa.ai.classification.RequestClassification;
import com.privoraa.ai.classification.RequestClassificationInput;
import com.privoraa.ai.classification.RequestClassifier;
import com.privoraa.chat.dto.ChatRequest;
import com.privoraa.chat.dto.ChatResponse;
import com.privoraa.common.ApiException;
import com.privoraa.common.RateLimitException;
import com.privoraa.conversation.Conversation;
import com.privoraa.conversation.ConversationService;
import com.privoraa.conversation.Message;
import com.privoraa.conversation.dto.MessageDto;
import com.privoraa.catalog.ActiveModelService;
import com.privoraa.ai.registry.ModelDescriptor;
import com.privoraa.ai.registry.ModelProvider;
import com.privoraa.ai.registry.ModelRegistry;
import com.privoraa.config.ChatContinuationProperties;
import com.privoraa.config.ChatCompletionRepairProperties;
import com.privoraa.config.ChatOutputProperties;
import com.privoraa.config.FallbackProperties;
import com.privoraa.config.GeminiProperties;
import com.privoraa.llm.ChatOptions;
import com.privoraa.llm.ChatResult;
import com.privoraa.llm.LlmProvider;
import com.privoraa.llm.LlmProviderResolver;
import com.privoraa.llm.ProviderHealthTracker;
import com.privoraa.llm.RetryableErrorClassifier;
import com.privoraa.model.ModelCatalogService;
import com.privoraa.model.ModelDto;
import com.privoraa.ratelimit.RateLimitService;
import com.privoraa.rag.RagContext;
import com.privoraa.rag.RagService;
import com.privoraa.rag.DocumentService;
import com.privoraa.routing.ModelRouter;
import com.privoraa.routing.OfflineRouter;
import com.privoraa.routing.Routed;
import com.privoraa.routing.ScoredRouter;
import com.privoraa.routing.ScoredRoutingException;
import com.privoraa.routing.ScoredRoutingResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.scheduler.Schedulers;
import reactor.core.Disposable;
import reactor.core.Disposables;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    private final RateLimitService rateLimit;
    private final ConversationService conversations;
    private final ModelRouter router;
    private final OfflineRouter offlineRouter;
    private final RagService ragService;
    private final DocumentService documentService;
    private final PromptBuilder promptBuilder;
    private final LlmProviderResolver providers;
    private final ActiveModelService activeModel;
    private final ModelCatalogService catalog;
    private final GeminiProperties gemini;
    private final RequestClassifier requestClassifier;
    private final PrivacyPolicyEvaluator privacyPolicy;
    private final ScoredRouter scoredRouter;
    private final ChatOutputProperties outputProps;
    private final ModelRegistry registry;
    private final ChatContinuationProperties continuationProps;
    private final ChatCompletionRepairProperties repairProps;
    private final SemanticResponsePlanner responsePlanner;
    private final ProviderHealthTracker healthTracker;
    private final FallbackProperties fallbackProps;

    @Autowired
    public ChatService(RateLimitService rateLimit, ConversationService conversations, ModelRouter router,
                       OfflineRouter offlineRouter, RagService ragService, DocumentService documentService,
                       PromptBuilder promptBuilder, LlmProviderResolver providers, ActiveModelService activeModel,
                       ModelCatalogService catalog, GeminiProperties gemini, RequestClassifier requestClassifier,
                       PrivacyPolicyEvaluator privacyPolicy, ScoredRouter scoredRouter,
                       ChatOutputProperties outputProps, ModelRegistry registry,
                       ChatContinuationProperties continuationProps,
                       ChatCompletionRepairProperties repairProps,
                       SemanticResponsePlanner responsePlanner,
                       ProviderHealthTracker healthTracker,
                       FallbackProperties fallbackProps) {
        this.rateLimit = rateLimit;
        this.conversations = conversations;
        this.router = router;
        this.offlineRouter = offlineRouter;
        this.ragService = ragService;
        this.documentService = documentService;
        this.promptBuilder = promptBuilder;
        this.providers = providers;
        this.activeModel = activeModel;
        this.catalog = catalog;
        this.gemini = gemini;
        this.requestClassifier = requestClassifier;
        this.privacyPolicy = privacyPolicy;
        this.scoredRouter = scoredRouter;
        this.outputProps = outputProps;
        this.registry = registry;
        this.continuationProps = continuationProps;
        this.repairProps = repairProps;
        this.responsePlanner = responsePlanner;
        this.healthTracker = healthTracker;
        this.fallbackProps = fallbackProps;
    }

    // ----------------------------------------------------------------- streaming

    public SseEmitter stream(String userId, ChatRequest req) {
        return stream(userId, req, (String) null);
    }

    public SseEmitter stream(String userId, ChatRequest req, String suppliedRequestId) {
        return stream(userId, req, new SseEmitter(0L), normalizeRequestId(suppliedRequestId));
    }

    /** Package-private emitter seam used by deterministic streaming integration tests. */
    SseEmitter stream(String userId, ChatRequest req, SseEmitter emitter) {
        return stream(userId, req, emitter, normalizeRequestId(null));
    }

    private SseEmitter stream(String userId, ChatRequest req, SseEmitter emitter, String requestId) {

        try {
            rateLimit.check(userId);
        } catch (RateLimitException e) {
            send(emitter, "error", Map.of("message", e.getMessage(), "retryAfter", e.getRetryAfterSeconds()));
            emitter.complete();
            return emitter;
        }

        Prepared p;
        try {
            RequestClassification classification = classifyAndEnforce(req);
            p = prepare(userId, req, classification, true);
        } catch (Exception e) {
            send(emitter, "error", Map.of("message", friendly(e)));
            emitter.complete();
            return emitter;
        }

        new StreamSession(emitter, p, requestId, userId).start();
        return emitter;
    }

    private enum StreamState { ACTIVE_SEGMENT, CONTINUING, REPAIRING, COMPLETED, FAILED, LIMIT_REACHED, ABORTED }

    private final class StreamSession {
        private static final String CONTINUE_INSTRUCTION = "Continue exactly from the prior assistant response. "
                + "Do not restart or repeat earlier headings or paragraphs. Preserve markdown structure, "
                + "complete every remaining requested section, and begin immediately with continuation content. "
                + "Do not mention token limits or continuation mechanics.";
        private static final String REPAIR_INSTRUCTION = "Complete only the unfinished final thought from the prior assistant response. "
                + "Do not restart the answer. Do not repeat previous sections. "
                + "Begin immediately with the missing continuation. Finish with a complete sentence. "
                + "Do not mention continuation, token limits, or repair.";
        private final SseEmitter emitter;
        private final Prepared prepared;
        private final String requestId;
        private final String userId;
        private final StringBuilder accumulated = new StringBuilder();
        private final Disposable.Swap active = Disposables.swap();
        private final AtomicBoolean cancelled = new AtomicBoolean(false);
        private final AtomicBoolean finalized = new AtomicBoolean(false);
        private final AtomicInteger totalPromptTokens = new AtomicInteger();
        private final AtomicInteger totalCompletionTokens = new AtomicInteger();
        private volatile boolean tokenCountEstimated;
        private volatile boolean repairAttempted;
        private volatile boolean completionRepaired;
        private int repairSegments;
        private volatile StreamState state = StreamState.ACTIVE_SEGMENT;
        private int segments;
        private int modelIndex;
        private String activeModel;
        private int unknownContinuations;
        private LlmProvider activeProvider;
        private List<String> activeChain;
        private volatile LlmProvider currentProvider;
        private List<String> openrouterFallbackChain;
        private int openrouterFallbackIndex;

        StreamSession(SseEmitter emitter, Prepared prepared, String requestId, String userId) {
            this.emitter = emitter;
            this.prepared = prepared;
            this.requestId = requestId;
            this.userId = userId;
            this.activeProvider = prepared.provider();
            this.activeChain = prepared.chain();
            this.currentProvider = prepared.provider();
            emitter.onTimeout(this::cancel);
            emitter.onError(ignored -> cancel());
            emitter.onCompletion(this::cancel);
        }

        void start() {
            activeModel = activeChain.getFirst();
            if (prepared.continuation()) accumulated.append(prepared.existingContent());
            log.info("Chat stream started requestId={} provider={} model={}",
                    requestId, currentProvider.id(), activeModel);
            send(emitter, "meta", metaPayload(nameOf(activeModel), prepared));
            runSegment(prepared.continuation() ? continuationMessages() : prepared.messages(),
                    prepared.continuation());
        }

        private void runSegment(List<Map<String, Object>> messages, boolean continuation) {
            if (cancelled.get()) return;
            state = continuation ? StreamState.CONTINUING : StreamState.ACTIVE_SEGMENT;
            segments++;
            StringBuilder segment = new StringBuilder();
            AtomicBoolean emitted = new AtomicBoolean(false);
            AtomicBoolean terminal = new AtomicBoolean(false);
            AtomicReference<String> reason = new AtomicReference<>();
            AtomicInteger providerPrompt = new AtomicInteger();
            AtomicInteger providerCompletion = new AtomicInteger();
            int remaining = Math.max(1, continuationProps.maxTotalCompletionTokens()
                    - totalCompletionTokens.get());
            int configured = continuation ? continuationProps.maxOutputTokens()
                    : (prepared.options().maxTokens() == null ? remaining : prepared.options().maxTokens());
            ChatOptions segmentOptions = prepared.options().withMaxTokens(Math.max(1, Math.min(configured, remaining)));
            send(emitter, "segment", Map.of("segment", segments, "continuation", continuation,
                    "maxOutputTokens", segmentOptions.maxTokens()));
            log.info("Chat segment request requestId={} conversationId={} provider={} model={} segment={} "
                            + "requestedMaxOutputTokens={} promptTokenEstimate={}",
                    requestId, prepared.conversationId(), currentProvider.id(), activeModel, segments,
                    segmentOptions.maxTokens(), promptBuilder.estimatePromptTokens(messages));
            Disposable subscription = currentProvider.streamChat(activeModel, messages, segmentOptions)
                    .timeout(Duration.ofSeconds(continuationProps.timeoutSeconds()))
                    .subscribeOn(Schedulers.boundedElastic())
                    .subscribe(event -> {
                        if (cancelled.get()) return;
                        if (event.promptTokens() > 0) providerPrompt.set(event.promptTokens());
                        if (event.completionTokens() > 0) providerCompletion.set(event.completionTokens());
                        if (event.terminal()) {
                            terminal.set(true);
                            reason.set(event.finishReason());
                        } else if (event.delta() != null && !event.delta().isEmpty()) {
                            emitted.set(true);
                            segment.append(event.delta());
                            if (!continuation) {
                                accumulated.append(event.delta());
                                send(emitter, "token", Map.of("delta", event.delta()));
                            }
                        }
                    }, err -> {
                        if (continuation && segment.length() > 0) {
                            String merged = ContinuationMerger.merge(accumulated.toString(), segment.toString(),
                                    continuationProps.overlapWindowChars());
                            String unique = merged.substring(accumulated.length());
                            accumulated.setLength(0);
                            accumulated.append(merged);
                            if (!unique.isEmpty()) send(emitter, "token", Map.of("delta", unique));
                        }
                        if (segment.length() > 0) {
                            // Error responses have no authoritative terminal usage;
                            // retain an explicitly estimated count for emitted content.
                            addUsage(0, 0, segment.length(), messages);
                        }
                        onError(err, emitted.get(), continuation);
                    }, () -> {
                        if (cancelled.get() || finalized.get()) return;
                        if (continuation) {
                            String merged = ContinuationMerger.merge(accumulated.toString(), segment.toString(),
                                    continuationProps.overlapWindowChars());
                            String unique = merged.substring(accumulated.length());
                            accumulated.setLength(0);
                            accumulated.append(merged);
                            if (!unique.isEmpty()) send(emitter, "token", Map.of("delta", unique));
                        }
                        addUsage(providerPrompt.get(), providerCompletion.get(), segment.length(), messages);
                        String finish = terminal.get() ? reason.get() : (emitted.get() ? "incomplete" : "unknown");
                        onSegmentComplete(finish);
                    });
            // If cancellation won the race before subscribe() returned, update()
            // immediately disposes this subscription instead of losing it.
            active.update(subscription);
        }

        private void onError(Throwable err, boolean emitted, boolean continuation) {
            if (cancelled.get() || finalized.get()) return;
            if (!continuation && !emitted && accumulated.isEmpty() && modelIndex + 1 < activeChain.size()) {
                String previous = activeModel;
                activeModel = activeChain.get(++modelIndex);
                segments--;
                send(emitter, "model_switch", Map.of("from", nameOf(previous), "to", nameOf(activeModel),
                        "reason", "Previous model failed before emitting content"));
                log.warn("Model failed before output requestId={} provider={} fromModel={} toModel={}",
                        requestId, activeProvider.id(), previous, activeModel);
                runSegment(prepared.messages(), false);
                return;
            }
            // Cross-provider fallback: try fallback provider when chain is exhausted
            if (!continuation && !emitted && accumulated.isEmpty()
                    && modelIndex + 1 >= activeChain.size()
                    && prepared.fallbackProvider() != null
                    && activeProvider != prepared.fallbackProvider()) {
                String previous = activeProvider.id() + "/" + activeModel;
                activeProvider = prepared.fallbackProvider();
                activeChain = prepared.fallbackChain();
                activeModel = activeChain.getFirst();
                modelIndex = -1;
                segments--;
                send(emitter, "meta", Map.of("model", nameOf(activeModel),
                        "category", prepared.routed().category(),
                        "reason", "Fallback to " + nameOf(activeModel),
                        "provider", activeProvider.id()));
                log.warn("Cross-provider fallback requestId={} fromProvider={} model={} toProvider={} model={}",
                        requestId, previous, activeModel, activeProvider.id(), activeModel);
                runSegment(prepared.messages(), false);
                return;
            }
            log.warn("Provider stream failed requestId={} provider={} model={} content={} segment={} errorType={}",
                    requestId, activeProvider.id(), activeModel,
                    !accumulated.isEmpty(), segments, err.getClass().getSimpleName());
                        requestId, currentProvider.id(), previous, activeModel);
                runSegment(prepared.messages(), false);
                return;
            }
            RetryableErrorClassifier.Category cat = RetryableErrorClassifier.classify(err);
            if (cat == RetryableErrorClassifier.Category.NON_RETRYABLE_CANCELLED) {
                cancel();
                return;
            }
            if (RetryableErrorClassifier.isRetryable(err)) {
                java.time.Duration retryAfter = RetryableErrorClassifier.extractRetryAfter(err);
                healthTracker.recordRetryableFailure(currentProvider.id(), activeModel, cat, retryAfter);
            } else {
                healthTracker.recordNonRetryableFailure(currentProvider.id(), activeModel);
            }
            if (RetryableErrorClassifier.isRetryable(err)
                    && !continuation && !emitted && accumulated.isEmpty()
                    && "gemini".equals(currentProvider.id()) && isAuto(prepared.routed().modelId())) {
                if (tryAutoFallback(err)) return;
            }
            log.warn("Provider stream failed requestId={} provider={} model={} content={} segment={} errorType={} "
                            + "retryable={}",
                    requestId, currentProvider.id(), activeModel,
                    !accumulated.isEmpty(), segments, err.getClass().getSimpleName(),
                    RetryableErrorClassifier.isRetryable(err));
            state = StreamState.FAILED;
            if (!(err instanceof java.util.concurrent.TimeoutException)
                    && !emitted && accumulated.isEmpty()) {
                failBeforeContent(err);
                return;
            }
            finish(err instanceof java.util.concurrent.TimeoutException ? "timeout" : "provider_error",
                    "incomplete", false);
        }

        /**
         * A provider rejection before the first token is a failed request, not an
         * incomplete assistant response. Emitting {@code done} here would persist
         * an empty assistant message and mark it continuable in the client.
         */
        private void failBeforeContent(Throwable err) {
            if (RetryableErrorClassifier.isRetryable(err)
                    && "gemini".equals(currentProvider.id()) && isAuto(prepared.routed().modelId())) {
                if (tryAutoFallback(err)) return;
            }
            if (!finalized.compareAndSet(false, true)) return;
            log.info("Chat stream rejected before content requestId={} conversationId={} provider={} model={} "
                            + "errorType={}",
                    requestId, prepared.conversationId(), currentProvider.id(), activeModel,
                    err.getClass().getSimpleName());
            send(emitter, "error", Map.of("message", friendly(err)));
            emitter.complete();
        }

        private boolean tryAutoFallback(Throwable originalError) {
            if (!fallbackProps.enabled()) return false;
            if (!isAuto(prepared.routed().modelId())) return false;
            if (openrouterFallbackChain == null) {
                openrouterFallbackChain = findAutoFallbackModels();
                openrouterFallbackIndex = 0;
            }
            LlmProvider openrouter = providers.byId("openrouter");
            while (openrouterFallbackIndex < openrouterFallbackChain.size()) {
                String candidate = openrouterFallbackChain.get(openrouterFallbackIndex++);
                if (!healthTracker.isHealthy("openrouter", candidate)) {
                    log.info("Auto fallback skipping unhealthy model provider=openrouter model={}", candidate);
                    continue;
                }
                if (!isFallbackAllowedForPrivacy()) {
                    log.info("Auto fallback skipping candidate provider=openrouter model={} reason=privacy_policy",
                            candidate);
                    continue;
                }
                String previous = activeModel;
                String previousProvider = currentProvider.id();
                activeModel = candidate;
                currentProvider = openrouter;
                segments--;
                send(emitter, "model_switch", Map.of("from", nameOf(previous), "to", nameOf(activeModel),
                        "reason", "Gemini failed before content; falling back to OpenRouter"));
                log.warn("Auto fallback requestId={} fromProvider={} fromModel={} toProvider=openrouter toModel={}",
                        requestId, previousProvider, previous, candidate);
                runSegment(prepared.messages(), false);
                return true;
            }
            log.warn("Auto fallback exhausted all candidates requestId={} originalErrorType={}",
                    requestId, originalError.getClass().getSimpleName());
            return false;
        }

        private boolean isFallbackAllowedForPrivacy() {
            try {
                privacyPolicy.requireAllowed(prepared.classification(), ExecutionTarget.CLOUD_PROVIDER);
                return true;
            } catch (PrivacyPolicyViolationException e) {
                return false;
            }
        }

        private List<String> findAutoFallbackModels() {
            return registry.currentSnapshot().models().stream()
                    .filter(m -> m.provider() == ModelProvider.OPENROUTER)
                    .filter(m -> m.selectable())
                    .filter(m -> m.streamingSupported())
                    .filter(m -> m.pricingTier() != com.privoraa.ai.registry.PricingTier.PAID
                            && m.pricingTier() != com.privoraa.ai.registry.PricingTier.UNKNOWN)
                    .sorted((a, b) -> {
                        int byPrice = a.pricingTier().compareTo(b.pricingTier());
                        if (byPrice != 0) return byPrice;
                        return b.source().compareTo(a.source());
                    })
                    .map(ModelDescriptor::providerModelId)
                    .distinct()
                    .limit(4)
                    .toList();
        }

        private void onSegmentComplete(String rawReason) {
            FinishReasonClassifier.Classification finish = FinishReasonClassifier.classify(rawReason);
            ResponseCompletenessAnalyzer.Result analysis = ResponseCompletenessAnalyzer.analyze(accumulated.toString());
            boolean plannedBoundary = prepared.responsePlan() != null
                    && prepared.responsePlan().hasRemainingContent()
                    && finish.kind() == FinishReasonClassifier.Kind.COMPLETE
                    && analysis.complete();
            if (plannedBoundary) {
                state = StreamState.COMPLETED;
                finish(finish.raw(), "partial", false);
                return;
            }
            boolean incomplete = finish.kind() == FinishReasonClassifier.Kind.TOKEN_LIMIT || !analysis.complete();
            boolean recoverable = finish.kind() == FinishReasonClassifier.Kind.TOKEN_LIMIT
                    || (finish.kind() == FinishReasonClassifier.Kind.COMPLETE && analysis.recoverable())
                    || (finish.kind() == FinishReasonClassifier.Kind.UNKNOWN && analysis.recoverable()
                        && unknownContinuations < 1);
            boolean continueNow = incomplete && recoverable && canContinue();
            log.info("Chat segment complete requestId={} conversationId={} provider={} model={} segment={} "
                            + "completionTokens={} rawFinishReason={} normalizedFinishReason={} accumulatedLength={} "
                            + "continuationDecision={} continuationStopReason={}",
                    requestId, prepared.conversationId(), currentProvider.id(), activeModel, segments,
                    totalCompletionTokens.get(), finish.raw(), finish.normalized(), accumulated.length(), continueNow,
                    continueNow ? "continuing" : continuationStopReason(finish, incomplete));
            if (continueNow) {
                if (finish.kind() == FinishReasonClassifier.Kind.UNKNOWN) unknownContinuations++;
                if (finish.kind() == FinishReasonClassifier.Kind.COMPLETE && repairProps.enabled()
                        && repairProps.maxAttempts() > 0 && !repairAttempted) runRepair();
                else runSegment(continuationMessages(), true);
            } else if (incomplete && recoverable) {
                state = StreamState.LIMIT_REACHED;
                finish(finish.raw(), finish.kind() == FinishReasonClassifier.Kind.TOKEN_LIMIT
                        ? "limit_reached" : "incomplete", false);
            } else if ((finish.kind() == FinishReasonClassifier.Kind.COMPLETE
                    || finish.kind() == FinishReasonClassifier.Kind.UNKNOWN) && analysis.complete()) {
                state = StreamState.COMPLETED;
                finish(finish.raw(), "complete", false);
            } else if (finish.kind() == FinishReasonClassifier.Kind.SAFETY) {
                state = StreamState.COMPLETED;
                finish(finish.raw(), "incomplete", false);
            } else {
                state = StreamState.FAILED;
                finish(finish.raw(), "incomplete", false);
            }
        }

        private String continuationStopReason(FinishReasonClassifier.Classification finish, boolean incomplete) {
            if (!incomplete) return "complete";
            if (finish.kind() == FinishReasonClassifier.Kind.SAFETY) return "safety_or_refusal";
            if (finish.kind() == FinishReasonClassifier.Kind.CANCELLED_OR_ERROR) return "provider_error";
            if (!continuationProps.enabled()) return "disabled";
            if (segments >= continuationProps.maxSegments()) return "max_segments";
            if (totalCompletionTokens.get() >= continuationProps.maxTotalCompletionTokens()) return "token_budget";
            return "unrecoverable";
        }

        private void runRepair() {
            if (cancelled.get() || finalized.get() || repairAttempted) return;
            state = StreamState.REPAIRING;
            repairAttempted = true;
            repairSegments = 1;
            segments++;
            List<Map<String, Object>> messages = new ArrayList<>(prepared.messages());
            messages.add(Map.of("role", "assistant", "content", accumulated.toString()));
            messages.add(Map.of("role", "user", "content", REPAIR_INSTRUCTION));
            StringBuilder repair = new StringBuilder();
            AtomicReference<String> terminalReason = new AtomicReference<>("unknown");
            AtomicInteger providerPrompt = new AtomicInteger();
            AtomicInteger providerCompletion = new AtomicInteger();
            ChatOptions options = prepared.options().withMaxTokens(repairProps.maxOutputTokens());

            Disposable subscription = currentProvider.streamChat(activeModel, messages, options)
                    .subscribeOn(Schedulers.boundedElastic())
                    .subscribe(event -> {
                        if (cancelled.get()) return;
                        if (event.promptTokens() > 0) providerPrompt.set(event.promptTokens());
                        if (event.completionTokens() > 0) providerCompletion.set(event.completionTokens());
                        if (event.terminal()) terminalReason.set(normalizeReason(event.finishReason()));
                        else if (event.delta() != null) repair.append(event.delta());
                    }, error -> {
                        if (cancelled.get() || finalized.get()) return;
                        if (!repair.isEmpty()) addUsage(0, 0, repair.length(), messages);
                        finishAfterFailedRepair(repair.toString());
                    }, () -> {
                        if (cancelled.get() || finalized.get()) return;
                        addUsage(providerPrompt.get(), providerCompletion.get(), repair.length(), messages);
                        String merged = mergeRepair(repair.toString());
                        ResponseCompletenessAnalyzer.Result result = ResponseCompletenessAnalyzer.analyze(merged);
                        if ("stop".equals(terminalReason.get())
                                && result.state() == ResponseCompletenessAnalyzer.State.COMPLETE) {
                            completionRepaired = true;
                            state = StreamState.COMPLETED;
                            finish("stop", "complete", false);
                        } else {
                            if (canContinue()) runSegment(continuationMessages(), true);
                            else {
                                state = StreamState.LIMIT_REACHED;
                                finish(terminalReason.get(), "incomplete", false);
                            }
                        }
                    });
            active.update(subscription);
        }

        private void finishAfterFailedRepair(String repair) {
            mergeRepair(repair);
            state = StreamState.FAILED;
            finish("provider_error", "incomplete", false);
        }

        private String mergeRepair(String repair) {
            if (repair == null || repair.isBlank()) return accumulated.toString();
            String merged = ContinuationMerger.merge(accumulated.toString(), repair,
                    continuationProps.overlapWindowChars());
            String unique = merged.substring(accumulated.length());
            accumulated.setLength(0);
            accumulated.append(merged);
            if (!unique.isEmpty()) send(emitter, "token", Map.of("delta", unique));
            return merged;
        }

        private boolean canContinue() {
            return continuationProps.enabled() && !cancelled.get()
                    && segments < continuationProps.maxSegments()
                    && totalCompletionTokens.get() < continuationProps.maxTotalCompletionTokens();
        }

        private List<Map<String, Object>> continuationMessages() {
            List<Map<String, Object>> messages = new ArrayList<>(prepared.messages());
            int tailStart = Math.max(0, accumulated.length() - continuationProps.overlapWindowChars());
            messages.add(Map.of("role", "assistant", "content", accumulated.substring(tailStart)));
            String instruction = prepared.responsePlan() == null ? CONTINUE_INSTRUCTION
                    : prepared.continuation()
                        ? responsePlanner.continuationInstruction(prepared.responsePlan())
                        : responsePlanner.generationInstruction(prepared.responsePlan())
                            + " Continue only from the prior output; do not repeat content already produced.";
            messages.add(Map.of("role", "user", "content", instruction));
            return messages;
        }

        private void addUsage(int providerPrompt, int providerCompletion, int chars,
                              List<Map<String, Object>> messages) {
            if (providerPrompt > 0) totalPromptTokens.addAndGet(providerPrompt);
            else {
                totalPromptTokens.addAndGet(messages == prepared.messages() ? prepared.promptTokens()
                        : promptBuilder.estimatePromptTokens(messages));
                tokenCountEstimated = true;
            }
            if (providerCompletion > 0) totalCompletionTokens.addAndGet(providerCompletion);
            else {
                totalCompletionTokens.addAndGet(Math.max(1, chars / 4));
                tokenCountEstimated = true;
            }
        }

        private void cancel() {
            if (!cancelled.compareAndSet(false, true) || finalized.get()) return;
            state = StreamState.ABORTED;
            active.dispose();
            finish("aborted", "aborted", true);
        }

        private void finish(String reason, String completionStatus, boolean aborted) {
            if (!finalized.compareAndSet(false, true)) return;
            // Zero-content failure: skip persistence, emit error instead of done
            if (accumulated.isEmpty() && !"complete".equals(completionStatus) && !aborted) {
                send(emitter, "error", Map.of("message",
                        "The AI model failed to produce a response. Please try again."));
                emitter.complete();
                return;
            }
            healthTracker.recordSuccess(currentProvider.id(), activeModel);
            int completion = totalCompletionTokens.get();
            if (completion == 0 && !accumulated.isEmpty()) {
                completion = Math.max(1, accumulated.length() / 4);
                tokenCountEstimated = true;
            }
            int prompt = totalPromptTokens.get() == 0 ? prepared.promptTokens() : totalPromptTokens.get();
            String rawContent = accumulated.toString();
            // The emitted token stream is the lossless provider response. Do not
            // replace it with a structural heuristic at completion: prose-oriented
            // tail trimming can discard fenced code and made persistence disagree
            // with what the user saw while streaming.
            String finalContent = rawContent;
            ResponseCompletenessAnalyzer.Result analysis =
                    ResponseCompletenessAnalyzer.analyze(rawContent);
            FinishReasonClassifier.Classification classified = FinishReasonClassifier.classify(reason);
            boolean incomplete = !"complete".equals(completionStatus);
            boolean exhausted = incomplete && (segments >= continuationProps.maxSegments()
                    || totalCompletionTokens.get() >= continuationProps.maxTotalCompletionTokens());
            Message persisted = persistAssistant(userId, prepared, nameOf(activeModel), finalContent,
                    prompt, completion, completionStatus, activeProvider.id());
                    prompt, completion, completionStatus, currentProvider.id());
            Map<String, Object> payload = donePayload(nameOf(activeModel), prepared, prompt, completion, reason);
            payload.put("completionStatus", completionStatus);
            payload.put("finalContent", finalContent);
            payload.put("rawFinishReason", reason);
            payload.put("normalizedFinishReason", classified.normalized());
            payload.put("tailTrimmed", false);
            payload.put("repairAttempted", repairAttempted);
            payload.put("completionRepaired", completionRepaired);
            payload.put("repairSegments", repairSegments);
            payload.put("segments", segments);
            payload.put("continued", prepared.continuation() || segments > 1);
            payload.put("continuationExhausted", exhausted);
            payload.put("incomplete", incomplete);
            payload.put("tokenCountEstimated", tokenCountEstimated);
            payload.put("contentAnalysisReason", analysis.reason());
            payload.put("finalizationReason", operationalFinalizationReason(classified, completionStatus, exhausted));
            if (prepared.responsePlan() != null) {
                SemanticResponsePlanner.Plan plan = prepared.responsePlan();
                payload.put("hasRemainingContent", plan.hasRemainingContent());
                payload.put("segmentIndex", plan.segmentIndex());
                payload.put("totalSegments", plan.totalSegments());
                payload.put("completedSections", plan.completedSections());
                payload.put("remainingSections", plan.remainingSections());
            }
            log.info("Chat stream finalized requestId={} conversationId={} assistantMessageId={} provider={} model={} "
                            + "accumulatedLength={} finalContentLength={} completionEventContentLength={} "
                            + "persistedAssistantLength={} rawFinishReason={} normalizedFinishReason={} "
                            + "completionStatus={} segments={}",
                    requestId, prepared.conversationId(), persisted == null ? null : persisted.getId(), activeProvider.id(), activeModel,
                    requestId, prepared.conversationId(), persisted == null ? null : persisted.getId(), currentProvider.id(), activeModel,
                    rawContent.length(), finalContent.length(), finalContent.length(),
                    persisted == null || persisted.getContent() == null ? finalContent.length() : persisted.getContent().length(),
                    reason, classified.normalized(), completionStatus, segments);
            if (aborted) payload.put("aborted", true);
            send(emitter, "done", payload);
            emitter.complete();
        }

        private String normalizeReason(String reason) { return FinishReasonClassifier.classify(reason).normalized(); }

        private String operationalFinalizationReason(FinishReasonClassifier.Classification reason,
                                                     String status, boolean exhausted) {
            if ("aborted".equals(status)) return "cancelled";
            if ("partial".equals(status) && prepared.responsePlan() != null) return "PLANNED_SEGMENTATION";
            if (reason.kind() == FinishReasonClassifier.Kind.SAFETY) return "safety_or_refusal";
            if ("timeout".equals(reason.normalized())) return "timeout";
            if (repairAttempted && !completionRepaired && !"complete".equals(status)) return "repair_failed";
            if (reason.kind() == FinishReasonClassifier.Kind.CANCELLED_OR_ERROR) return "provider_error";
            if (exhausted && segments >= continuationProps.maxSegments()) return "max_segments";
            if (exhausted) return "total_token_budget";
            if (!continuationProps.enabled() && !"complete".equals(status)) return "continuation_disabled";
            return "complete".equals(status) ? (segments > 1 ? "complete" : "normal_stop") : "provider_error";
        }
    }

    // ------------------------------------------------------------- non-streaming

    public ChatResponse chat(String userId, ChatRequest req) {
        rateLimit.check(userId);
        RequestClassification classification = classifyAndEnforce(req);
        Prepared p = prepare(userId, req, classification, false);

        ChatResult result = null;
        String usedModel = null;
        Exception last = null;
        for (String modelId : p.chain()) {
            try {
                result = p.provider().chat(modelId, p.messages(), p.options());
                usedModel = nameOf(modelId);
                break;
            } catch (Exception e) {
                last = e;
                log.info("Model {} failed ({}); trying next", modelId, e.getMessage());
            }
        }
        if (result == null) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, friendly(last));
        }

        int promptTokens = result.promptTokens() > 0 ? result.promptTokens() : p.promptTokens();
        int completionTokens = result.completionTokens() > 0
                ? result.completionTokens() : Math.max(1, result.content().length() / 4);

        Message saved = persistAssistant(userId, p, usedModel, result.content(), promptTokens,
                completionTokens, null, p.provider().id());
        String registryId = p.scoredResult() != null ? p.scoredResult().registryId() : null;
        String pricingTier = p.scoredResult() != null ? p.scoredResult().pricingTier().name() : null;
        String topology = p.scoredResult() != null ? p.scoredResult().topology().name() : null;
        return new ChatResponse(p.conversationId(), usedModel, p.routed().category(), p.routed().reason(),
                MessageDto.from(saved), promptTokens, completionTokens, p.rag().citations(),
                registryId, pricingTier, topology);
    }

    // ----------------------------------------------------------------- helpers

    /**
     * Fail-closed policy boundary. This must run before prepare(), which persists
     * the prompt and performs RAG/provider selection. Classification metadata is
     * intentionally internal in Phase 1 to preserve REST and SSE response shapes.
     */
    private RequestClassification classifyAndEnforce(ChatRequest req) {
        validateImages(req.effectiveImages());
        RequestClassification classification = requestClassifier.classify(
                new RequestClassificationInput(
                        req.content(), req.modeOrDefault(), req.provider(), req.model(),
                        req.hasImage(), req.ragEnabled(), req.content().length()));
        ExecutionTarget target = "ollama".equals(req.providerId())
                ? ExecutionTarget.SERVER_SIDE_OLLAMA
                : ExecutionTarget.CLOUD_PROVIDER;
        privacyPolicy.requireAllowed(classification, target);
        log.debug("Request classified intent={} complexity={} freshness={} privacy={} capabilities={} "
                        + "confidence={} reasons={} policy=ALLOWED",
                classification.intent(), classification.complexity(), classification.freshness(),
                classification.privacy(), classification.requiredCapabilities(),
                classification.confidence(), classification.reasons());
        return classification;
    }

    private void validateImages(List<String> images) {
        if (images.size() > 8) throw ApiException.badRequest("Too many images");
        for (String image : images) {
            String lower = image.toLowerCase(java.util.Locale.ROOT);
            boolean allowed = lower.startsWith("data:image/png;base64,")
                    || lower.startsWith("data:image/jpeg;base64,")
                    || lower.startsWith("data:image/webp;base64,")
                    || lower.startsWith("data:image/gif;base64,")
                    || lower.startsWith("https://");
            if (!allowed) throw ApiException.badRequest("Unsupported image format");
        }
    }

    /** Shared setup: persist the user message, route, retrieve RAG, build the prompt. */
    private Prepared prepare(String userId, ChatRequest req, RequestClassification classification,
                             boolean semanticPlanning) {
        Conversation convo = conversations.getOrCreate(userId, req.conversationId(), req.modeOrDefault());
        String conversationId = convo.getId();
        String mode = convo.getMode();

        Message continuationTarget = null;
        if (req.continuation()) {
            if (req.targetAssistantMessageId() == null || req.targetAssistantMessageId().isBlank()) {
                throw ApiException.badRequest("Continuation target is required");
            }
            continuationTarget = conversations.requireOwnedAssistant(userId, conversationId,
                    req.targetAssistantMessageId());
        } else {
            conversations.addUserMessage(conversationId, req.content(), req.userMessageId(), req.model(),
                    req.provider(), req.effectiveImages(), req.attachments());
        }

        boolean useRag = req.ragEnabled() && documentService.hasReadyDocuments(userId);
        RagContext rag = useRag ? ragService.retrieve(userId, req.content()) : RagContext.empty();

        // Resolve the provider for THIS request — the unified picker can override
        // the server default (online vs offline) per message.
        LlmProvider provider = resolveProvider(req);
        boolean offline = "ollama".equals(provider.id());

        ScoredRoutingResult scoredResult = null;
        LlmProvider fallbackProvider = null;
        List<String> fallbackChain = List.of();
        Routed routed;
        if (offline) {
            routed = offlineRouter.resolve(req.model(), req.content(), mode, useRag, req.hasImage(),
                    activeModel.activeFor(userId));
        } else if (scoredRouter.appliesTo(req, provider)) {
            try {
                scoredResult = scoredRouter.resolve(classification, req, provider);
                routed = scoredResult.toRouted();
                if (scoredResult.provider() == com.privoraa.ai.registry.ModelProvider.GEMINI) {
                    provider = providers.byId("gemini");
                    if (isAuto(req.model())) {
                        try {
                            LlmProvider orProvider = providers.byId("openrouter");
                            if (orProvider != null) {
                                Routed fallbackRouted = resolveLegacy(req, mode, useRag);
                                fallbackProvider = orProvider;
                                fallbackChain = fallbackRouted.chain();
                            }
                        } catch (Exception e) {
                            log.debug("Could not register fallback provider", e);
                        }
                    }
                }
            } catch (ScoredRoutingException e) {
                scoredResult = null;
                routed = resolveLegacy(req, mode, useRag);
            }
        } else {
            routed = resolveLegacy(req, mode, useRag);
        }

        // The legacy router conflates Java vocabulary with CODING. Preserve its
        // model chain while taking the budget category from the richer intent.
        if (classification.intent() == com.privoraa.ai.classification.IntentType.LEARNING
                && !"learning".equals(routed.category())) {
            routed = new Routed(routed.modelId(), routed.modelName(), "learning",
                    "Learning request" + (classification.requiredCapabilities().contains(
                            com.privoraa.ai.classification.Capability.CODE) ? " with code examples" : ""),
                    routed.chain());
        }

        // Legacy Gemini special case — active only when scored routing is NOT in use.
        if (scoredResult == null && !offline && "code".equals(routed.category())
                && gemini.configured() && isAuto(req.model())) {
            provider = providers.byId("gemini");
            routed = new Routed(gemini.codeModel(), gemini.codeModel(), "code",
                    "Routed to Gemini for stronger coding",
                    java.util.stream.Stream.of(gemini.codeModel(), gemini.fallbackModel())
                            .filter(model -> model != null && !model.isBlank())
                            .filter(model -> !"gemini-2.0-flash".equals(model))
                            .distinct().toList());
            try {
                LlmProvider orProvider = providers.byId("openrouter");
                if (orProvider != null) {
                    Routed fallbackRouted = resolveLegacy(req, mode, useRag);
                    fallbackProvider = orProvider;
                    fallbackChain = fallbackRouted.chain();
                }
            } catch (Exception e) {
                log.debug("Could not register fallback provider", e);
            }
        }

        // Dry-run: log what scored routing would have chosen (no execution impact).
        if (scoredResult == null && !offline) {
            scoredRouter.dryRun(classification, req, provider, routed);
        }

        List<Message> history = conversations.messages(conversationId);
        if (continuationTarget != null) {
            String targetId = continuationTarget.getId();
            history = history.stream().filter(message -> !message.getId().equals(targetId)).toList();
        }
        List<String> requestImages = req.effectiveImages();
        List<Map<String, Object>> messages = requestImages.size() <= 1
                ? promptBuilder.build(mode, history, rag, requestImages.isEmpty() ? null : requestImages.getFirst())
                : promptBuilder.buildWithImages(mode, history, rag, requestImages);
        int promptTokens = promptBuilder.estimatePromptTokens(messages);

        // Config-driven output budgets — read from privoraa.chat.output.* properties.
        ChatOptions options = ChatOptions.forCategory(routed.category(), outputProps);
        String firstModel = routed.chain().getFirst();
        Integer ctx = catalog.find(firstModel).map(ModelDto::contextLength).orElse(null);
        if (ctx == null) ctx = findDescriptorContext(firstModel, scoredResult);
        Integer descriptorLimit = findDescriptorMaxOutput(firstModel, scoredResult);
        int configuredBudget = outputProps.budgetForCategory(routed.category());
        int safetyMargin = outputProps.safetyMargin();
        int unknownFallback = outputProps.unknownModelMaxTokens();
        options = options.withOutputClamp(configuredBudget, ctx, descriptorLimit, promptTokens, safetyMargin, unknownFallback);

        SemanticResponsePlanner.Plan responsePlan = continuationTarget == null
                ? (semanticPlanning ? responsePlanner.plan(req.content(), options.maxTokens()) : null)
                : responsePlanner.read(continuationTarget.getResponsePlanJson());
        if (responsePlan != null && continuationTarget != null) responsePlan = responsePlan.advance();
        if (responsePlan != null && continuationTarget == null) {
            messages = new ArrayList<>(messages);
            messages.add(1, Map.of("role", "system", "content",
                    responsePlanner.generationInstruction(responsePlan)));
            promptTokens = promptBuilder.estimatePromptTokens(messages);
            options = options.withOutputClamp(configuredBudget, ctx, descriptorLimit, promptTokens,
                    safetyMargin, unknownFallback);
        }

        if (log.isDebugEnabled()) {
            log.debug("Output budget: category={} configuredBudget={} contextWindow={} "
                            + "descriptorLimit={} promptTokens={} safetyMargin={} unknownFallback={} finalMaxTokens={} "
                            + "provider={} modelId={} tokenFieldName={} requestAttempt=1",
                    routed.category(), configuredBudget, ctx, descriptorLimit,
                    promptTokens, safetyMargin, unknownFallback, options.maxTokens(),
                    provider.id(), firstModel, tokenFieldName(provider.id()));
        }

        String existing = continuationTarget == null ? "" : continuationTarget.getContent();
        return new Prepared(conversationId, mode, routed, rag, messages, promptTokens,
                routed.chain(), provider, options, scoredResult, continuationTarget != null,
                continuationTarget == null ? null : continuationTarget.getId(), existing, responsePlan,
                fallbackProvider, fallbackChain);
                classification);
    }

    /** The provider for this request: the picker's choice, else the server default. */
    private LlmProvider resolveProvider(ChatRequest req) {
        String id = req.providerId();
        return id != null ? providers.byId(id) : providers.active();
    }

    private Message persistAssistant(String userId, Prepared p, String modelName, String content,
                                     int promptTokens, int completionTokens, String completionStatus) {
        return persistAssistant(userId, p, modelName, content, promptTokens, completionTokens, completionStatus,
                p.provider().id());
    }

    private Message persistAssistant(String userId, Prepared p, String modelName, String content,
                                     int promptTokens, int completionTokens, String completionStatus,
                                     String providerId) {
        String planJson = responsePlanner.write(p.responsePlan());
        if (p.continuation()) {
            if (planJson == null) {
                return conversations.updateAssistantMessage(userId, p.conversationId(), p.targetAssistantMessageId(),
                        content, modelName, p.routed().category(), p.routed().reason(), promptTokens,
                        completionTokens, completionStatus, providerId);
            }
            return conversations.updateAssistantMessage(userId, p.conversationId(), p.targetAssistantMessageId(),
                    content, modelName, p.routed().category(), p.routed().reason(), promptTokens,
                    completionTokens, completionStatus, providerId, planJson);
        }
        if (planJson == null) {
            return conversations.addAssistantMessage(p.conversationId(), content, modelName,
                    p.routed().category(), p.routed().reason(), promptTokens, completionTokens,
                    completionStatus, providerId);
        }
        return conversations.addAssistantMessage(p.conversationId(), content, modelName,
                p.routed().category(), p.routed().reason(), promptTokens, completionTokens,
                completionStatus, providerId, planJson);
    }

    private Map<String, Object> metaPayload(String modelName, Prepared p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("conversationId", p.conversationId());
        m.put("model", modelName);
        m.put("category", p.routed().category());
        m.put("reason", p.routed().reason());
        m.put("citations", p.rag().citations());
        if (p.scoredResult() != null) {
            m.put("registryId", p.scoredResult().registryId());
            m.put("pricingTier", p.scoredResult().pricingTier().name());
            m.put("topology", p.scoredResult().topology().name());
        }
        return m;
    }

    private Map<String, Object> donePayload(String modelName, Prepared p, int promptTokens, int completionTokens, String finishReason) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("model", modelName);
        m.put("promptTokens", promptTokens);
        m.put("completionTokens", completionTokens);
        m.put("citations", p.rag().citations());
        m.put("finishReason", finishReason);
        if (p.scoredResult() != null) {
            m.put("registryId", p.scoredResult().registryId());
            m.put("pricingTier", p.scoredResult().pricingTier().name());
            m.put("topology", p.scoredResult().topology().name());
        }
        return m;
    }

    private String nameOf(String modelId) {
        return catalog.find(modelId).map(com.privoraa.model.ModelDto::name).orElse(modelId);
    }

    private static String tokenFieldName(String provider) {
        return switch (provider) {
            case "gemini" -> "max_tokens";
            case "ollama" -> "options.num_predict";
            default -> "max_tokens";
        };
    }

    private static String normalizeRequestId(String supplied) {
        if (supplied != null && supplied.matches("[A-Za-z0-9._:-]{1,100}")) return supplied;
        return UUID.randomUUID().toString();
    }

    /** True when the user left the model picker on "auto" (no explicit model). */
    private static boolean isAuto(String model) {
        return model == null || model.isBlank() || "auto".equalsIgnoreCase(model);
    }

    private void send(SseEmitter emitter, String event, Object data) {
        try {
            emitter.send(SseEmitter.event().name(event).data(data, MediaType.APPLICATION_JSON));
        } catch (Exception e) {
            // A disconnected client (broken pipe / AsyncRequestNotUsableException) must
            // never surface as an ERROR — writing to a dead socket is expected and benign.
            log.debug("SSE send failed ({}): {}", event, e.getMessage());
        }
    }

    private String friendly(Throwable err) {
        if (err instanceof com.privoraa.ai.classification.PrivacyPolicyViolationException privacy) {
            return privacy.getMessage();
        }
        if (err instanceof ApiException api) {
            return api.getMessage();
        }
        if (com.privoraa.llm.OpenRouterClient.isRateLimited(err)) {
            return "The free AI models are rate-limited right now (OpenRouter free tier). "
                    + "Wait a minute and try again — adding a little credit to your OpenRouter "
                    + "account raises the daily limit substantially.";
        }
        return "That model is busy right now — please try again.";
    }

    /** Legacy routing path (non-scored). Does NOT apply the Gemini special case. */
    private Routed resolveLegacy(ChatRequest req, String mode, boolean useRag) {
        return req.hasImage()
                ? router.visionRoute(req.content())
                : router.resolve(req.model(), req.content(), mode, useRag);
    }

    /**
     * Look up the model's declared max output tokens from the registry. Uses the
     * scored result's registryId when available; otherwise searches by the
     * provider model ID across all descriptors.
     */
    private Integer findDescriptorMaxOutput(String modelId, ScoredRoutingResult scoredResult) {
        if (scoredResult != null) {
            return registry.find(scoredResult.registryId())
                    .map(ModelDescriptor::maxOutputTokens)
                    .orElse(null);
        }
        return registry.currentSnapshot().models().stream()
                .filter(m -> m.providerModelId().equals(modelId))
                .findFirst()
                .map(ModelDescriptor::maxOutputTokens)
                .orElse(null);
    }

    private Integer findDescriptorContext(String modelId, ScoredRoutingResult scoredResult) {
        if (scoredResult != null) {
            return registry.find(scoredResult.registryId())
                    .map(ModelDescriptor::contextWindow).orElse(null);
        }
        return registry.currentSnapshot().models().stream()
                .filter(m -> m.providerModelId().equals(modelId))
                .findFirst().map(ModelDescriptor::contextWindow).orElse(null);
    }

    /** Immutable bundle threaded through streaming/non-streaming paths. */
    private record Prepared(
            String conversationId,
            String mode,
            Routed routed,
            RagContext rag,
            List<Map<String, Object>> messages,
            int promptTokens,
            List<String> chain,
            LlmProvider provider,
            ChatOptions options,
            ScoredRoutingResult scoredResult,
            boolean continuation,
            String targetAssistantMessageId,
            String existingContent,
            SemanticResponsePlanner.Plan responsePlan,
            LlmProvider fallbackProvider,
            List<String> fallbackChain
            RequestClassification classification
    ) {}
}
