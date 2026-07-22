package com.privoraa.chat.dto;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ChatContractCompatibilityTest {

    @Test
    void requestAndResponseRecordComponentsRemainStable() {
        assertEquals(List.of("conversationId", "model", "mode", "content", "useRag", "image", "provider",
                        "images", "userMessageId", "attachments", "isContinuation",
                        "targetAssistantMessageId", "existingContent"), componentNames(ChatRequest.class));
        assertEquals(List.of("conversationId", "model", "category", "reason", "message",
                        "promptTokens", "completionTokens", "citations",
                        "registryId", "pricingTier", "topology"),
                componentNames(ChatResponse.class));
    }

    @Test
    void providerAliasesRemainCompatible() {
        ChatRequest online = new ChatRequest(null, "auto", "general", "hello", false, null, "online");
        ChatRequest offline = new ChatRequest(null, "auto", "general", "hello", false, null, "offline");
        assertEquals("openrouter", online.providerId());
        assertEquals("ollama", offline.providerId());
    }

    private List<String> componentNames(Class<?> type) {
        return Arrays.stream(type.getRecordComponents()).map(c -> c.getName()).toList();
    }
}
