package com.privoraa.llm;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class StreamEventTest {

    @Test
    void deltaHasContentAndNullFinishReason() {
        StreamEvent e = StreamEvent.delta("hello");
        assertEquals("hello", e.delta());
        assertNull(e.finishReason());
    }

    @Test
    void doneHasNullContentAndFinishReason() {
        StreamEvent e = StreamEvent.done("stop");
        assertNull(e.delta());
        assertEquals("stop", e.finishReason());
    }

    @Test
    void donePreservesLength() {
        StreamEvent e = StreamEvent.done("length");
        assertEquals("length", e.finishReason());
    }

    @Test
    void deltaCanBeEmpty() {
        StreamEvent e = StreamEvent.delta("");
        assertEquals("", e.delta());
        assertNull(e.finishReason());
    }

    @Test
    void deltaCanBeNull() {
        StreamEvent e = StreamEvent.delta(null);
        assertNull(e.delta());
        assertNull(e.finishReason());
        assertFalse(e.terminal());
    }

    @Test
    void doneNullIsTerminal() {
        StreamEvent e = StreamEvent.done(null);
        assertNull(e.delta());
        assertNull(e.finishReason());
        assertTrue(e.terminal());
    }
}
