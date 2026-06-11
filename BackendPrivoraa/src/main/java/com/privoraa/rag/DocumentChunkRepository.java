package com.privoraa.rag;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DocumentChunkRepository extends JpaRepository<DocumentChunk, String> {

    /** All chunks belonging to a user's READY documents — the retrieval pool. */
    @Query("""
            select c from DocumentChunk c
            where c.document.user.id = :userId
              and c.document.status = com.privoraa.rag.DocumentStatus.READY
            """)
    List<DocumentChunk> findReadyChunksForUser(@Param("userId") String userId);
}
