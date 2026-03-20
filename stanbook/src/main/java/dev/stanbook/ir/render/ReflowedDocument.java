package dev.stanbook.ir.render;

import dev.stanbook.ir.lowered.LoweredDocument;

public record ReflowedDocument(
    LoweredDocument lowered,
    ReflowedOpinion opinion,
    ReflowedFootnotes footnotes
) {}
