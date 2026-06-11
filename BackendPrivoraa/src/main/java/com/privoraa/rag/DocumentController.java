package com.privoraa.rag;

import com.privoraa.auth.PrivoraaUserDetails;
import com.privoraa.rag.dto.DocumentDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/documents")
@Tag(name = "Documents (RAG)", description = "Upload notes and chat grounded on them")
public class DocumentController {

    private final DocumentService service;

    public DocumentController(DocumentService service) {
        this.service = service;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "Upload a document; chunking + embedding run asynchronously")
    public DocumentDto upload(@AuthenticationPrincipal PrivoraaUserDetails user,
                              @RequestParam("file") MultipartFile file) {
        return service.upload(user.getId(), file);
    }

    @GetMapping
    @Operation(summary = "List uploaded documents with status")
    public List<DocumentDto> list(@AuthenticationPrincipal PrivoraaUserDetails user) {
        return service.list(user.getId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a document and its chunks")
    public void delete(@AuthenticationPrincipal PrivoraaUserDetails user, @PathVariable String id) {
        service.delete(user.getId(), id);
    }
}
