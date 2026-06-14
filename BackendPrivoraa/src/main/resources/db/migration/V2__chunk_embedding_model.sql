-- Track which embedding model + dimension produced each chunk's vector, so
-- retrieval never compares vectors from different models (mixing dimensions or
-- embedding spaces silently corrupts cosine similarity / RAG results).
ALTER TABLE document_chunks
    ADD COLUMN embedding_model VARCHAR(120) NOT NULL DEFAULT 'legacy',
    ADD COLUMN embedding_dim   INT          NOT NULL DEFAULT 0;

-- Existing chunks predate model tracking and cannot be reclassified retroactively.
-- They stay tagged 'legacy' so retrieval excludes them until POST /api/rag/reembed
-- re-embeds them with the active model. Index supports the per-model retrieval query.
CREATE INDEX idx_chunk_embed_model ON document_chunks (embedding_model);
