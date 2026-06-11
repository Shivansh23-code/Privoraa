package com.privoraa.rag;

import com.privoraa.config.RagProperties;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/** Splits a document into overlapping windows so retrieval has self-contained passages. */
@Service
public class ChunkingService {

    private final RagProperties props;

    public ChunkingService(RagProperties props) {
        this.props = props;
    }

    public List<String> chunk(String text) {
        List<String> chunks = new ArrayList<>();
        if (text == null) {
            return chunks;
        }
        String normalized = text.replaceAll("[ \\t\\x0B\\f\\r]+", " ")
                .replaceAll("\\n{3,}", "\n\n")
                .trim();
        if (normalized.isEmpty()) {
            return chunks;
        }

        int size = Math.max(200, props.chunkSize());
        int overlap = Math.max(0, Math.min(props.chunkOverlap(), size - 1));
        int step = size - overlap;

        for (int start = 0; start < normalized.length(); start += step) {
            int end = Math.min(start + size, normalized.length());
            String piece = normalized.substring(start, end).trim();
            if (!piece.isEmpty()) {
                chunks.add(piece);
            }
            if (end == normalized.length()) {
                break;
            }
        }
        return chunks;
    }
}
