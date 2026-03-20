package dev.stanbook.ir.lowered;

import dev.stanbook.diagnostics.Diagnostic;
import dev.stanbook.ir.section.SectionedDocument;
import java.util.List;

public record LoweredDocument(
    SectionedDocument sectioned,
    Header header,
    OpinionBody opinionBody,
    FootnoteSection footnotes,
    PublicationStatus publicationStatus,
    List<Diagnostic> diagnostics
) {}
