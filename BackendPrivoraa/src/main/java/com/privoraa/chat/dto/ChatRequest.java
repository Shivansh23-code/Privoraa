package com.privoraa.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChatRequest(
        String conversationId,
        String model,
        String mode,
        @NotBlank @Size(max = 16000) String content,
        Boolean useRag,
        // Optional image for vision: a data URL ("data:image/png;base64,...") or a
        // plain https image URL. When present, the request is routed to a vision model.
        String image
) {
    public String modeOrDefault() {
        return mode == null || mode.isBlank() ? "general" : mode;
    }

    public boolean ragEnabled() {
        return Boolean.TRUE.equals(useRag);
    }

    public boolean hasImage() {
        return image != null && !image.isBlank();
    }
}
