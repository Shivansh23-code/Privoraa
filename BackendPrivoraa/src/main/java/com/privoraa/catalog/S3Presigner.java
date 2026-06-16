package com.privoraa.catalog;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Minimal AWS Signature V4 query presigner for S3-compatible object storage
 * (Cloudflare R2, Backblaze B2, MinIO, AWS S3). Produces a time-limited
 * presigned GET URL using only the JDK — no AWS SDK dependency.
 *
 * <p>Path-style addressing ({@code endpoint/bucket/key}) is used so it works with
 * R2 endpoints without per-bucket DNS. Payload is {@code UNSIGNED-PAYLOAD}, which
 * is correct for a download GET.
 */
final class S3Presigner {

    private static final DateTimeFormatter AMZ_DATE =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'", Locale.US).withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter DATE_STAMP =
            DateTimeFormatter.ofPattern("yyyyMMdd", Locale.US).withZone(ZoneOffset.UTC);

    private S3Presigner() {}

    /** Build a presigned GET URL valid for {@code ttlSeconds} from {@code now}. */
    static String presignGet(String endpoint, String region, String bucket, String objectKey,
                             String accessKey, String secretKey, int ttlSeconds, Instant now) {
        String host = hostOf(endpoint);
        String amzDate = AMZ_DATE.format(now);
        String dateStamp = DATE_STAMP.format(now);
        String scope = dateStamp + "/" + region + "/s3/aws4_request";

        // Canonical URI: /bucket/key with each path segment RFC3986-encoded (slashes kept).
        String canonicalUri = "/" + uriEncode(bucket, false) + "/" + uriEncode(objectKey, false);

        // Canonical query string: the presign params, sorted, fully encoded.
        String canonicalQuery = String.join("&",
                "X-Amz-Algorithm=AWS4-HMAC-SHA256",
                "X-Amz-Credential=" + uriEncode(accessKey + "/" + scope, true),
                "X-Amz-Date=" + amzDate,
                "X-Amz-Expires=" + ttlSeconds,
                "X-Amz-SignedHeaders=host");

        String canonicalHeaders = "host:" + host + "\n";
        String signedHeaders = "host";

        String canonicalRequest = String.join("\n",
                "GET", canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD");

        String stringToSign = String.join("\n",
                "AWS4-HMAC-SHA256", amzDate, scope, hex(sha256(canonicalRequest)));

        byte[] signingKey = signingKey(secretKey, dateStamp, region, "s3");
        String signature = hex(hmac(signingKey, stringToSign));

        return endpoint.replaceAll("/+$", "") + canonicalUri + "?" + canonicalQuery
                + "&X-Amz-Signature=" + signature;
    }

    private static byte[] signingKey(String secret, String dateStamp, String region, String service) {
        byte[] k = ("AWS4" + secret).getBytes(StandardCharsets.UTF_8);
        k = hmac(k, dateStamp);
        k = hmac(k, region);
        k = hmac(k, service);
        return hmac(k, "aws4_request");
    }

    private static String hostOf(String endpoint) {
        String h = endpoint.replaceFirst("^https?://", "");
        int slash = h.indexOf('/');
        return slash >= 0 ? h.substring(0, slash) : h;
    }

    /** RFC3986 encoding per AWS rules; unreserved chars pass through, '/' optionally kept. */
    static String uriEncode(String input, boolean encodeSlash) {
        StringBuilder out = new StringBuilder();
        for (byte b : input.getBytes(StandardCharsets.UTF_8)) {
            char c = (char) (b & 0xFF);
            boolean unreserved = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')
                    || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' || c == '~';
            if (unreserved) {
                out.append(c);
            } else if (c == '/' && !encodeSlash) {
                out.append('/');
            } else {
                out.append('%').append(String.format("%02X", b & 0xFF));
            }
        }
        return out.toString();
    }

    private static byte[] hmac(byte[] key, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC-SHA256 failed", e);
        }
    }

    private static byte[] sha256(String data) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(data.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 failed", e);
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b & 0xFF));
        return sb.toString();
    }
}
