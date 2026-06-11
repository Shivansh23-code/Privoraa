package com.privoraa.rag;

/** A retrieved source chunk surfaced to the UI under each grounded answer. */
public record Citation(
        int chunk,
        String doc,
        String snippet
) {}
