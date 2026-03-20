package dev.stanbook.ir.inline;

import java.util.List;

public record EmphasisInline(List<InlineNode> children) implements InlineNode {}
