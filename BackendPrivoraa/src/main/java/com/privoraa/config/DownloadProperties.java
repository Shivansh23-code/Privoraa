package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Where the self-hosted GGUF model files are served from, and how download URLs
 * are minted. {@code provider}:
 * <ul>
 *   <li>{@code none}   — downloads not configured (default); the endpoint returns
 *       a clean 503 so the rest of the app is unaffected.</li>
 *   <li>{@code public} — files live behind a public CDN / R2 custom domain;
 *       the URL is {@code publicBaseUrl + "/" + objectKey} (R2 has free egress).</li>
 *   <li>{@code s3}     — private bucket; a short-lived SigV4 presigned GET URL is
 *       minted per request (works with Cloudflare R2's S3-compatible API).</li>
 * </ul>
 */
@ConfigurationProperties(prefix = "privoraa.downloads")
public record DownloadProperties(
        String provider,
        String publicBaseUrl,
        String endpoint,
        String region,
        String bucket,
        String accessKey,
        String secretKey,
        Integer urlTtlSeconds
) {
    public DownloadProperties {
        if (provider == null || provider.isBlank()) {
            provider = "none";
        }
        provider = provider.trim().toLowerCase();
        if (region == null || region.isBlank()) {
            region = "auto"; // Cloudflare R2's region token
        }
        if (urlTtlSeconds == null || urlTtlSeconds <= 0) {
            urlTtlSeconds = 900; // 15 minutes
        }
    }

    public boolean enabled() {
        return !"none".equals(provider);
    }
}
