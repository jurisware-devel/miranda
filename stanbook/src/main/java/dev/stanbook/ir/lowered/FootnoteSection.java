package dev.stanbook.ir.lowered;

import dev.stanbook.ir.source.SourceLine;
import dev.stanbook.ir.source.SourceRange;
import java.util.List;

public record FootnoteSection(
    Integer headingLine,
    List<Footnote> footnotes,
    List<SourceLine> trailingLines,
    SourceRange provenance
) {
    public FootnoteSection(
        Integer headingLine,
        List<Footnote> footnotes,
        List<SourceLine> trailingLines
    ) {
        this(headingLine, footnotes, trailingLines, deriveProvenance(headingLine, footnotes, trailingLines));
    }

    private static SourceRange deriveProvenance(
        Integer headingLine,
        List<Footnote> footnotes,
        List<SourceLine> trailingLines
    ) {
        if (headingLine != null) {
            int endLine = headingLine;
            if (!footnotes.isEmpty()) {
                endLine = footnotes.getLast().provenance().endLine();
            } else if (!trailingLines.isEmpty()) {
                endLine = trailingLines.getLast().lineNumber();
            }
            return new SourceRange(headingLine, endLine);
        }
        if (!footnotes.isEmpty()) {
            return new SourceRange(footnotes.getFirst().provenance().startLine(), footnotes.getLast().provenance().endLine());
        }
        if (!trailingLines.isEmpty()) {
            return new SourceRange(trailingLines.getFirst().lineNumber(), trailingLines.getLast().lineNumber());
        }
        return null;
    }
}
