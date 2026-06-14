package com.privoraa.rag;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "document_chunks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentChunk {

    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id")
    private Document document;

    @Column(name = "chunk_index", nullable = false)
    private int chunkIndex;

    @Lob
    @Column(nullable = false)
    private String content;

    /** Embedding stored as a JSON float array. */
    @Lob
    @Column(nullable = false)
    private String embedding;

    /**
     * Stable tag of the model that produced {@link #embedding}, e.g.
     * "ollama:nomic-embed-text", "openrouter:&lt;model&gt;", or "local:384".
     * Retrieval only matches chunks whose tag equals the active embed model.
     */
    @Column(name = "embedding_model", nullable = false, length = 120)
    private String embeddingModel;

    /** Vector dimension of {@link #embedding}; guards against dimension mismatch. */
    @Column(name = "embedding_dim", nullable = false)
    private int embeddingDim;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
    }
}
