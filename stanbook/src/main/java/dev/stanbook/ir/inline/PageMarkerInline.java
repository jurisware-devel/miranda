package dev.stanbook.ir.inline;

public record PageMarkerInline(
    String text,
    String citation
) implements InlineNode {}
