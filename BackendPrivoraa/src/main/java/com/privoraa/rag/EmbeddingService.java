package com.privoraa.rag;

import com.privoraa.config.OllamaProperties;
import com.privoraa.config.OpenRouterProperties;
import com.privoraa.config.RagProperties;
import com.privoraa.llm.LlmProviderResolver;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Produces embeddings for chunks and queries via the active LLM provider:
 * Ollama (local, e.g. nomic-embed-text) or OpenRouter when configured; otherwise
 * a deterministic local feature-hashing embedding so RAG works with zero external
 * dependencies. Every vector is tagged with {@link #activeEmbeddingTag()} so
 * retrieval only ever compares vectors produced by the same model + dimension.
 */
@Service
public class EmbeddingService {

    private final LlmProviderResolver resolver;
    private final OpenRouterProperties orProps;
    private final OllamaProperties ollamaProps;
    private final RagProperties ragProps;

    public EmbeddingService(LlmProviderResolver resolver, OpenRouterProperties orProps,
                            OllamaProperties ollamaProps, RagProperties ragProps) {
        this.resolver = resolver;
        this.orProps = orProps;
        this.ollamaProps = ollamaProps;
        this.ragProps = ragProps;
    }

    /** Embed a single text with the active model. */
    public float[] embed(String text) {
        return embedBatch(List.of(text)).get(0);
    }

    /**
     * Embed many texts in one go where the backend supports it (Ollama batches
     * natively; OpenRouter loops). Used by document processing and re-embedding.
     */
    public List<float[]> embedBatch(List<String> texts) {
        if (texts.isEmpty()) {
            return List.of();
        }
        if (resolver.isOllamaActive()) {
            return normalizeAll(resolver.byId("ollama").embed(texts, ollamaProps.embedModel()));
        }
        if (orProps.embeddingsConfigured()) {
            return normalizeAll(resolver.byId("openrouter").embed(texts, orProps.embeddingModel()));
        }
        // No external embeddings available — deterministic local fallback.
        List<float[]> out = new ArrayList<>(texts.size());
        for (String t : texts) {
            out.add(localEmbed(t));
        }
        return out;
    }

    /**
     * Stable identifier of the active embedding model, persisted with each chunk
     * and used to scope retrieval. Changing the active model changes this tag, so
     * old chunks stop matching until {@code POST /api/rag/reembed} re-embeds them.
     */
    public String activeEmbeddingTag() {
        if (resolver.isOllamaActive()) {
            return "ollama:" + ollamaProps.embedModel();
        }
        if (orProps.embeddingsConfigured()) {
            return "openrouter:" + orProps.embeddingModel();
        }
        return "local:" + Math.max(64, ragProps.embeddingDim());
    }

    // ----------------------------------------------------------------- internals

    private List<float[]> normalizeAll(float[][] vectors) {
        List<float[]> out = new ArrayList<>(vectors.length);
        for (float[] v : vectors) {
            out.add(normalize(v));
        }
        return out;
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
