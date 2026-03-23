package dev.stanbook.ir.source;

import dev.stanbook.ir.html.HtmlNormalizedDocument;
import java.nio.file.Path;
import java.util.List;

public record SourceDocument(
    Path path,
    List<SourceLine> lines,
    HtmlNormalizedDocument htmlDocument
) {
    public SourceDocument(Path path, List<SourceLine> lines) {
        this(path, lines, null);
    }
}
