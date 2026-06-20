package com.privoraa.chat;

import com.privoraa.chat.dto.ChatRequest;
import com.privoraa.chat.dto.ChatResponse;
import com.privoraa.common.ApiException;
import com.privoraa.common.RateLimitException;
import com.privoraa.conversation.Conversation;
import com.privoraa.conversation.ConversationService;
import com.privoraa.conversation.Message;
import com.privoraa.conversation.dto.MessageDto;
import com.privoraa.catalog.ActiveModelService;
import com.privoraa.config.GeminiProperties;
import com.privoraa.llm.ChatOptions;
import com.privoraa.llm.ChatResult;
import com.privoraa.llm.LlmProvider;
import com.privoraa.llm.LlmProviderResolver;
import com.privoraa.model.ModelCatalogService;
import com.privoraa.ratelimit.RateLimitService;
import com.privoraa.rag.RagContext;
import com.privoraa.rag.RagService;
import com.privoraa.rag.DocumentService;
import com.privoraa.routing.ModelRouter;
import com.privoraa.routing.OfflineRouter;
import com.privoraa.routing.Routed;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.scheduler.Schedulers;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

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

    public ChatService(RateLimitService rateLimit, ConversationService conversations, ModelRouter router,
                       OfflineRouter offlineRouter, RagService ragService, DocumentService documentService,
                       PromptBuilder promptBuilder, LlmProviderResolver providers, ActiveModelService activeModel,
                       ModelCatalogService catalog, GeminiProperties gemini) {
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
            p = prepare(userId, req);
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
        p.provider().streamChat(modelId, p.messages(), p.options())
                .subscribeOn(Schedulers.boundedElastic())
                .subscribe(
                        delta -> {
                            emitted.set(true);
                            sb.append(delta);
                            send(emitter, "token", Map.of("delta", delta));
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
                            persistAssistant(p, modelName, content, p.promptTokens(), completionTokens);
                            send(emitter, "done", donePayload(modelName, p, p.promptTokens(), completionTokens));
                            emitter.complete();
                        });
    }

    // ------------------------------------------------------------- non-streaming

    public ChatResponse chat(String userId, ChatRequest req) {
        rateLimit.check(userId);
        Prepared p = prepare(userId, req);

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
        return new ChatResponse(p.conversationId(), usedModel, p.routed().category(), p.routed().reason(),
                MessageDto.from(saved), promptTokens, completionTokens, p.rag().citations());
    }

    // ----------------------------------------------------------------- helpers

    /** Shared setup: persist the user message, route, retrieve RAG, build the prompt. */
    private Prepared prepare(String userId, ChatRequest req) {
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

        // Route per provider. Offline: "Auto" picks the best INSTALLED local model
        // for the prompt (or honors an explicit local tag), and images go to a local
        // vision model. Online: the health-aware cloud chain / vision chain.
        Routed routed = offline
                ? offlineRouter.resolve(req.model(), req.content(), mode, useRag, req.hasImage(),
                        activeModel.activeFor(userId))
                : (req.hasImage()
                        ? router.visionRoute(req.content())
                        : router.resolve(req.model(), req.content(), mode, useRag));

        // Free coding upgrade: send "auto" online coding requests to Gemini — a far
        // stronger free coder than the OpenRouter free tier — when a key is set.
        // Offline/local requests stay local (privacy); an explicit model pick wins.
        if (!offline && "code".equals(routed.category()) && gemini.configured() && isAuto(req.model())) {
            provider = providers.byId("gemini");
            routed = new Routed(gemini.codeModel(), gemini.codeModel(), "code",
                    "Routed to Gemini for stronger coding",
                    List.of(gemini.codeModel(), gemini.fallbackModel()));
        }

        List<Message> history = conversations.messages(conversationId);
        List<Map<String, Object>> messages = promptBuilder.build(
                mode, history, rag, req.hasImage() ? req.image() : null);
        int promptTokens = promptBuilder.estimatePromptTokens(messages);

        // Task-aware sampling: e.g. low temperature for code/math, a touch warmer
        // for open-ended chat — tuned off the routed category.
        ChatOptions options = ChatOptions.forCategory(routed.category());

        return new Prepared(conversationId, mode, routed, rag, messages, promptTokens,
                routed.chain(), provider, options);
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
        return m;
    }

    private Map<String, Object> donePayload(String modelName, Prepared p, int promptTokens, int completionTokens) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("model", modelName);
        m.put("promptTokens", promptTokens);
        m.put("completionTokens", completionTokens);
        m.put("citations", p.rag().citations());
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
        } catch (IOException | IllegalStateException e) {
            // Client disconnected or emitter already completed.
            log.debug("SSE send failed ({}): {}", event, e.getMessage());
        }
    }

    private String friendly(Throwable err) {
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
            ChatOptions options
    ) {}
}
