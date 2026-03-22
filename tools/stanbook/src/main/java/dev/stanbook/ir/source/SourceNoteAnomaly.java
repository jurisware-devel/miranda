package dev.stanbook.ir.source;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SourceNoteAnomaly(
    String code,
    String severity,
    String detail
) {}
