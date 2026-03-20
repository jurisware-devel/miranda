package dev.stanbook.ir.section;

import dev.stanbook.ir.source.SourceDocument;
import java.util.List;
import java.util.Optional;

public record SectionedDocument(
    SourceDocument source,
    List<DocumentSection> sections
) {
    public Optional<DocumentSection> section(SectionType type) {
        return sections.stream().filter(section -> section.type() == type).findFirst();
    }
}
