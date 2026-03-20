package dev.stanbook.ir.html;

import java.util.List;

public record HtmlNormalizedDocument(
    List<HtmlHeaderLine> headerLines,
    List<HtmlOpinionBlock> opinionBlocks,
    Integer footnotesHeadingLine,
    List<HtmlFootnote> footnotes
) {}
