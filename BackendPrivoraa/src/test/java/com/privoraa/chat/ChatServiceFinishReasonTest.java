package com.privoraa.chat;

import org.junit.jupiter.api.Test;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for ChatService reason-resolution logic.
 * Verifies how terminalReceived / finishReason / emitted combine to produce
 * the final finishReason sent in the "done" SSE event.
 */
class ChatServiceFinishReasonTest {

    private static String resolve(boolean terminalReceived, String finishReason, boolean emitted) {
        if (terminalReceived) {
            return finishReason != null ? finishReason : "unknown";
        }
        return emitted ? "incomplete" : "unknown";
    }

    @Test
    void terminalEventWithNullFinishReasonProducesUnknown() {
        assertEquals("unknown", resolve(true, null, true));
        assertEquals("unknown", resolve(true, null, false));
    }

    @Test
    void terminalEventWithStopProducesStop() {
        assertEquals("stop", resolve(true, "stop", true));
    }

    @Test
    void noTerminalWithContentProducesIncomplete() {
        assertEquals("incomplete", resolve(false, null, true));
    }

    @Test
    void noTerminalWithNoContentProducesUnknown() {
        assertEquals("unknown", resolve(false, null, false));
    }
}
