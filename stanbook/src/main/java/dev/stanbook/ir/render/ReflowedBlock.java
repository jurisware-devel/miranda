package dev.stanbook.ir.render;

import dev.stanbook.ir.inline.InlineNode;
import java.util.List;

public record ReflowedBlock(
    BlockType type,
    String text,
    List<Integer> sourceLines,
    List<InlineNode> inlines
) {
    public ReflowedBlock(
        BlockType type,
        String text,
        List<Integer> sourceLines
    ) {
        this(type, text, sourceLines, null);
    }
}
