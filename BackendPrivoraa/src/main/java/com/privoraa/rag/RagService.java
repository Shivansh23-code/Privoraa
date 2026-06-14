package com.privoraa.rag;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.privoraa.config.RagProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Retrieval-augmented context builder: embed the query, rank chunks by cosine, ground the answer. */
@Service
public class RagService {

    private static final Logger log = LoggerFactory.getLogger(RagService.class);
    private static final double MIN_SCORE = 0.05;

    private final DocumentChunkRepository chunkRepository;
    private final EmbeddingService embeddingService;
    private final ObjectMapper mapper;
    private final RagProperties props;

    public RagService(DocumentChunkRepository chunkRepository, EmbeddingService embeddingService,
                      ObjectMapper mapper, RagProperties props) {
        this.chunkRepository = chunkRepository;
        this.embeddingService = embeddingService;
        this.mapper = mapper;
        this.props = props;
    }

    @Transactional(readOnly = true)
    public RagContext retrieve(String userId, String query) {
        // Only chunks embedded with the active model are comparable to the query
        // vector; others (different model, or pre-tracking 'legacy') are excluded
        // until re-embedded, so cosine similarity is always dimension-consistent.
        String embeddingTag = embeddingService.activeEmbeddingTag();
        List<DocumentChunk> chunks = chunkRepository.findReadyChunksForUser(userId, embeddingTag);
        if (chunks.isEmpty()) {
            return RagContext.empty();
        }

        float[] q = embeddingService.embed(query);

        List<Scored> scored = new ArrayList<>();
        for (DocumentChunk c : chunks) {
            float[] e = parse(c.getEmbedding());
            if (e.length == 0) {
                continue;
            }
            double score = EmbeddingService.cosine(q, e);
            if (score > MIN_SCORE) {
                scored.add(new Scored(c, score));
            }
        }
        scored.sort(Comparator.comparingDouble((Scored s) -> s.score).reversed());

        List<Scored> top = scored.subList(0, Math.min(props.topK(), scored.size()));
        if (top.isEmpty()) {
            return RagContext.empty();
        }

        StringBuilder block = new StringBuilder();
        List<Citation> citations = new ArrayList<>();
        int n = 1;
        for (Scored s : top) {
            String filename = s.chunk.getDocument().getFilename();
            block.append("[").append(n).append("] (")
                    .append(filename).append(", chunk ").append(s.chunk.getChunkIndex()).append(")\n")
                    .append(s.chunk.getContent()).append("\n\n");
            citations.add(new Citation(s.chunk.getChunkIndex(), filename, snippet(s.chunk.getContent())));
            n++;
        }
        return new RagContext(block.toString().trim(), citations);
    }

    private float[] parse(String json) {
        try {
            return mapper.readValue(json, float[].class);
        } catch (Exception e) {
            log.warn("Bad chunk embedding: {}", e.getMessage());
            return new float[0];
        }
    }

    private String snippet(String content) {
        String c = content.replaceAll("\\s+", " ").trim();
        return c.length() > 120 ? c.substring(0, 120) + "…" : c;
    }

    private record Scored(DocumentChunk chunk, double score) {}
}
