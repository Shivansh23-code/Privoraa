package com.privoraa.rag;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EmbeddingCosineTest {

    @Test
    void identicalVectorsAreFullySimilar() {
        float[] v = {0.6f, 0.8f};
        assertEquals(1.0, EmbeddingService.cosine(v, v), 1e-6);
    }

    @Test
    void orthogonalVectorsAreDissimilar() {
        float[] a = {0.6f, 0.8f};
        float[] b = {0.8f, -0.6f};
        assertEquals(0.0, EmbeddingService.cosine(a, b), 1e-6);
    }

    @Test
    void mismatchedLengthsAreZero() {
        assertTrue(EmbeddingService.cosine(new float[]{1f}, new float[]{1f, 2f}) == 0.0);
    }
}
