package dev.stanbook.ir.html;

import java.util.List;

public record HtmlNormalizedDocument(
    List<HtmlHeaderLine> headerLines,
    List<HtmlLabeledBlock> summarySections,
    List<HtmlHeadnote> headnotes,
    List<HtmlLabeledBlock> pointsOfCounsel,
    List<HtmlOpinionBlock> opinionBlocks,
    List<Integer> fallbackOpinionLineNumbers,
    Integer footnotesHeadingLine,
    List<HtmlFootnote> footnotes
) {}
