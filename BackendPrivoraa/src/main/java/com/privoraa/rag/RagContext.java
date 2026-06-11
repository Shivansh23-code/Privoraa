package com.privoraa.rag;

import java.util.List;

/** Retrieved context for a grounded answer: the prompt block plus its citations. */
public record RagContext(
        String contextBlock,
        List<Citation> citations
) {
    public boolean hasContext() {
        return contextBlock != null && !contextBlock.isBlank();
    }

    public static RagContext empty() {
        return new RagContext("", List.of());
    }
}
