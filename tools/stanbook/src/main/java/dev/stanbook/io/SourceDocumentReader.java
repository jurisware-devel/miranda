package dev.stanbook.io;

import dev.stanbook.ir.source.SourceDocument;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class SourceDocumentReader {
    private final HtmlSourceLoader htmlSourceLoader = new HtmlSourceLoader();

    public SourceDocument read(Path path) {
        String lowerName = path.getFileName().toString().toLowerCase();
        if (!lowerName.endsWith(".htm") && !lowerName.endsWith(".html")) {
            throw new IllegalArgumentException("Expected an .htm or .html file: " + path);
        }
        return htmlSourceLoader.load(path, readWithFallback(path));
    }

    private String readWithFallback(Path path) {
        try {
            return Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException utf8Failure) {
            try {
                return Files.readString(path, Charset.forName("windows-1252"));
            } catch (IOException cp1252Failure) {
                throw new IllegalArgumentException("Could not read file: " + path, cp1252Failure);
            }
        }
    }
}
