package com.privoraa.rag;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.List;

/** Async pipeline: extract text -> chunk -> embed -> store -> mark READY/FAILED. */
@Component
public class DocumentProcessor {

    private static final Logger log = LoggerFactory.getLogger(DocumentProcessor.class);

    private final DocumentRepository documentRepository;
    private final DocumentChunkRepository chunkRepository;
    private final TextExtractionService extraction;
    private final ChunkingService chunking;
    private final EmbeddingService embedding;
    private final ObjectMapper mapper;

    public DocumentProcessor(DocumentRepository documentRepository, DocumentChunkRepository chunkRepository,
                             TextExtractionService extraction, ChunkingService chunking,
                             EmbeddingService embedding, ObjectMapper mapper) {
        this.documentRepository = documentRepository;
        this.chunkRepository = chunkRepository;
        this.extraction = extraction;
        this.chunking = chunking;
        this.embedding = embedding;
        this.mapper = mapper;
    }

    @Async
    public void process(String documentId, byte[] data, String filename) {
        try {
            String text = extraction.extract(data, filename);
            List<String> pieces = chunking.chunk(text);
            if (pieces.isEmpty()) {
                throw new IllegalStateException("No extractable text found");
            }

            Document docRef = documentRepository.getReferenceById(documentId);
            String embeddingTag = embedding.activeEmbeddingTag();
            int index = 0;
            for (String piece : pieces) {
                float[] vec = embedding.embed(piece);
                DocumentChunk chunk = DocumentChunk.builder()
                        .document(docRef)
                        .chunkIndex(index++)
                        .content(piece)
                        .embedding(mapper.writeValueAsString(vec))
                        .embeddingModel(embeddingTag)
                        .embeddingDim(vec.length)
                        .build();
                chunkRepository.save(chunk);
            }

            documentRepository.findById(documentId).ifPresent(doc -> {
                doc.setChunkCount(pieces.size());
                doc.setStatus(DocumentStatus.READY);
                doc.setErrorMessage(null);
                documentRepository.save(doc);
            });
            log.info("Document {} processed: {} chunks", documentId, pieces.size());
        } catch (Exception e) {
            log.warn("Document {} processing failed: {}", documentId, e.getMessage());
            documentRepository.findById(documentId).ifPresent(doc -> {
                doc.setStatus(DocumentStatus.FAILED);
                doc.setErrorMessage(truncate(e.getMessage()));
                documentRepository.save(doc);
            });
        }
    }

    private String truncate(String msg) {
        if (msg == null) {
            return "Processing failed";
        }
        return msg.length() > 490 ? msg.substring(0, 490) : msg;
    }
}
