package dev.stanbook.ir.source;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SourceNoteAppearance(
    String text,
    String sideGuess,
    String sentenceText
) {}
