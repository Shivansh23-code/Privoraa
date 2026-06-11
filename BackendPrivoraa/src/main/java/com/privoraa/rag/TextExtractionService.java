package com.privoraa.rag;

import com.privoraa.common.ApiException;
import org.apache.tika.Tika;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

/** Extracts plain text from PDF / DOCX / TXT / MD uploads via Apache Tika. */
@Service
public class TextExtractionService {

    private final Tika tika = new Tika();

    public TextExtractionService() {
        tika.setMaxStringLength(5_000_000); // allow large documents
    }

    public String extract(byte[] data, String filename) {
        try (InputStream in = new ByteArrayInputStream(data)) {
            String text = tika.parseToString(in);
            return text == null ? "" : text.trim();
        } catch (Exception e) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Could not read \"" + filename + "\": " + e.getMessage());
        }
    }
}
