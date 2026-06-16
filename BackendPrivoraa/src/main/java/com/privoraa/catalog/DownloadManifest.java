package com.privoraa.catalog;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.Map;

/**
 * {@code model-downloads.json} — maps a catalog model tag to its self-hosted
 * GGUF build (object path, size, checksum, quantization).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DownloadManifest(Map<String, Build> builds) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Build(
            String objectKey,
            long sizeBytes,
            String sha256,
            String quant
    ) {}
}
