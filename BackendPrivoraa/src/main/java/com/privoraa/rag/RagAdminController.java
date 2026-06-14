package com.privoraa.rag;

import com.privoraa.auth.PrivoraaUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * RAG maintenance endpoints. Re-embedding is needed whenever the active embed
 * model changes; until then, chunks embedded with the old model are excluded
 * from retrieval to avoid mixing embedding dimensions.
 */
@RestController
@RequestMapping("/api/rag")
@Tag(name = "RAG admin", description = "Maintenance operations for document embeddings")
public class RagAdminController {

    private final ReembedService reembedService;

    public RagAdminController(ReembedService reembedService) {
        this.reembedService = reembedService;
    }

    @PostMapping("/reembed")
    @Operation(summary = "Re-embed all of the current user's chunks with the active embed model")
    public ReembedService.ReembedResult reembed(@AuthenticationPrincipal PrivoraaUserDetails user) {
        return reembedService.reembedForUser(user.getId());
    }
}
