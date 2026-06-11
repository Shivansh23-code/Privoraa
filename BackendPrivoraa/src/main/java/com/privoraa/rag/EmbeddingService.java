package com.privoraa.rag;

import com.privoraa.config.OpenRouterProperties;
import com.privoraa.config.RagProperties;
import com.privoraa.llm.OpenRouterClient;
import org.springframework.stereotype.Service;

/**
 * Produces embeddings for chunks and queries. Uses an OpenRouter embedding model
 * when configured; otherwise a deterministic local feature-hashing embedding so
 * RAG works with zero external dependencies. Both sides of a comparison always
 * use the same method within a run, so cosine similarity is consistent.
 */
@Service
public class EmbeddingService {

    private final OpenRouterClient client;
    private final OpenRouterProperties orProps;
    private final RagProperties ragProps;

    public EmbeddingService(OpenRouterClient client, OpenRouterProperties orProps, RagProperties ragProps) {
        this.client = client;
        this.orProps = orProps;
        this.ragProps = ragProps;
    }

    public float[] embed(String text) {
        if (orProps.embeddingsConfigured()) {
            return normalize(client.embed(text)); // throws on failure -> consistent dims
        }
        return localEmbed(text);
    }

    /** Bag-of-tokens feature hashing into a fixed-dim, L2-normalized vector. */
    private float[] localEmbed(String text) {
        int dim = Math.max(64, ragProps.embeddingDim());
        float[] vec = new float[dim];
        if (text == null || text.isBlank()) {
            return vec;
        }
        String[] tokens = text.toLowerCase().split("[^\\p{L}\\p{Nd}]+");
        for (String token : tokens) {
            if (token.isBlank()) {
                continue;
            }
            int h = token.hashCode();
            int idx = Math.floorMod(h, dim);
            float sign = ((h >> 31) & 1) == 0 ? 1f : -1f; // signed hashing reduces collisions
            vec[idx] += sign;
        }
        return normalize(vec);
    }

    private float[] normalize(float[] v) {
        double norm = 0;
        for (float x : v) {
            norm += (double) x * x;
        }
        norm = Math.sqrt(norm);
        if (norm == 0) {
            return v;
        }
        for (int i = 0; i < v.length; i++) {
            v[i] = (float) (v[i] / norm);
        }
        return v;
    }

    public static double cosine(float[] a, float[] b) {
        if (a == null || b == null || a.length != b.length) {
            return 0;
        }
        double dot = 0;
        for (int i = 0; i < a.length; i++) {
            dot += (double) a[i] * b[i];
        }
        return dot; // inputs are L2-normalized
    }
}
