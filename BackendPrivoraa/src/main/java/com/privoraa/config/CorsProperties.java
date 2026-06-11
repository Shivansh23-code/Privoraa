package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "privoraa.cors")
public record CorsProperties(
        List<String> origins
) {}
