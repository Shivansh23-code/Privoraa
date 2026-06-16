package com.privoraa.catalog;

/**
 * A resolved, entitlement-checked download for a model build. {@code url} is either
 * a public CDN URL (no expiry, {@code expiresInSeconds == 0}) or a short-lived
 * presigned URL. {@code sha256} (when set) lets the client verify the file.
 */
public record DownloadInfo(
        String tag,
        String url,
        long sizeBytes,
        String sha256,
        String quant,
        String plan,
        int expiresInSeconds,
        String provider
) {}
