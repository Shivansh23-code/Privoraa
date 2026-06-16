package com.privoraa.catalog;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.privoraa.common.ApiException;
import com.privoraa.config.DownloadProperties;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.time.Instant;
import java.util.Map;

/**
 * Resolves a plan-entitled download URL for a self-hosted GGUF model build.
 * Enforces the subscription gate, then mints a URL per the configured storage
 * provider (public CDN or presigned S3/R2). Defaults to a clean 503 when
 * downloads aren't configured, so it never breaks an otherwise-healthy deploy.
 */
@Service
public class ModelDownloadService {

    private final DownloadProperties props;
    private final EntitlementService entitlements;
    private final DownloadManifest manifest;

    public ModelDownloadService(DownloadProperties props, EntitlementService entitlements,
                                ObjectMapper mapper) {
        this.props = props;
        this.entitlements = entitlements;
        this.manifest = load(mapper);
    }

    private DownloadManifest load(ObjectMapper mapper) {
        try (InputStream in = new ClassPathResource("model-downloads.json").getInputStream()) {
            return mapper.readValue(in, DownloadManifest.class);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load model-downloads.json", e);
        }
    }

    /** Whether a build exists for this tag (used by the public showcase). */
    public boolean hasBuild(String tag) {
        return lookup(tag) != null;
    }

    /**
     * Resolve a download for {@code userId}. Throws 403 (upgrade required),
     * 404 (no build), or 503 (downloads not enabled / misconfigured).
     */
    public DownloadInfo resolve(String userId, String tag) {
        DownloadManifest.Build build = lookup(tag);
        if (build == null) {
            throw ApiException.notFound("No downloadable build for '" + tag + "'.");
        }
        if (!entitlements.canDownload(userId, tag)) {
            throw ApiException.forbidden(
                    "This model needs the " + entitlements.requiredFor(tag).label() + " plan.");
        }
        if (!props.enabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Offline model downloads aren't enabled yet.");
        }

        String plan = entitlements.requiredFor(tag).name().toLowerCase();
        return switch (props.provider()) {
            case "public" -> publicUrl(tag, build, plan);
            case "s3" -> presignedUrl(tag, build, plan);
            default -> throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Unknown download provider '" + props.provider() + "'.");
        };
    }

    private DownloadInfo publicUrl(String tag, DownloadManifest.Build build, String plan) {
        if (props.publicBaseUrl() == null || props.publicBaseUrl().isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Download CDN base URL is not configured.");
        }
        String url = props.publicBaseUrl().replaceAll("/+$", "") + "/" + build.objectKey();
        return new DownloadInfo(tag, url, build.sizeBytes(), build.sha256(), build.quant(),
                plan, 0, "public");
    }

    private DownloadInfo presignedUrl(String tag, DownloadManifest.Build build, String plan) {
        if (isBlank(props.endpoint()) || isBlank(props.bucket())
                || isBlank(props.accessKey()) || isBlank(props.secretKey())) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Download storage credentials are not configured.");
        }
        String url = S3Presigner.presignGet(props.endpoint(), props.region(), props.bucket(),
                build.objectKey(), props.accessKey(), props.secretKey(),
                props.urlTtlSeconds(), Instant.now());
        return new DownloadInfo(tag, url, build.sizeBytes(), build.sha256(), build.quant(),
                plan, props.urlTtlSeconds(), "s3");
    }

    /** Exact match, then tolerate a trailing ":latest". */
    private DownloadManifest.Build lookup(String tag) {
        if (tag == null || manifest.builds() == null) return null;
        Map<String, DownloadManifest.Build> builds = manifest.builds();
        DownloadManifest.Build b = builds.get(tag);
        if (b == null && tag.endsWith(":latest")) {
            b = builds.get(tag.substring(0, tag.length() - ":latest".length()));
        }
        return b;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
