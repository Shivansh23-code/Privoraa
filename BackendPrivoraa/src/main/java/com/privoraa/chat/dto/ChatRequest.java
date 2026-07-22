package com.privoraa.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

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
        String provider,
        // Additive multi-image transport. Legacy clients may continue sending image.
        @Size(max = 8) List<@Size(max = 14_000_000) String> images,
        String userMessageId,
        @Size(max = 12) List<Map<String, Object>> attachments,
        Boolean isContinuation,
        String targetAssistantMessageId,
        @Size(max = 200_000) String existingContent
) {
    public ChatRequest(String conversationId, String model, String mode, String content,
                       Boolean useRag, String image, String provider) {
        this(conversationId, model, mode, content, useRag, image, provider,
                null, null, null, null, null, null);
    }
    public ChatRequest(String conversationId, String model, String mode, String content,
                       Boolean useRag, String image, String provider, List<String> images,
                       String userMessageId, List<Map<String, Object>> attachments) {
        this(conversationId, model, mode, content, useRag, image, provider,
                images, userMessageId, attachments, null, null, null);
    }
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

    public boolean continuation() {
        return Boolean.TRUE.equals(isContinuation);
    }

    public boolean hasImage() {
        return !effectiveImages().isEmpty();
    }

    public List<String> effectiveImages() {
        if (images != null && !images.isEmpty()) {
            return images.stream().filter(value -> value != null && !value.isBlank()).limit(8).toList();
        }
        return image == null || image.isBlank() ? List.of() : List.of(image);
    }
}
