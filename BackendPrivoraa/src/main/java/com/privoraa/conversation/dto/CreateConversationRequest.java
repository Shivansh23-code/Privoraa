package com.privoraa.conversation.dto;

import jakarta.validation.constraints.Size;

public record CreateConversationRequest(
        @Size(max = 36) String id,
        @Size(max = 255) String title,
        @Size(max = 40) String mode
) {
    public CreateConversationRequest {
        // normalize empty to null so caller doesn't have to
        if (id != null && id.isBlank()) id = null;
        if (title != null && title.isBlank()) title = null;
        if (mode != null && mode.isBlank()) mode = null;
    }

    public CreateConversationRequest(String title, String mode) {
        this(null, title, mode);
    }
}
