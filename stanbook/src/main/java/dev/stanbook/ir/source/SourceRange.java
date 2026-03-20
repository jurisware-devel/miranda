package dev.stanbook.ir.source;

public record SourceRange(
    int startLine,
    int endLine
) {
    public SourceRange {
        if (startLine <= 0) {
            throw new IllegalArgumentException("startLine must be positive");
        }
        if (endLine < startLine) {
            throw new IllegalArgumentException("endLine must be >= startLine");
        }
    }

    public static SourceRange singleLine(int lineNumber) {
        return new SourceRange(lineNumber, lineNumber);
    }
}
