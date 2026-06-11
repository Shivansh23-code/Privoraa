package com.privoraa.conversation.dto;

import com.privoraa.conversation.Message;

import java.time.Instant;

public record MessageDto(
        String id,
        String role,
        String content,
        String model,
        String category,
        String routeReason,
        int promptTokens,
        int completionTokens,
        Instant createdAt
) {
    public static MessageDto from(Message m) {
        return new MessageDto(
                m.getId(),
                m.getRole().name().toLowerCase(),
                m.getContent(),
                m.getModelUsed(),
                m.getCategory(),
                m.getRouteReason(),
                m.getPromptTokens(),
                m.getCompletionTokens(),
                m.getCreatedAt());
    }
}
