package com.privoraa.model;

public record ModelDto(
        String id,
        String name,
        String shortName,
        String description,
        String category,
        Integer contextLength,
        boolean isFree
) {}
