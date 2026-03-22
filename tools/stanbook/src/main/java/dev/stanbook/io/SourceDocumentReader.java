package dev.stanbook.io;

import dev.stanbook.ir.source.SourceDocument;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class SourceDocumentReader {
    private final HtmlSourceLoader htmlSourceLoader = new HtmlSourceLoader();
    private final SourceNotesReader sourceNotesReader = new SourceNotesReader();

    public SourceDocument read(Path path) {
        Path resolvedPath = resolveExistingPath(path);
        String lowerName = resolvedPath.getFileName().toString().toLowerCase();
        if (!lowerName.endsWith(".htm") && !lowerName.endsWith(".html")) {
            throw new IllegalArgumentException("Expected an .htm or .html file: " + resolvedPath);
        }
        SourceDocument source = htmlSourceLoader.load(resolvedPath, readWithFallback(resolvedPath));
        return new SourceDocument(
            source.path(),
            source.lines(),
            source.htmlDocument(),
            sourceNotesReader.readIfPresent(resolvedPath)
        );
    }

    private Path resolveExistingPath(Path path) {
        if (Files.exists(path)) {
            return path;
        }
        if (path.getNameCount() >= 2 && "samples".equals(path.getName(0).toString())) {
            for (int up = 0; up <= 3; up++) {
                Path base = Path.of("");
                for (int index = 0; index < up; index++) {
                    base = base.resolve("..");
                }
                Path candidate = base.resolve(Path.of(
                    "opinions",
                    "coa",
                    opinionYear(path.getFileName().toString()),
                    path.getFileName().toString()
                )).normalize();
                if (Files.exists(candidate)) {
                    return candidate;
                }
            }
        }
        return path;
    }

    private String opinionYear(String fileName) {
        int underscore = fileName.indexOf('_');
        if (underscore > 0) {
            return fileName.substring(0, underscore);
        }
        return "";
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
