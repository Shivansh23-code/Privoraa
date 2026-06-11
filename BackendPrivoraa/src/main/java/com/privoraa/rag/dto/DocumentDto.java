package com.privoraa.rag.dto;

import com.privoraa.rag.Document;

import java.time.Instant;

public record DocumentDto(
        String id,
        String filename,
        String status,
        int chunkCount,
        String errorMessage,
        Instant createdAt
) {
    public static DocumentDto from(Document d) {
        return new DocumentDto(
                d.getId(),
                d.getFilename(),
                d.getStatus().name(),
                d.getChunkCount(),
                d.getErrorMessage(),
                d.getCreatedAt());
    }
}
