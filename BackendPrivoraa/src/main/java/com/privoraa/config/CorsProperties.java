package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "privoraa.cors")
public record CorsProperties(
        List<String> origins
) {
    public CorsProperties {
        // Normalize: trim and strip trailing slashes. A browser's Origin header
        // never has a trailing slash, and Spring matches origins exactly — so a
        // configured "https://app.example.com/" would silently block every CORS
        // request (and the SPA would fall back to its demo engine). This makes the
        // config tolerant of that very common mistake.
        if (origins != null) {
            origins = origins.stream()
                    .filter(o -> o != null && !o.isBlank())
                    .map(o -> o.trim().replaceAll("/+$", ""))
                    .distinct()
                    .toList();
        }
    }
}
