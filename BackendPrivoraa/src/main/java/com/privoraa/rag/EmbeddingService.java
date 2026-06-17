package com.privoraa.rag;

import com.privoraa.config.OllamaProperties;
import com.privoraa.config.OpenRouterProperties;
import com.privoraa.config.RagProperties;
import com.privoraa.llm.LlmProviderResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Produces embeddings for chunks and queries via the active LLM provider:
 * Ollama (local, e.g. nomic-embed-text) or OpenRouter when configured; otherwise
 * a deterministic local feature-hashing embedding so RAG works with zero external
 * dependencies. Every vector is tagged with {@link #activeEmbeddingTag()} so
 * retrieval only ever compares vectors produced by the same model + dimension.
 */
@Service
public class EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingService.class);

    private final LlmProviderResolver resolver;
    private final OpenRouterProperties orProps;
    private final OllamaProperties ollamaProps;
    private final RagProperties ragProps;
    private final AtomicBoolean warnedLocal = new AtomicBoolean(false);

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
     * Embed many texts in one go. The embedding backend is chosen by
     * {@link #resolveProvider()} — independent of the CHAT provider — so cloud
     * chat can run on OpenRouter while embeddings use the self-contained local
     * encoder. Ingestion and query MUST go through here so vectors are comparable.
     */
    public List<float[]> embedBatch(List<String> texts) {
        if (texts.isEmpty()) {
            return List.of();
        }
        switch (resolveProvider()) {
            case "ollama":
                return normalizeAll(resolver.byId("ollama").embed(texts, ollamaProps.embedModel()));
            case "openrouter":
                return normalizeAll(resolver.byId("openrouter").embed(texts, orProps.embeddingModel()));
            default:
                // Self-contained lexical embedding — no external dependency. Good
                // enough for keyword-grounded RAG; log once so the degraded mode is
                // observable rather than silent.
                if (warnedLocal.compareAndSet(false, true)) {
                    log.warn("RAG embeddings using the built-in local encoder (no Ollama/OpenRouter "
                            + "embeddings configured). Retrieval is lexical; set privoraa.rag.embedding-provider "
                            + "or OLLAMA/EMBEDDING_MODEL for semantic embeddings.");
                }
                List<float[]> out = new ArrayList<>(texts.size());
                for (String t : texts) {
                    out.add(localEmbed(t));
                }
                return out;
        }
    }

    /**
     * Resolve the embedding backend. Honors {@code privoraa.rag.embedding-provider}
     * (ollama|openrouter|local); {@code auto} falls back to the active chat
     * provider's embeddings, then the local encoder. Falls through to local when an
     * explicitly-named external provider isn't actually usable.
     */
    private String resolveProvider() {
        String configured = ragProps.embeddingProvider();
        switch (configured) {
            case "ollama":
                return "ollama";
            case "openrouter":
                return orProps.embeddingsConfigured() ? "openrouter" : "local";
            case "local":
                return "local";
            default: // auto
                if (resolver.isOllamaActive()) {
                    return "ollama";
                }
                if (orProps.embeddingsConfigured()) {
                    return "openrouter";
                }
                return "local";
        }
    }

    /**
     * Stable identifier of the active embedding model, persisted with each chunk
     * and used to scope retrieval. Derived from the SAME resolution as
     * {@link #embedBatch} so ingest-tag == query-tag. The local tag is versioned
     * ({@code local-v2}) so chunks from the older encoder are excluded until
     * {@code POST /api/rag/reembed} re-embeds them.
     */
    public String activeEmbeddingTag() {
        switch (resolveProvider()) {
            case "ollama":
                return "ollama:" + ollamaProps.embedModel();
            case "openrouter":
                return "openrouter:" + orProps.embeddingModel();
            default:
                return "local-v2:" + Math.max(64, ragProps.embeddingDim());
        }
    }

    // ----------------------------------------------------------------- internals

    private List<float[]> normalizeAll(float[][] vectors) {
        List<float[]> out = new ArrayList<>(vectors.length);
        for (float[] v : vectors) {
            out.add(normalize(v));
        }
        return out;
    }

    /**
     * Self-contained lexical embedding: word unigrams + bigrams + character
     * trigrams, hashed (signed) into a fixed-dim vector with sublinear term
     * weighting, then L2-normalized. The char trigrams give partial-word and
     * morphology overlap (plurals, stems, typos) so retrieval works far better
     * than plain bag-of-words while needing zero external service.
     */
    private float[] localEmbed(String text) {
        int dim = Math.max(64, ragProps.embeddingDim());
        float[] vec = new float[dim];
        if (text == null || text.isBlank()) {
            return vec;
        }
        Map<String, Integer> tf = new HashMap<>();
        String prev = null;
        for (String token : text.toLowerCase().split("[^\\p{L}\\p{Nd}]+")) {
            if (token.isBlank()) {
                continue;
            }
            tf.merge(token, 1, Integer::sum);               // unigram
            if (prev != null) {
                tf.merge(prev + " " + token, 1, Integer::sum); // bigram
            }
            String padded = "#" + token + "#";              // char trigrams
            for (int i = 0; i + 3 <= padded.length(); i++) {
                tf.merge("$" + padded.substring(i, i + 3), 1, Integer::sum);
            }
            prev = token;
        }
        for (Map.Entry<String, Integer> e : tf.entrySet()) {
            int h = e.getKey().hashCode();
            int idx = Math.floorMod(h, dim);
            float sign = ((h >> 31) & 1) == 0 ? 1f : -1f;   // signed hashing reduces collisions
            vec[idx] += sign * (float) (1.0 + Math.log(e.getValue())); // sublinear TF
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
