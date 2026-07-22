package com.privoraa.rag;

import com.privoraa.auth.UserRepository;
import com.privoraa.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class DocumentServiceValidationTest {
    private final DocumentRepository documents = mock(DocumentRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final DocumentProcessor processor = mock(DocumentProcessor.class);
    private final DocumentService service = new DocumentService(documents, users, processor);

    @Test
    void rejectsUnsupportedArchiveWithoutProcessing() {
        MockMultipartFile zip = new MockMultipartFile("file", "archive.zip", "application/zip", new byte[]{1});
        assertThrows(ApiException.class, () -> service.upload("user", zip));
        verifyNoInteractions(documents, processor);
    }

    @Test
    void rejectsMimeExtensionMismatch() {
        MockMultipartFile fakePdf = new MockMultipartFile("file", "notes.pdf", "application/x-msdownload", new byte[]{1});
        assertThrows(ApiException.class, () -> service.upload("user", fakePdf));
        verifyNoInteractions(documents, processor);
    }
}
