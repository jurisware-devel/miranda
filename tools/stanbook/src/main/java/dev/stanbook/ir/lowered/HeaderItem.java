package dev.stanbook.ir.lowered;

import dev.stanbook.ir.source.SourceLine;
import dev.stanbook.ir.source.SourceRange;

public record HeaderItem(
    HeaderItemType type,
    SourceLine line,
    SourceRange provenance
) {
    public HeaderItem(HeaderItemType type, SourceLine line) {
        this(type, line, SourceRange.singleLine(line.lineNumber()));
    }
}
