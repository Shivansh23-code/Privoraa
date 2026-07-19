package com.privoraa.chat;

import com.privoraa.ai.classification.PrivacyPolicyEvaluator;
import com.privoraa.ai.classification.PrivacyPolicyViolationException;
import com.privoraa.ai.classification.RequestClassifier;
import com.privoraa.ai.registry.ModelRegistry;
import com.privoraa.catalog.ActiveModelService;
import com.privoraa.chat.dto.ChatRequest;
import com.privoraa.config.ChatOutputProperties;
import com.privoraa.config.ChatContinuationProperties;
import com.privoraa.config.GeminiProperties;
import com.privoraa.conversation.ConversationService;
import com.privoraa.llm.LlmProviderResolver;
import com.privoraa.model.ModelCatalogService;
import com.privoraa.rag.DocumentService;
import com.privoraa.rag.RagService;
import com.privoraa.ratelimit.RateLimitService;
import com.privoraa.routing.IntentClassifier;
import com.privoraa.routing.ModelRouter;
import com.privoraa.routing.OfflineRouter;
import com.privoraa.routing.ScoredRouter;
import org.junit.jupiter.api.Test;
import static org.mockito.ArgumentMatchers.any;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class ChatPrivacyBoundaryTest {

    @Test
    void blockedRequestStopsBeforePersistenceRagAndProviderSelection() {
        RateLimitService rateLimit = mock(RateLimitService.class);
        ConversationService conversations = mock(ConversationService.class);
        RagService rag = mock(RagService.class);
        DocumentService documents = mock(DocumentService.class);
        LlmProviderResolver providers = mock(LlmProviderResolver.class);

        ChatService service = new ChatService(
                rateLimit,
                conversations,
                mock(ModelRouter.class),
                mock(OfflineRouter.class),
                rag,
                documents,
                mock(PromptBuilder.class),
                providers,
                mock(ActiveModelService.class),
                mock(ModelCatalogService.class),
                mock(GeminiProperties.class),
                new RequestClassifier(new IntentClassifier()),
                new PrivacyPolicyEvaluator(),
                mock(ScoredRouter.class),
                new ChatOutputProperties(0, 0, 0, 0, 0, 0, 0, 0, 0),
                mock(ModelRegistry.class),
                new ChatContinuationProperties(true, 3, 24000, 600),
                new com.privoraa.config.ChatCompletionRepairProperties(true, 1, 512));

        ChatRequest request = new ChatRequest(null, "auto", "general",
                "Do not send this to the cloud", false, null, "openrouter");

        assertThrows(PrivacyPolicyViolationException.class, () -> service.chat("user-1", request));
        verifyNoInteractions(conversations, rag, documents, providers);
    }
}
