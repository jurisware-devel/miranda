package dev.stanbook.ir.source;

import dev.stanbook.ir.inline.InlineNode;
import java.util.List;

public record SourceLine(
    int lineNumber,
    String text,
    List<InlineNode> inlines
) {
    public SourceLine(int lineNumber, String text) {
        this(lineNumber, text, null);
    }
}
