package com.privoraa.llm;

import com.privoraa.common.ApiException;
import com.privoraa.common.RateLimitException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.concurrent.TimeoutException;

import static org.junit.jupiter.api.Assertions.*;

class RetryableErrorClassifierTest {

    @Test
    void rateLimitExceptionIsRetryable() {
        Throwable err = new RateLimitException("Too many requests", 30);
        assertTrue(RetryableErrorClassifier.isRetryable(err));
        assertEquals(RetryableErrorClassifier.Category.RETRYABLE_RATE_LIMIT, RetryableErrorClassifier.classify(err));
    }

    @Test
    void timeoutExceptionIsRetryable() {
        Throwable err = new TimeoutException("Timed out");
        assertTrue(RetryableErrorClassifier.isRetryable(err));
        assertEquals(RetryableErrorClassifier.Category.RETRYABLE_TIMEOUT, RetryableErrorClassifier.classify(err));
    }

    @Test
    void socketTimeoutIsRetryable() {
        Throwable err = new SocketTimeoutException("connect timed out");
        assertTrue(RetryableErrorClassifier.isRetryable(err));
    }

    @Test
    void connectExceptionIsRetryable() {
        Throwable err = new ConnectException("Connection refused");
        assertTrue(RetryableErrorClassifier.isRetryable(err));
        assertEquals(RetryableErrorClassifier.Category.RETRYABLE_NETWORK, RetryableErrorClassifier.classify(err));
    }

    @Test
    void unknownHostIsRetryable() {
        Throwable err = new UnknownHostException("unknown host");
        assertTrue(RetryableErrorClassifier.isRetryable(err));
    }

    @Test
    void webClientResponse429IsRetryableRateLimit() {
        Throwable err = WebClientResponseException.create(429, "Too Many Requests", null, null, null);
        assertTrue(RetryableErrorClassifier.isRetryable(err));
        assertEquals(RetryableErrorClassifier.Category.RETRYABLE_RATE_LIMIT, RetryableErrorClassifier.classify(err));
    }

    @Test
    void webClientResponse500IsRetryableServerError() {
        Throwable err = WebClientResponseException.create(503, "Service Unavailable", null, null, null);
        assertTrue(RetryableErrorClassifier.isRetryable(err));
        assertEquals(RetryableErrorClassifier.Category.RETRYABLE_SERVER_ERROR, RetryableErrorClassifier.classify(err));
    }

    @Test
    void webClientResponse400IsNonRetryable() {
        Throwable err = WebClientResponseException.create(400, "Bad Request", null, null, null);
        assertFalse(RetryableErrorClassifier.isRetryable(err));
        assertEquals(RetryableErrorClassifier.Category.NON_RETRYABLE_CLIENT, RetryableErrorClassifier.classify(err));
    }

    @Test
    void webClientResponse401IsNonRetryable() {
        Throwable err = WebClientResponseException.create(401, "Unauthorized", null, null, null);
        assertFalse(RetryableErrorClassifier.isRetryable(err));
    }

    @Test
    void webClientResponse403IsNonRetryable() {
        Throwable err = WebClientResponseException.create(403, "Forbidden", null, null, null);
        assertFalse(RetryableErrorClassifier.isRetryable(err));
    }

    @Test
    void apiException429IsRetryable() {
        Throwable err = new ApiException(HttpStatus.TOO_MANY_REQUESTS, "rate limited");
        assertTrue(RetryableErrorClassifier.isRetryable(err));
        assertEquals(RetryableErrorClassifier.Category.RETRYABLE_RATE_LIMIT, RetryableErrorClassifier.classify(err));
    }

    @Test
    void apiException500IsRetryable() {
        Throwable err = new ApiException(HttpStatus.BAD_GATEWAY, "upstream error");
        assertTrue(RetryableErrorClassifier.isRetryable(err));
        assertEquals(RetryableErrorClassifier.Category.RETRYABLE_SERVER_ERROR, RetryableErrorClassifier.classify(err));
    }

    @Test
    void apiException401IsNonRetryable() {
        Throwable err = new ApiException(HttpStatus.UNAUTHORIZED, "invalid credentials");
        assertFalse(RetryableErrorClassifier.isRetryable(err));
        assertEquals(RetryableErrorClassifier.Category.NON_RETRYABLE_CLIENT, RetryableErrorClassifier.classify(err));
    }

    @Test
    void apiException403IsNonRetryable() {
        Throwable err = new ApiException(HttpStatus.FORBIDDEN, "forbidden");
        assertFalse(RetryableErrorClassifier.isRetryable(err));
    }

    @Test
    void unknownExceptionIsNonRetryableByDefault() {
        Throwable err = new RuntimeException("unknown internal error");
        assertFalse(RetryableErrorClassifier.isRetryable(err));
        assertEquals(RetryableErrorClassifier.Category.NON_RETRYABLE_CLIENT, RetryableErrorClassifier.classify(err));
    }

    @Test
    void safetyMessageIsNonRetryable() {
        Throwable err = new RuntimeException("The response was blocked due to safety concerns");
        assertFalse(RetryableErrorClassifier.isRetryable(err));
        assertEquals(RetryableErrorClassifier.Category.NON_RETRYABLE_SAFETY, RetryableErrorClassifier.classify(err));
    }

    @Test
    void privacyMessageIsNonRetryable() {
        Throwable err = new RuntimeException("Privacy policy violation: content not allowed");
        assertFalse(RetryableErrorClassifier.isRetryable(err));
        assertEquals(RetryableErrorClassifier.Category.NON_RETRYABLE_PRIVACY, RetryableErrorClassifier.classify(err));
    }

    @Test
    void cancelledMessageIsNonRetryable() {
        Throwable err = new RuntimeException("Request was cancelled");
        assertFalse(RetryableErrorClassifier.isRetryable(err));
        assertEquals(RetryableErrorClassifier.Category.NON_RETRYABLE_CANCELLED, RetryableErrorClassifier.classify(err));
    }

    @Test
    void abortMessageIsNonRetryable() {
        Throwable err = new RuntimeException("abort");
        assertFalse(RetryableErrorClassifier.isRetryable(err));
        assertEquals(RetryableErrorClassifier.Category.NON_RETRYABLE_CANCELLED, RetryableErrorClassifier.classify(err));
    }

    @Test
    void nullMessageIsNonRetryable() {
        Throwable err = new RuntimeException((String) null);
        assertFalse(RetryableErrorClassifier.isRetryable(err));
    }

    @Test
    void rateLimitExceptionHasRetryAfter() {
        RateLimitException err = new RateLimitException("rate limited", 45);
        java.time.Duration retryAfter = RetryableErrorClassifier.extractRetryAfter(err);
        assertNotNull(retryAfter);
        assertEquals(45, retryAfter.toSeconds());
    }

    @Test
    void nonRateLimitHasNoRetryAfter() {
        Throwable err = new RuntimeException("generic");
        assertNull(RetryableErrorClassifier.extractRetryAfter(err));
    }

}
