package dev.stanbook.ir.html;

import java.util.List;

public record HtmlHeadnote(
    List<String> classifications,
    String text,
    int startLine,
    int endLine
) {}
