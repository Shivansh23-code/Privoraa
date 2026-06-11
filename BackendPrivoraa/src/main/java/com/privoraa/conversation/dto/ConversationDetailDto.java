package com.privoraa.conversation.dto;

import com.privoraa.conversation.Conversation;
import com.privoraa.conversation.Message;

import java.time.Instant;
import java.util.List;

public record ConversationDetailDto(
        String id,
        String title,
        String mode,
        boolean pinned,
        Instant createdAt,
        Instant updatedAt,
        List<MessageDto> messages
) {
    public static ConversationDetailDto from(Conversation c, List<Message> messages) {
        return new ConversationDetailDto(
                c.getId(),
                c.getTitle(),
                c.getMode(),
                c.isPinned(),
                c.getCreatedAt(),
                c.getUpdatedAt(),
                messages.stream().map(MessageDto::from).toList());
    }
}
