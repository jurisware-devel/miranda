package dev.stanbook.ir.html;

import java.util.List;

public record HtmlFootnote(
    String label,
    List<Integer> lineNumbers
) {}
