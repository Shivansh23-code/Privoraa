package com.privoraa.rag;

import com.privoraa.auth.PrivoraaUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Standalone RAG retrieval. The cloud server can't reach a user's local Ollama,
 * so on-device chat runs browser-direct (browser -> localhost:11434), bypassing
 * the server's chat pipeline — and therefore its RAG grounding. This endpoint
 * lets that browser-direct path fetch the same top-K context + citations the
 * server would have used, and inject it into the local prompt, so "chat with my
 * notes" works with on-device models too.
 */
@RestController
@RequestMapping("/api/v1/rag")
@Tag(name = "RAG retrieval", description = "Retrieve grounding context for on-device models")
public class RagController {

    private final RagService ragService;

    public RagController(RagService ragService) {
        this.ragService = ragService;
    }

    @PostMapping("/retrieve")
    @Operation(summary = "Top-K grounding context + citations for a query (no LLM call)")
    public RagContext retrieve(@AuthenticationPrincipal PrivoraaUserDetails user,
                               @RequestBody RetrieveRequest req) {
        if (req == null || req.query() == null || req.query().isBlank()) {
            return RagContext.empty();
        }
        return ragService.retrieve(user.getId(), req.query());
    }

    public record RetrieveRequest(String query) {}
}
