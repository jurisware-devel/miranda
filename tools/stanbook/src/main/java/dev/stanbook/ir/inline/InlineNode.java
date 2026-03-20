package dev.stanbook.ir.inline;

public sealed interface InlineNode permits EmphasisInline, FootnoteReferenceInline, LinkInline, PageMarkerInline, TextInline {}
