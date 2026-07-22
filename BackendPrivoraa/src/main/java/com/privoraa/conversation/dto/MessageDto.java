package com.privoraa.conversation.dto;

import com.privoraa.conversation.Message;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record MessageDto(
        String id,
        String role,
        String content,
        String model,
        String category,
        String routeReason,
        int promptTokens,
        int completionTokens,
        String completionStatus,
        Instant createdAt,
        String selectedProvider,
        List<String> images,
        List<Map<String, Object>> attachments,
        Map<String, Object> responsePlan
) {
    private static final ObjectMapper JSON = new ObjectMapper();
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
                m.getCompletionStatus(),
                m.getCreatedAt(), m.getSelectedProvider(), read(m.getImagesJson(), new TypeReference<List<String>>() {}),
                read(m.getAttachmentsJson(), new TypeReference<List<Map<String, Object>>>() {}),
                read(m.getResponsePlanJson(), new TypeReference<Map<String, Object>>() {}));
    }

    private static <T> T read(String json, TypeReference<T> type) {
        if (json == null || json.isBlank()) return null;
        try { return JSON.readValue(json, type); } catch (Exception ignored) { return null; }
    }
}
