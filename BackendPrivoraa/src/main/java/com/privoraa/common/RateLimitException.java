package com.privoraa.common;

import org.springframework.http.HttpStatus;

/** Thrown when a user exceeds their request budget. Carries a Retry-After hint. */
public class RateLimitException extends ApiException {

    private final long retryAfterSeconds;

    public RateLimitException(String message, long retryAfterSeconds) {
        super(HttpStatus.TOO_MANY_REQUESTS, message);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
