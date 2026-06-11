package com.privoraa.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChatRequest(
        String conversationId,
        String model,
        String mode,
        @NotBlank @Size(max = 16000) String content,
        Boolean useRag
) {
    public String modeOrDefault() {
        return mode == null || mode.isBlank() ? "general" : mode;
    }

    public boolean ragEnabled() {
        return Boolean.TRUE.equals(useRag);
    }
}
