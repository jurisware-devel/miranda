package dev.stanbook.reflow;

import dev.stanbook.ir.inline.InlineNode;
import dev.stanbook.ir.inline.InlineNodes;
import dev.stanbook.ir.lowered.OpinionBody;
import dev.stanbook.ir.lowered.OpinionComponent;
import dev.stanbook.ir.lowered.OpinionComponentType;
import dev.stanbook.ir.render.BlockType;
import dev.stanbook.ir.render.ReflowedBlock;
import dev.stanbook.ir.render.ReflowedOpinion;
import java.util.ArrayList;
import java.util.List;

public final class OpinionReflower {
    public ReflowedOpinion reflow(OpinionBody opinionBody) {
        List<ReflowedBlock> blocks = new ArrayList<>();
        for (int index = 0; index < opinionBody.components().size(); index++) {
            OpinionComponent component = opinionBody.components().get(index);
            if (component.type() == OpinionComponentType.BLOCK_QUOTE) {
                List<OpinionComponent> quoteComponents = new ArrayList<>();
                quoteComponents.add(component);
                while (index + 1 < opinionBody.components().size()
                    && opinionBody.components().get(index + 1).type() == OpinionComponentType.BLOCK_QUOTE) {
                    quoteComponents.add(opinionBody.components().get(++index));
                }
                blocks.add(reflowQuoteComponents(quoteComponents));
                continue;
            }
            blocks.addAll(reflowComponent(component));
        }
        return new ReflowedOpinion(List.copyOf(blocks));
    }

    List<ReflowedBlock> reflowComponent(OpinionComponent component) {
        if (component.type() == OpinionComponentType.SUBHEADER) {
            String text = component.lines().stream()
                .map(line -> leftAlignText(line.text()).strip())
                .filter(line -> !line.isEmpty())
                .reduce((left, right) -> left + "\n" + right)
                .orElse("");
            return List.of(new ReflowedBlock(
                BlockType.SUBHEADER,
                text,
                component.lines().stream().map(line -> line.lineNumber()).toList()
            ));
        }

        List<ReflowedBlock> paragraphs = new ArrayList<>();
        List<String> currentLines = new ArrayList<>();
        List<Integer> currentSourceLines = new ArrayList<>();
        List<List<InlineNode>> currentInlineLines = new ArrayList<>();

        for (var line : component.lines()) {
            String normalized = leftAlignText(line.text()).stripTrailing();
            if (normalized.isBlank()) {
                if (!currentLines.isEmpty()) {
                    paragraphs.add(new ReflowedBlock(
                        BlockType.PARAGRAPH,
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
                BlockType.PARAGRAPH,
                reflowParagraphLines(currentLines),
                List.copyOf(currentSourceLines),
                InlineNodes.joinLines(currentInlineLines)
            ));
        }

        return List.copyOf(paragraphs);
    }

    private ReflowedBlock reflowQuoteComponents(List<OpinionComponent> components) {
        List<Integer> sourceLines = new ArrayList<>();
        List<ReflowedBlock> childBlocks = new ArrayList<>();

        for (OpinionComponent component : components) {
            List<ReflowedBlock> paragraphs = reflowComponent(component);
            childBlocks.addAll(paragraphs);
            component.lines().stream()
                .map(line -> line.lineNumber())
                .forEach(sourceLines::add);
        }

        return new ReflowedBlock(
            BlockType.QUOTE,
            null,
            List.copyOf(sourceLines),
            null,
            List.copyOf(childBlocks)
        );
    }

    String leftAlignText(String text) {
        return text.stripLeading();
    }

    String reflowParagraphLines(List<String> lines) {
        return lines.stream()
            .map(String::strip)
            .filter(part -> !part.isEmpty())
            .reduce((left, right) -> left + " " + right)
            .orElse("");
    }
}
