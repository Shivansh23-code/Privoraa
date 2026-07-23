package com.privoraa.llm;

import com.privoraa.common.ApiException;
import com.privoraa.common.RateLimitException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.time.Duration;

public final class RetryableErrorClassifier {

    public enum Category {
        RETRYABLE_RATE_LIMIT,
        RETRYABLE_SERVER_ERROR,
        RETRYABLE_TIMEOUT,
        RETRYABLE_NETWORK,
        NON_RETRYABLE_CLIENT,
        NON_RETRYABLE_SAFETY,
        NON_RETRYABLE_PRIVACY,
        NON_RETRYABLE_CANCELLED
    }

    private RetryableErrorClassifier() {}

    public static Category classify(Throwable err) {
        if (err instanceof RateLimitException) {
            return Category.RETRYABLE_RATE_LIMIT;
        }
        if (err instanceof java.util.concurrent.TimeoutException
                || err instanceof SocketTimeoutException) {
            return Category.RETRYABLE_TIMEOUT;
        }
        if (err instanceof ConnectException
                || err instanceof UnknownHostException
                || err instanceof java.net.NoRouteToHostException) {
            return Category.RETRYABLE_NETWORK;
        }
        if (err instanceof WebClientResponseException wcre) {
            int status = wcre.getStatusCode().value();
            if (status == 429) return Category.RETRYABLE_RATE_LIMIT;
            if (status >= 500) return Category.RETRYABLE_SERVER_ERROR;
            return Category.NON_RETRYABLE_CLIENT;
        }
        if (err instanceof ApiException apiEx) {
            if (apiEx.getStatus() != null) {
                int status = apiEx.getStatus().value();
                if (status == 429) return Category.RETRYABLE_RATE_LIMIT;
                if (status >= 500) return Category.RETRYABLE_SERVER_ERROR;
                if (status == 401 || status == 403) return Category.NON_RETRYABLE_CLIENT;
            }
        }
        String msg = err.getMessage() != null ? err.getMessage().toLowerCase() : "";
        if (msg.contains("429") || msg.contains("too many requests") || msg.contains("rate limit")) {
            return Category.RETRYABLE_RATE_LIMIT;
        }
        if (msg.contains("safety") || msg.contains("refusal") || msg.contains("blocked")
                || msg.contains("harmful") || msg.contains("inappropriate")) {
            return Category.NON_RETRYABLE_SAFETY;
        }
        if (msg.contains("privacy") || msg.contains("policy") || msg.contains("vault")
                || msg.contains("not allowed")) {
            return Category.NON_RETRYABLE_PRIVACY;
        }
        if (msg.contains("cancelled") || msg.contains("abort")) {
            return Category.NON_RETRYABLE_CANCELLED;
        }
        return Category.NON_RETRYABLE_CLIENT;
    }

    public static boolean isRetryable(Throwable err) {
        return switch (classify(err)) {
            case RETRYABLE_RATE_LIMIT, RETRYABLE_SERVER_ERROR, RETRYABLE_TIMEOUT, RETRYABLE_NETWORK -> true;
            case NON_RETRYABLE_CLIENT, NON_RETRYABLE_SAFETY, NON_RETRYABLE_PRIVACY, NON_RETRYABLE_CANCELLED -> false;
        };
    }

    public static Duration extractRetryAfter(Throwable err) {
        if (err instanceof RateLimitException rle) {
            return Duration.ofSeconds(rle.getRetryAfterSeconds());
        }
        if (err instanceof WebClientResponseException wcre) {
            String retryAfter = wcre.getHeaders() != null
                    ? wcre.getHeaders().getFirst("Retry-After") : null;
            if (retryAfter != null) {
                try {
                    return Duration.ofSeconds(Long.parseLong(retryAfter));
                } catch (NumberFormatException e) {
                    // ignore
                }
            }
        }
        return null;
    }
}
