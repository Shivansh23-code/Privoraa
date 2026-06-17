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
        String image,
        // Which backend to run on for THIS request, independent of the server's
        // default: "online"/"openrouter", "offline"/"ollama", or null/"auto" to use
        // the server's active provider. Lets the unified picker choose per message.
        String provider
) {
    public String modeOrDefault() {
        return mode == null || mode.isBlank() ? "general" : mode;
    }

    /** Normalized provider id ("ollama" | "openrouter") or null to use the default. */
    public String providerId() {
        if (provider == null || provider.isBlank()) {
            return null;
        }
        return switch (provider.trim().toLowerCase()) {
            case "offline", "ollama", "local" -> "ollama";
            case "online", "openrouter", "cloud" -> "openrouter";
            default -> null;
        };
    }

    public boolean ragEnabled() {
        return Boolean.TRUE.equals(useRag);
    }

    public boolean hasImage() {
        return image != null && !image.isBlank();
    }
}
