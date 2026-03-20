package dev.stanbook.ir.lowered;

import dev.stanbook.ir.source.SourceLine;
import dev.stanbook.ir.source.SourceRange;
import java.util.List;

public record OpinionComponent(
    OpinionComponentType type,
    OpinionRole role,
    String author,
    boolean perCuriam,
    List<SourceLine> lines,
    int startLine,
    int endLine,
    SourceRange provenance
) {
    public OpinionComponent(
        OpinionComponentType type,
        OpinionRole role,
        String author,
        boolean perCuriam,
        List<SourceLine> lines,
        int startLine,
        int endLine
    ) {
        this(type, role, author, perCuriam, lines, startLine, endLine, new SourceRange(startLine, endLine));
    }
}
