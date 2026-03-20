package dev.stanbook.ir.render;

import dev.stanbook.ir.inline.InlineNode;
import java.util.List;

public record ReflowedBlock(
    BlockType type,
    String text,
    List<Integer> sourceLines,
    List<InlineNode> inlines,
    List<ReflowedBlock> blocks
) {
    public ReflowedBlock(
        BlockType type,
        String text,
        List<Integer> sourceLines
    ) {
        this(type, text, sourceLines, null, null);
    }

    public ReflowedBlock(
        BlockType type,
        String text,
        List<Integer> sourceLines,
        List<InlineNode> inlines
    ) {
        this(type, text, sourceLines, inlines, null);
    }
}
