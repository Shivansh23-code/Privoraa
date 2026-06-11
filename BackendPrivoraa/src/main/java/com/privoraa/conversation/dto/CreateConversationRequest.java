package com.privoraa.conversation.dto;

import jakarta.validation.constraints.Size;

public record CreateConversationRequest(
        @Size(max = 255) String title,
        @Size(max = 40) String mode
) {}
