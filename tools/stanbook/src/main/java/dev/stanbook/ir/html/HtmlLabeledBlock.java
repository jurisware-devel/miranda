package dev.stanbook.ir.html;

public record HtmlLabeledBlock(
    String label,
    String text,
    int startLine,
    int endLine
) {}
