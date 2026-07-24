package com.privoraa.config;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

class FallbackPropertiesTest {

    @Test
    void defaultValues() {
        FallbackProperties props = new FallbackProperties(null, null, null, null, true, 0);
        assertEquals(Duration.ofSeconds(120), props.rateLimitCooldown());
        assertEquals(Duration.ofSeconds(30), props.serverErrorCooldown());
        assertEquals(Duration.ofSeconds(15), props.timeoutCooldown());
        assertEquals(Duration.ofSeconds(30), props.networkCooldown());
        assertTrue(props.enabled());
        assertEquals(4, props.maxCandidates());
    }

    @Test
    void customValuesArePreserved() {
        FallbackProperties props = new FallbackProperties(
                Duration.ofSeconds(300),
                Duration.ofSeconds(60),
                Duration.ofSeconds(30),
                Duration.ofSeconds(60),
                false,
                2
        );
        assertEquals(Duration.ofSeconds(300), props.rateLimitCooldown());
        assertEquals(Duration.ofSeconds(60), props.serverErrorCooldown());
        assertEquals(Duration.ofSeconds(30), props.timeoutCooldown());
        assertEquals(Duration.ofSeconds(60), props.networkCooldown());
        assertFalse(props.enabled());
        assertEquals(2, props.maxCandidates());
    }

    @Test
    void zeroDurationUsesDefault() {
        FallbackProperties props = new FallbackProperties(
                Duration.ZERO, Duration.ZERO, Duration.ZERO, Duration.ZERO, true, 0);
        assertEquals(Duration.ofSeconds(120), props.rateLimitCooldown());
        assertEquals(Duration.ofSeconds(30), props.serverErrorCooldown());
        assertEquals(Duration.ofSeconds(15), props.timeoutCooldown());
        assertEquals(Duration.ofSeconds(30), props.networkCooldown());
    }

    @Test
    void negativeDurationUsesDefault() {
        FallbackProperties props = new FallbackProperties(
                Duration.ofSeconds(-1), Duration.ofSeconds(-1), Duration.ofSeconds(-1), Duration.ofSeconds(-1), true, 0);
        assertEquals(Duration.ofSeconds(120), props.rateLimitCooldown());
        assertEquals(Duration.ofSeconds(30), props.serverErrorCooldown());
        assertEquals(Duration.ofSeconds(15), props.timeoutCooldown());
        assertEquals(Duration.ofSeconds(30), props.networkCooldown());
    }
}
