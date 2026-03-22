package dev.stanbook.io;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.stanbook.ir.source.SourceNotes;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public final class SourceNotesReader {
    private final ObjectMapper objectMapper = new ObjectMapper();

    public SourceNotes readIfPresent(Path htmlPath) {
        Path notesPath = siblingNotesPath(htmlPath);
        if (!Files.exists(notesPath)) {
            return null;
        }
        try {
            return objectMapper.readValue(notesPath.toFile(), SourceNotes.class);
        } catch (IOException exception) {
            throw new IllegalArgumentException("Could not read notes file: " + notesPath, exception);
        }
    }

    private Path siblingNotesPath(Path htmlPath) {
        String fileName = htmlPath.getFileName().toString();
        if (fileName.endsWith(".html")) {
            return htmlPath.resolveSibling(fileName.substring(0, fileName.length() - 5) + ".notes.json");
        }
        if (fileName.endsWith(".htm")) {
            return htmlPath.resolveSibling(fileName.substring(0, fileName.length() - 4) + ".notes.json");
        }
        return htmlPath.resolveSibling(fileName + ".notes.json");
    }
}
