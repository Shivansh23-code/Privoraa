package com.privoraa.rag;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DocumentChunkRepository extends JpaRepository<DocumentChunk, String> {

    /**
     * Chunks of a user's READY documents whose embedding was produced by the
     * active embed model — the retrieval pool. Filtering by model is critical:
     * comparing vectors from different models/dimensions is meaningless and would
     * corrupt ranking. Chunks embedded with another model (or 'legacy') are
     * excluded until re-embedded.
     */
    @Query("""
            select c from DocumentChunk c
            where c.document.user.id = :userId
              and c.document.status = com.privoraa.rag.DocumentStatus.READY
              and c.embeddingModel = :embeddingModel
            """)
    List<DocumentChunk> findReadyChunksForUser(@Param("userId") String userId,
                                               @Param("embeddingModel") String embeddingModel);

    /** Every chunk owned by a user, regardless of model — used by re-embedding. */
    @Query("select c from DocumentChunk c where c.document.user.id = :userId")
    List<DocumentChunk> findAllForUser(@Param("userId") String userId);
}
