package com.privoraa.rag;

import com.privoraa.auth.UserRepository;
import com.privoraa.common.ApiException;
import com.privoraa.rag.dto.DocumentDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class DocumentService {
    private static final long MAX_BYTES = 25L * 1024 * 1024;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("txt", "md", "log", "java", "js", "jsx", "ts", "tsx",
            "json", "xml", "yaml", "yml", "sql", "py", "cpp", "c", "cs", "html", "css", "pdf", "docx", "csv");

    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final DocumentProcessor processor;

    public DocumentService(DocumentRepository documentRepository, UserRepository userRepository,
                           DocumentProcessor processor) {
        this.documentRepository = documentRepository;
        this.userRepository = userRepository;
        this.processor = processor;
    }

    /** Persist the document (committed immediately) then kick off async processing. */
    public DocumentDto upload(String userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("No file provided");
        }
        if (file.getSize() > MAX_BYTES) throw ApiException.badRequest("File must be 25 MB or smaller");
        String filename = file.getOriginalFilename();
        if (filename == null || filename.isBlank()) {
            filename = "document";
        }
        filename = filename.replace('\\', '/');
        filename = filename.substring(filename.lastIndexOf('/') + 1);
        String extension = filename.contains(".")
                ? filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw ApiException.badRequest("Unsupported file type");
        }
        String mime = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        boolean mimeAllowed = mime.isBlank() || mime.startsWith("text/") || mime.equals("application/octet-stream")
                || mime.equals("application/pdf") || mime.equals("application/json") || mime.contains("xml")
                || mime.equals("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        if (!mimeAllowed) throw ApiException.badRequest("File content type does not match a supported document");
        byte[] data;
        try {
            data = file.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("Could not read the uploaded file");
        }

        // documentRepository.save runs in its own transaction and commits before
        // the async processor reads the row (no @Transactional on this method).
        Document doc = documentRepository.save(Document.builder()
                .user(userRepository.getReferenceById(userId))
                .filename(filename)
                .status(DocumentStatus.PROCESSING)
                .chunkCount(0)
                .build());
        processor.process(doc.getId(), data, filename);
        return DocumentDto.from(doc);
    }

    @Transactional(readOnly = true)
    public List<DocumentDto> list(String userId) {
        return documentRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(DocumentDto::from).toList();
    }

    @Transactional
    public void delete(String userId, String id) {
        Document doc = documentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> ApiException.notFound("Document not found"));
        documentRepository.delete(doc);
    }

    @Transactional(readOnly = true)
    public boolean hasReadyDocuments(String userId) {
        return documentRepository.existsByUserIdAndStatus(userId, DocumentStatus.READY);
    }
}
