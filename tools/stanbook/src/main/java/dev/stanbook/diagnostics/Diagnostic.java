package dev.stanbook.diagnostics;

public record Diagnostic(
    String code,
    Severity severity,
    String message,
    Integer lineNumber
) {}
