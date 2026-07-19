package com.privoraa.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GeminiPropertiesTest {
    @Test
    void permanentlyUnavailableModelIsExcludedFromConfiguredChain() {
        GeminiProperties props = new GeminiProperties("key", null,
                "gemini-2.0-flash", "gemini-2.5-flash");
        assertEquals("gemini-2.5-flash", props.codeModel());
        assertEquals("gemini-2.5-flash", props.fallbackModel());
    }
}
