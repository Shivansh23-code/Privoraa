package com.privoraa.chat;

import com.privoraa.ai.classification.ExecutionTarget;
import com.privoraa.ai.classification.PrivacyPolicyEvaluator;
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
import com.privoraa.ai.registry.ModelRegistry;
import com.privoraa.config.ChatOutputProperties;
import com.privoraa.config.GeminiProperties;
import com.privoraa.llm.ChatOptions;
import com.privoraa.llm.ChatResult;
import com.privoraa.llm.LlmProvider;
import com.privoraa.llm.LlmProviderResolver;
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
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.scheduler.Schedulers;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
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

    public ChatService(RateLimitService rateLimit, ConversationService conversations, ModelRouter router,
                       OfflineRouter offlineRouter, RagService ragService, DocumentService documentService,
                       PromptBuilder promptBuilder, LlmProviderResolver providers, ActiveModelService activeModel,
                       ModelCatalogService catalog, GeminiProperties gemini, RequestClassifier requestClassifier,
                       PrivacyPolicyEvaluator privacyPolicy, ScoredRouter scoredRouter,
                       ChatOutputProperties outputProps, ModelRegistry registry) {
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
    }

    // ----------------------------------------------------------------- streaming

    public SseEmitter stream(String userId, ChatRequest req) {
        SseEmitter emitter = new SseEmitter(0L); // no timeout; completes on done/error

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
            p = prepare(userId, req, classification);
        } catch (Exception e) {
            send(emitter, "error", Map.of("message", friendly(e)));
            emitter.complete();
            return emitter;
        }

        attempt(emitter, p, 0, new StringBuilder());
        return emitter;
    }

    private void attempt(SseEmitter emitter, Prepared p, int idx, StringBuilder sb) {
        String modelId = p.chain().get(idx);
        String modelName = nameOf(modelId);

        send(emitter, "meta", metaPayload(modelName, p));

        AtomicBoolean emitted = new AtomicBoolean(false);
        AtomicBoolean terminalReceived = new AtomicBoolean(false);
        AtomicReference<String> finishReason = new AtomicReference<>(null);
        p.provider().streamChat(modelId, p.messages(), p.options())
                .subscribeOn(Schedulers.boundedElastic())
                .subscribe(
                        event -> {
                            if (event.terminal()) {
                                terminalReceived.set(true);
                                if (event.finishReason() != null) {
                                    finishReason.set(event.finishReason());
                                }
                            } else if (event.delta() != null) {
                                emitted.set(true);
                                sb.append(event.delta());
                                send(emitter, "token", Map.of("delta", event.delta()));
                            }
                        },
                        err -> {
                            if (!emitted.get() && idx + 1 < p.chain().size()) {
                                log.warn("Model {} failed before output; falling back", modelId, err);
                                attempt(emitter, p, idx + 1, sb);
                            } else {
                                log.warn("Model {} failed; no more fallbacks", modelId, err);
                                send(emitter, "error", Map.of("message", friendly(err)));
                                emitter.complete();
                            }
                        },
                        () -> {
                            String content = sb.toString();
                            int completionTokens = Math.max(1, content.length() / 4);
                            String reason;
                            if (terminalReceived.get()) {
                                // Terminal event seen — use its reason if present, else "unknown".
                                reason = finishReason.get() != null ? finishReason.get() : "unknown";
                            } else {
                                // Flux completed without any terminal event from the provider.
                                reason = emitted.get() ? "incomplete" : "unknown";
                            }
                            persistAssistant(p, modelName, content, p.promptTokens(), completionTokens);
                            send(emitter, "done", donePayload(modelName, p, p.promptTokens(), completionTokens, reason));
                            emitter.complete();
                        });
    }

    // ------------------------------------------------------------- non-streaming

    public ChatResponse chat(String userId, ChatRequest req) {
        rateLimit.check(userId);
        RequestClassification classification = classifyAndEnforce(req);
        Prepared p = prepare(userId, req, classification);

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

        Message saved = persistAssistant(p, usedModel, result.content(), promptTokens, completionTokens);
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

    /** Shared setup: persist the user message, route, retrieve RAG, build the prompt. */
    private Prepared prepare(String userId, ChatRequest req, RequestClassification classification) {
        Conversation convo = conversations.getOrCreate(userId, req.conversationId(), req.modeOrDefault());
        String conversationId = convo.getId();
        String mode = convo.getMode();

        conversations.addUserMessage(conversationId, req.content());

        boolean useRag = req.ragEnabled() && documentService.hasReadyDocuments(userId);
        RagContext rag = useRag ? ragService.retrieve(userId, req.content()) : RagContext.empty();

        // Resolve the provider for THIS request — the unified picker can override
        // the server default (online vs offline) per message.
        LlmProvider provider = resolveProvider(req);
        boolean offline = "ollama".equals(provider.id());

        ScoredRoutingResult scoredResult = null;
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
                }
            } catch (ScoredRoutingException e) {
                scoredResult = null;
                routed = resolveLegacy(req, mode, useRag);
            }
        } else {
            routed = resolveLegacy(req, mode, useRag);
        }

        // Legacy Gemini special case — active only when scored routing is NOT in use.
        if (scoredResult == null && !offline && "code".equals(routed.category())
                && gemini.configured() && isAuto(req.model())) {
            provider = providers.byId("gemini");
            routed = new Routed(gemini.codeModel(), gemini.codeModel(), "code",
                    "Routed to Gemini for stronger coding",
                    List.of(gemini.codeModel(), gemini.fallbackModel()));
        }

        // Dry-run: log what scored routing would have chosen (no execution impact).
        if (scoredResult == null && !offline) {
            scoredRouter.dryRun(classification, req, provider, routed);
        }

        List<Message> history = conversations.messages(conversationId);
        List<Map<String, Object>> messages = promptBuilder.build(
                mode, history, rag, req.hasImage() ? req.image() : null);
        int promptTokens = promptBuilder.estimatePromptTokens(messages);

        // Config-driven output budgets — read from privoraa.chat.output.* properties.
        ChatOptions options = ChatOptions.forCategory(routed.category(), outputProps);
        String firstModel = routed.chain().getFirst();
        Integer ctx = catalog.find(firstModel).map(ModelDto::contextLength).orElse(null);
        Integer descriptorLimit = findDescriptorMaxOutput(firstModel, scoredResult);
        int configuredBudget = outputProps.budgetForCategory(routed.category());
        int safetyMargin = outputProps.safetyMargin();
        int unknownFallback = outputProps.unknownModelMaxTokens();
        options = options.withOutputClamp(configuredBudget, ctx, descriptorLimit, promptTokens, safetyMargin, unknownFallback);

        if (log.isDebugEnabled()) {
            log.debug("Output budget: category={} configuredBudget={} modelContext={} "
                            + "descriptorLimit={} promptTokens={} safetyMargin={} unknownFallback={} finalMaxTokens={} "
                            + "provider={} modelId={}",
                    routed.category(), configuredBudget, ctx, descriptorLimit,
                    promptTokens, safetyMargin, unknownFallback, options.maxTokens(),
                    provider.id(), firstModel);
        }

        return new Prepared(conversationId, mode, routed, rag, messages, promptTokens,
                routed.chain(), provider, options, scoredResult);
    }

    /** The provider for this request: the picker's choice, else the server default. */
    private LlmProvider resolveProvider(ChatRequest req) {
        String id = req.providerId();
        return id != null ? providers.byId(id) : providers.active();
    }

    private Message persistAssistant(Prepared p, String modelName, String content,
                                     int promptTokens, int completionTokens) {
        return conversations.addAssistantMessage(p.conversationId(), content, modelName,
                p.routed().category(), p.routed().reason(), promptTokens, completionTokens);
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
            ScoredRoutingResult scoredResult
    ) {}
}
