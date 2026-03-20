package dev.stanbook.ir.lowered;

import dev.stanbook.ir.source.SourceLine;
import dev.stanbook.ir.source.SourceRange;
import java.util.List;

public record Footnote(
    String label,
    List<SourceLine> lines,
    int startLine,
    int endLine,
    SourceRange provenance
) {
    public Footnote(
        String label,
        List<SourceLine> lines,
        int startLine,
        int endLine
    ) {
        this(label, lines, startLine, endLine, new SourceRange(startLine, endLine));
    }
}
