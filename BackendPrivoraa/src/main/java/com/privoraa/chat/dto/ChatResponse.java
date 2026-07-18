package com.privoraa.chat.dto;

import com.privoraa.conversation.dto.MessageDto;
import com.privoraa.rag.Citation;

import java.util.List;

public record ChatResponse(
        String conversationId,
        String model,
        String category,
        String reason,
        MessageDto message,
        int promptTokens,
        int completionTokens,
        List<Citation> citations,
        // Phase 3 additive — null when scored routing is inactive
        String registryId,
        String pricingTier,
        String topology
) {
    public ChatResponse(String conversationId, String model, String category, String reason,
                        MessageDto message, int promptTokens, int completionTokens,
                        List<Citation> citations) {
        this(conversationId, model, category, reason, message, promptTokens, completionTokens,
                citations, null, null, null);
    }
}
