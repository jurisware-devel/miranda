package dev.stanbook.ir.inline;

import java.util.List;

public record LinkInline(
    String href,
    List<InlineNode> children
) implements InlineNode {}
