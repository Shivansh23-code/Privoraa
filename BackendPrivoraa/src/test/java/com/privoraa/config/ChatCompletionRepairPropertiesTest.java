package com.privoraa.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ChatCompletionRepairPropertiesTest {
    @Test
    void defaultsAreBounded() {
        ChatCompletionRepairProperties properties = new ChatCompletionRepairProperties(true, 0, 0);
        assertTrue(properties.enabled());
        assertEquals(1, properties.maxAttempts());
        assertEquals(512, properties.maxOutputTokens());
    }

    @Test
    void attemptsCannotExceedOne() {
        assertEquals(1, new ChatCompletionRepairProperties(true, 4, 256).maxAttempts());
    }
}
