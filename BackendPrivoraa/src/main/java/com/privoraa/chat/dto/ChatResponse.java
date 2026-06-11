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
        List<Citation> citations
) {}
