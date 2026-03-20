package dev.stanbook.ir.section;

import dev.stanbook.ir.source.SourceLine;
import dev.stanbook.ir.source.SourceRange;
import java.util.List;

public record DocumentSection(
    SectionType type,
    int startLine,
    int endLine,
    List<SourceLine> lines,
    SourceRange provenance
) {
    public DocumentSection(
        SectionType type,
        int startLine,
        int endLine,
        List<SourceLine> lines
    ) {
        this(type, startLine, endLine, lines, new SourceRange(startLine, endLine));
    }
}
