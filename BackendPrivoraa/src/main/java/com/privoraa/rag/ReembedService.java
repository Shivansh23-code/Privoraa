package com.privoraa.rag;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Re-embeds a user's existing chunks with the currently-active embed model.
 * Required whenever the embed model changes — mixing embedding spaces/dimensions
 * silently corrupts retrieval, so chunks tagged with an old model are skipped by
 * {@link RagService} until this runs. Works in batches; the active model may be a
 * slow local one, so callers should allow a long timeout.
 */
@Service
public class ReembedService {

    private static final Logger log = LoggerFactory.getLogger(ReembedService.class);
    private static final int BATCH = 32;

    private final DocumentChunkRepository chunkRepository;
    private final EmbeddingService embedding;
    private final ObjectMapper mapper;

    public ReembedService(DocumentChunkRepository chunkRepository, EmbeddingService embedding, ObjectMapper mapper) {
        this.chunkRepository = chunkRepository;
        this.embedding = embedding;
        this.mapper = mapper;
    }

    /** Re-embed every chunk owned by the user; returns how many were updated. */
    @Transactional
    public ReembedResult reembedForUser(String userId) {
        List<DocumentChunk> chunks = chunkRepository.findAllForUser(userId);
        String tag = embedding.activeEmbeddingTag();
        int updated = 0;

        for (int start = 0; start < chunks.size(); start += BATCH) {
            List<DocumentChunk> batch = chunks.subList(start, Math.min(start + BATCH, chunks.size()));
            List<float[]> vectors = embedding.embedBatch(batch.stream().map(DocumentChunk::getContent).toList());
            for (int i = 0; i < batch.size(); i++) {
                DocumentChunk c = batch.get(i);
                float[] vec = vectors.get(i);
                try {
                    c.setEmbedding(mapper.writeValueAsString(vec));
                    c.setEmbeddingModel(tag);
                    c.setEmbeddingDim(vec.length);
                    updated++;
                } catch (Exception e) {
                    log.warn("Re-embed failed for chunk {}: {}", c.getId(), e.getMessage());
                }
            }
            chunkRepository.saveAll(batch);
        }

        log.info("Re-embedded {} chunks for user {} with model {}", updated, userId, tag);
        return new ReembedResult(tag, chunks.size(), updated);
    }

    public record ReembedResult(String embeddingModel, int total, int reembedded) {}
}
