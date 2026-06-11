package com.privoraa.conversation.dto;

import com.privoraa.conversation.Conversation;

import java.time.Instant;

public record ConversationDto(
        String id,
        String title,
        String mode,
        boolean pinned,
        Instant createdAt,
        Instant updatedAt
) {
    public static ConversationDto from(Conversation c) {
        return new ConversationDto(
                c.getId(),
                c.getTitle(),
                c.getMode(),
                c.isPinned(),
                c.getCreatedAt(),
                c.getUpdatedAt());
    }
}
