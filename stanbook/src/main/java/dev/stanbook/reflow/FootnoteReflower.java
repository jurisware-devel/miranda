package dev.stanbook.reflow;

import dev.stanbook.ir.inline.InlineNode;
import dev.stanbook.ir.inline.InlineNodes;
import dev.stanbook.ir.lowered.Footnote;
import dev.stanbook.ir.lowered.FootnoteSection;
import dev.stanbook.ir.render.BlockType;
import dev.stanbook.ir.render.ReflowedBlock;
import dev.stanbook.ir.render.ReflowedFootnotes;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class FootnoteReflower {
    public ReflowedFootnotes reflow(FootnoteSection footnotes) {
        Map<Integer, List<ReflowedBlock>> blocksByStartLine = new LinkedHashMap<>();
        for (Footnote footnote : footnotes.footnotes()) {
            blocksByStartLine.put(footnote.startLine(), reflowFootnote(footnote));
        }
        return new ReflowedFootnotes(Map.copyOf(blocksByStartLine));
    }

    List<ReflowedBlock> reflowFootnote(Footnote footnote) {
        List<ReflowedBlock> paragraphs = new ArrayList<>();
        List<String> currentLines = new ArrayList<>();
        List<Integer> currentSourceLines = new ArrayList<>();
        List<List<InlineNode>> currentInlineLines = new ArrayList<>();

        for (var line : footnote.lines()) {
            String normalized = leftAlignText(line.text()).stripTrailing();
            if (normalized.isBlank()) {
                if (!currentLines.isEmpty()) {
                    paragraphs.add(new ReflowedBlock(
                        BlockType.FOOTNOTE_PARAGRAPH,
                        reflowParagraphLines(currentLines),
                        List.copyOf(currentSourceLines),
                        InlineNodes.joinLines(currentInlineLines)
                    ));
                    currentLines = new ArrayList<>();
                    currentSourceLines = new ArrayList<>();
                    currentInlineLines = new ArrayList<>();
                }
                continue;
            }
            currentLines.add(normalized);
            currentSourceLines.add(line.lineNumber());
            currentInlineLines.add(line.inlines());
        }

        if (!currentLines.isEmpty()) {
            paragraphs.add(new ReflowedBlock(
                BlockType.FOOTNOTE_PARAGRAPH,
                reflowParagraphLines(currentLines),
                List.copyOf(currentSourceLines),
                InlineNodes.joinLines(currentInlineLines)
            ));
        }

        return List.copyOf(paragraphs);
    }

    private String leftAlignText(String text) {
        return text.stripLeading();
    }

    private String reflowParagraphLines(List<String> lines) {
        return lines.stream()
            .map(String::strip)
            .filter(part -> !part.isEmpty())
            .reduce((left, right) -> left + " " + right)
            .orElse("");
    }
}
