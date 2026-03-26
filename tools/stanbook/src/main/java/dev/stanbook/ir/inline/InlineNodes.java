package dev.stanbook.ir.inline;

import java.util.ArrayList;
import java.util.List;

public final class InlineNodes {
    private InlineNodes() {}

    public static List<InlineNode> joinLines(List<List<InlineNode>> lines) {
        List<InlineNode> joined = new ArrayList<>();
        boolean first = true;
        for (List<InlineNode> line : lines) {
            if (line == null || line.isEmpty()) {
                continue;
            }
            if (!first) {
                joined.add(new TextInline(" "));
            }
            joined.addAll(line);
            first = false;
        }
        return joined.isEmpty() ? null : List.copyOf(joined);
    }

    public static String plainText(List<InlineNode> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        appendPlainText(builder, nodes);
        return builder.toString();
    }

    public static List<List<InlineNode>> splitLines(List<InlineNode> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            return List.of();
        }
        List<List<InlineNode>> lines = new ArrayList<>();
        List<InlineNode> currentLine = new ArrayList<>();
        splitIntoLines(nodes, currentLine, lines);
        lines.add(currentLine.isEmpty() ? List.of() : List.copyOf(currentLine));
        return List.copyOf(lines);
    }

    private static void appendPlainText(StringBuilder builder, List<InlineNode> nodes) {
        for (InlineNode node : nodes) {
            if (node instanceof TextInline textInline) {
                builder.append(textInline.text());
            } else if (node instanceof EmphasisInline emphasisInline) {
                appendPlainText(builder, emphasisInline.children());
            } else if (node instanceof LinkInline linkInline) {
                appendPlainText(builder, linkInline.children());
            } else if (node instanceof FootnoteReferenceInline footnoteReferenceInline) {
                builder.append("[FN").append(footnoteReferenceInline.label()).append("]");
            } else if (node instanceof PageMarkerInline pageMarkerInline) {
                builder.append(pageMarkerInline.text());
            }
        }
    }

    private static void splitIntoLines(List<InlineNode> nodes, List<InlineNode> currentLine, List<List<InlineNode>> lines) {
        for (InlineNode node : nodes) {
            if (node instanceof TextInline textInline) {
                splitTextNode(textInline.text(), currentLine, lines);
            } else if (node instanceof EmphasisInline emphasisInline) {
                appendContainerLines(
                    emphasisInline.children(),
                    children -> new EmphasisInline(children),
                    currentLine,
                    lines
                );
            } else if (node instanceof LinkInline linkInline) {
                appendContainerLines(
                    linkInline.children(),
                    children -> new LinkInline(linkInline.href(), children),
                    currentLine,
                    lines
                );
            } else {
                currentLine.add(node);
            }
        }
    }

    private static void splitTextNode(String text, List<InlineNode> currentLine, List<List<InlineNode>> lines) {
        int index = 0;
        while (index <= text.length()) {
            int newline = text.indexOf('\n', index);
            if (newline < 0) {
                String fragment = text.substring(index);
                if (!fragment.isEmpty()) {
                    currentLine.add(new TextInline(fragment));
                }
                return;
            }

            String fragment = text.substring(index, newline);
            if (!fragment.isEmpty()) {
                currentLine.add(new TextInline(fragment));
            }
            lines.add(currentLine.isEmpty() ? List.of() : List.copyOf(currentLine));
            currentLine.clear();
            index = newline + 1;
        }
    }

    private static void appendContainerLines(
        List<InlineNode> children,
        java.util.function.Function<List<InlineNode>, InlineNode> wrapper,
        List<InlineNode> currentLine,
        List<List<InlineNode>> lines
    ) {
        List<List<InlineNode>> childLines = splitLines(children);
        if (childLines.isEmpty()) {
            return;
        }
        for (int index = 0; index < childLines.size(); index++) {
            List<InlineNode> childLine = childLines.get(index);
            if (!childLine.isEmpty()) {
                currentLine.add(wrapper.apply(childLine));
            }
            if (index + 1 < childLines.size()) {
                lines.add(currentLine.isEmpty() ? List.of() : List.copyOf(currentLine));
                currentLine.clear();
            }
        }
    }
}
