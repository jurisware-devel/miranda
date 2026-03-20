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
}
