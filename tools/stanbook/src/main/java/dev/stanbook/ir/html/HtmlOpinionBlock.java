package dev.stanbook.ir.html;

public record HtmlOpinionBlock(
    HtmlOpinionBlockType type,
    int lineNumber,
    String text,
    String sourceTag,
    String opinionCategory
) {}
