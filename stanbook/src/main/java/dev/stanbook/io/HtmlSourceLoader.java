package dev.stanbook.io;

import dev.stanbook.ir.html.HtmlFootnote;
import dev.stanbook.ir.html.HtmlHeaderLine;
import dev.stanbook.ir.html.HtmlNormalizedDocument;
import dev.stanbook.ir.html.HtmlOpinionBlock;
import dev.stanbook.ir.html.HtmlOpinionBlockType;
import dev.stanbook.ir.inline.EmphasisInline;
import dev.stanbook.ir.inline.FootnoteReferenceInline;
import dev.stanbook.ir.inline.InlineNode;
import dev.stanbook.ir.inline.InlineNodes;
import dev.stanbook.ir.inline.LinkInline;
import dev.stanbook.ir.inline.PageMarkerInline;
import dev.stanbook.ir.inline.TextInline;
import dev.stanbook.ir.source.SourceDocument;
import dev.stanbook.ir.source.SourceLine;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;
import org.jsoup.parser.Parser;
import org.jsoup.select.Elements;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class HtmlSourceLoader {
    private static final Pattern FOOTNOTE_BLOCK_PATTERN = Pattern.compile(
        "(?is)<a\\s+name=\"(?<anchor>\\d+)FN\"[^>]*>\\s*<b>Footnote\\s+(?<label>[^:]+):</b>\\s*</a>(?<body>.*?)(?=<a\\s+name=\"\\d+FN\"|<form\\b|$)"
    );
    private static final Pattern FOOTNOTE_CASE_NAME_PATTERN = Pattern.compile("(?i)\\d+CASE");
    private static final Pattern AUTHOR_MARKER_PATTERN = Pattern.compile(
        "^(?:[A-Z][A-Za-z.' -]+|[A-Z][A-Z.' -]+),\\s+(?:J\\.|Chief Judge)(?:\\s*\\([^)]*\\))?:?$"
    );
    private static final Pattern SUBHEADER_PATTERN = Pattern.compile(
        "^(?:[IVXLC]+\\.|[A-Z]\\.|\\d+\\.)$"
    );
    private static final Pattern OPINION_START_PATTERN = Pattern.compile(
        "^(?:OPINION OF THE COURT|Memorandum\\.?|Per Curiam\\.?)$",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern OFFICIAL_PAGE_MARKER_PATTERN = Pattern.compile(
        "\\{\\*\\*(?<citation>\\d+\\s+(?:NY2d|NY3d|AD2d|AD3d|Misc(?:\\s+2d|\\s+3d)?)\\s+at\\s+\\d+)\\}"
    );

    public SourceDocument load(Path path, String rawHtml) {
        Document document = Jsoup.parse(rawHtml);
        LineAccumulator accumulator = new LineAccumulator();

        List<HtmlHeaderLine> headerLines = extractHeaderLines(document, accumulator);
        List<HtmlOpinionBlock> opinionBlocks = extractOpinionBlocks(document, accumulator);
        FootnoteExtraction footnotes = extractFootnoteLines(document, rawHtml, accumulator);

        return new SourceDocument(
            path,
            List.copyOf(accumulator.lines()),
            new HtmlNormalizedDocument(
                List.copyOf(headerLines),
                List.copyOf(opinionBlocks),
                footnotes.headingLine(),
                List.copyOf(footnotes.footnotes())
            )
        );
    }

    private List<HtmlHeaderLine> extractHeaderLines(Document document, LineAccumulator accumulator) {
        List<HtmlHeaderLine> headerLines = new ArrayList<>();
        Element table = document.selectFirst("table");
        if (table != null) {
            for (Element row : table.select("tr")) {
                Element cell = row.selectFirst("td");
                if (cell != null) {
                    addHeaderLine(headerLines, accumulator, renderInline(cell));
                }
            }
        }

        Element dateline = document.selectFirst("dateline");
        if (dateline != null) {
            addHeaderLine(headerLines, accumulator, renderInline(dateline));
        }

        Element body = document.body();
        if (body == null) {
            return List.copyOf(headerLines);
        }

        int authorIndex = findTopLevelAuthorIndex(body);
        if (authorIndex < 0) {
            return List.copyOf(headerLines);
        }

        for (int index = 0; index < authorIndex; index++) {
            Node node = body.childNode(index);
            if (node instanceof TextNode textNode) {
                addHeaderLine(headerLines, accumulator, textNode.text());
                continue;
            }
            if (!(node instanceof Element element)) {
                continue;
            }
            String tag = element.tagName();
            if ("div".equalsIgnoreCase(tag) || "p".equalsIgnoreCase(tag)) {
                addHeaderLine(headerLines, accumulator, renderInline(element));
            }
        }

        return List.copyOf(headerLines);
    }

    private List<HtmlOpinionBlock> extractOpinionBlocks(Document document, LineAccumulator accumulator) {
        List<HtmlOpinionBlock> blocks = new ArrayList<>();
        Element body = document.body();
        if (body == null) {
            return List.of();
        }

        Elements contentNodes = body.select("sc, p, blockquote, div[align=center]");
        boolean inOpinion = false;
        for (Element element : contentNodes) {
            if (!inOpinion) {
                if (isOpinionStartNode(element)) {
                    inOpinion = true;
                } else {
                    continue;
                }
            }
            if (isFootnotesHeading(element)) {
                break;
            }

            String tag = element.tagName();
            if ("p".equalsIgnoreCase(tag) || "blockquote".equalsIgnoreCase(tag)) {
                addOpinionBlock(
                    blocks,
                    accumulator,
                    classifyOpinionBlockType(element, renderInline(element)),
                    renderInline(element),
                    extractInlineNodes(element)
                );
                continue;
            }
            if ("div".equalsIgnoreCase(tag)) {
                String rendered = renderInline(element);
                if (rendered.isBlank()) {
                    continue;
                }
                addOpinionBlock(blocks, accumulator, classifyOpinionBlockType(element, rendered), rendered, extractInlineNodes(element));
                continue;
            }
            if ("sc".equalsIgnoreCase(tag)) {
                addOpinionBlock(blocks, accumulator, HtmlOpinionBlockType.AUTHOR_MARKER, renderAuthorLine(element), null);
            }
        }

        accumulator.trimTrailingBlankLine();
        return List.copyOf(blocks);
    }

    private FootnoteExtraction extractFootnoteLines(Document document, String rawHtml, LineAccumulator accumulator) {
        int footnotesStart = rawHtml.toLowerCase().indexOf("<div align=\"center\"><b>footnotes</b></div>");
        if (footnotesStart < 0) {
            footnotesStart = rawHtml.toLowerCase().indexOf("<div align=\"center\"><b>footnotes");
        }
        if (footnotesStart < 0) {
            return new FootnoteExtraction(null, List.of());
        }
        String footnotesHtml = rawHtml.substring(footnotesStart);
        Matcher matcher = FOOTNOTE_BLOCK_PATTERN.matcher(footnotesHtml);
        if (!matcher.find()) {
            return new FootnoteExtraction(null, List.of());
        }

        int headingLine = accumulator.addLine("Footnotes");
        accumulator.addBlankLine();
        List<HtmlFootnote> footnotes = new ArrayList<>();
        matcher.reset();
        while (matcher.find()) {
            String label = matcher.group("label").trim();
            Document fragment = Jsoup.parseBodyFragment(matcher.group("body"));
            List<Integer> lineNumbers = new ArrayList<>();
            boolean firstParagraph = true;
            for (Node child : fragment.body().childNodes()) {
                String rendered = renderInline(child);
                String normalized = normalizeText(rendered);
                if (normalized.isEmpty()) {
                    continue;
                }
                String prefix = firstParagraph ? "Footnote " + label + ": " : "";
                List<InlineNode> inlines = prependText(firstParagraph ? "Footnote " + label + ": " : "", extractInlineNodes(child));
                lineNumbers.add(accumulator.addLine(prefix + normalized, inlines));
                accumulator.addBlankLine();
                firstParagraph = false;
            }
            if (!lineNumbers.isEmpty()) {
                footnotes.add(new HtmlFootnote(label, List.copyOf(lineNumbers)));
            }
        }
        accumulator.trimTrailingBlankLine();
        return new FootnoteExtraction(headingLine, List.copyOf(footnotes));
    }

    private int findTopLevelAuthorIndex(Element body) {
        for (int index = 0; index < body.childNodeSize(); index++) {
            Node node = body.childNode(index);
            if (node instanceof Element element && "sc".equalsIgnoreCase(element.tagName())) {
                return index;
            }
        }
        return -1;
    }

    private boolean isFootnotesHeading(Node node) {
        if (!(node instanceof Element element) || !"div".equalsIgnoreCase(element.tagName())) {
            return false;
        }
        return normalizeText(renderInline(element)).equals("Footnotes");
    }

    private boolean isOpinionStartNode(Element element) {
        if ("sc".equalsIgnoreCase(element.tagName())) {
            return true;
        }
        String normalized = normalizeText(renderInline(element));
        String withoutLeadingMarker = normalized.replaceFirst("^\\{\\*\\*[^}]+\\}\\s*", "");
        return OPINION_START_PATTERN.matcher(withoutLeadingMarker).matches()
            || AUTHOR_MARKER_PATTERN.matcher(withoutLeadingMarker).matches();
    }

    private String renderAuthorLine(Element scElement) {
        StringBuilder line = new StringBuilder(scElement.text());
        for (Node sibling = scElement.nextSibling(); sibling != null; sibling = sibling.nextSibling()) {
            if (sibling instanceof TextNode textNode) {
                String text = textNode.text();
                line.append(text);
                if (text.contains("\n")) {
                    break;
                }
                continue;
            }
            if (sibling instanceof Element element) {
                if ("p".equalsIgnoreCase(element.tagName()) || "div".equalsIgnoreCase(element.tagName())) {
                    break;
                }
                line.append(renderInline(element));
            }
        }
        return line.toString();
    }

    private void addHeaderLine(List<HtmlHeaderLine> headerLines, LineAccumulator accumulator, String rendered) {
        for (String normalized : normalizeIntoLines(rendered)) {
            headerLines.add(new HtmlHeaderLine(accumulator.addLine(normalized), normalized));
        }
    }

    private void addOpinionBlock(
        List<HtmlOpinionBlock> blocks,
        LineAccumulator accumulator,
        HtmlOpinionBlockType type,
        String rendered,
        List<InlineNode> inlines
    ) {
        List<String> normalizedLines = normalizeIntoLines(rendered);
        if (normalizedLines.isEmpty()) {
            return;
        }
        for (int index = 0; index < normalizedLines.size(); index++) {
            String normalized = normalizedLines.get(index);
            List<InlineNode> lineInlines = index == 0 ? normalizeInlineNodes(inlines) : null;
            blocks.add(new HtmlOpinionBlock(type, accumulator.addLine(normalized, lineInlines), normalized));
        }
        if (type == HtmlOpinionBlockType.PARAGRAPH || type == HtmlOpinionBlockType.BLOCK_QUOTE) {
            accumulator.addBlankLine();
        }
    }

    private HtmlOpinionBlockType classifyOpinionBlockType(Element element, String rendered) {
        String normalized = normalizeText(rendered);
        if ("blockquote".equalsIgnoreCase(element.tagName())) {
            return HtmlOpinionBlockType.BLOCK_QUOTE;
        }
        if (AUTHOR_MARKER_PATTERN.matcher(normalized).matches()) {
            return HtmlOpinionBlockType.AUTHOR_MARKER;
        }
        if (SUBHEADER_PATTERN.matcher(normalized).matches()) {
            return HtmlOpinionBlockType.SUBHEADER;
        }
        return HtmlOpinionBlockType.PARAGRAPH;
    }

    private List<String> normalizeIntoLines(String rendered) {
        if (rendered == null) {
            return List.of();
        }
        List<String> normalizedLines = new ArrayList<>();
        String[] parts = rendered.split("\\R", -1);
        for (String part : parts) {
            String normalized = normalizeText(part);
            if (!normalized.isEmpty()) {
                normalizedLines.add(normalized);
            }
        }
        return normalizedLines;
    }

    private String renderInline(Node node) {
        if (node instanceof TextNode textNode) {
            return Parser.unescapeEntities(textNode.text(), false);
        }
        if (!(node instanceof Element element)) {
            return "";
        }

        String tag = element.tagName().toLowerCase();
        if ("br".equals(tag)) {
            return "\n";
        }
        if ("sup".equals(tag) && element.text().matches("\\[FN\\d+\\]")) {
            return "";
        }

        String content = element.childNodes().stream()
            .map(this::renderInline)
            .reduce("", String::concat);

        if ("i".equals(tag) || "em".equals(tag)) {
            return "*" + content.strip() + "*";
        }

        return content;
    }

    private String renderInline(List<Node> nodes) {
        return nodes.stream()
            .map(this::renderInline)
            .reduce("", String::concat);
    }

    private List<InlineNode> extractInlineNodes(Node node) {
        if (node instanceof TextNode textNode) {
            String normalized = normalizeTextFragment(Parser.unescapeEntities(textNode.text(), false));
            return textNodesFromFragment(normalized);
        }
        if (!(node instanceof Element element)) {
            return List.of();
        }

        String tag = element.tagName().toLowerCase();
        if ("br".equals(tag)) {
            return List.of();
        }
        if ("sup".equals(tag)) {
            String text = normalizeTextFragment(element.text());
            Matcher matcher = Pattern.compile("\\[FN(?<label>\\d+)\\]").matcher(text);
            if (matcher.matches()) {
                return List.of(new FootnoteReferenceInline(matcher.group("label")));
            }
            Element anchor = element.selectFirst("a[name]");
            if (anchor != null) {
                String name = anchor.attr("name");
                if (FOOTNOTE_CASE_NAME_PATTERN.matcher(name).matches()) {
                    return List.of();
                }
            }
            return List.of();
        }

        List<InlineNode> children = element.childNodes().stream()
            .flatMap(child -> extractInlineNodes(child).stream())
            .toList();
        if (children.isEmpty()) {
            return List.of();
        }

        if ("i".equals(tag) || "em".equals(tag)) {
            return List.of(new EmphasisInline(List.copyOf(children)));
        }
        if ("a".equals(tag) && element.hasAttr("href")) {
            return List.of(new LinkInline(element.attr("href"), List.copyOf(children)));
        }
        return children;
    }

    private List<InlineNode> textNodesFromFragment(String normalized) {
        if (normalized.isEmpty()) {
            return List.of();
        }

        List<InlineNode> nodes = new ArrayList<>();
        Matcher matcher = OFFICIAL_PAGE_MARKER_PATTERN.matcher(normalized);
        int index = 0;
        while (matcher.find()) {
            if (matcher.start() > index) {
                String prefix = normalized.substring(index, matcher.start());
                if (!prefix.isEmpty()) {
                    nodes.add(new TextInline(prefix));
                }
            }
            nodes.add(new PageMarkerInline(matcher.group(), matcher.group("citation")));
            index = matcher.end();
        }
        if (index < normalized.length()) {
            String suffix = normalized.substring(index);
            if (!suffix.isEmpty()) {
                nodes.add(new TextInline(suffix));
            }
        }
        return nodes.isEmpty() ? List.of() : List.copyOf(nodes);
    }

    private List<InlineNode> prependText(String prefix, List<InlineNode> inlines) {
        List<InlineNode> nodes = new ArrayList<>();
        if (prefix != null && !prefix.isEmpty()) {
            nodes.add(new TextInline(prefix));
        }
        if (inlines != null) {
            nodes.addAll(inlines);
        }
        return nodes.isEmpty() ? null : List.copyOf(nodes);
    }

    private List<InlineNode> normalizeInlineNodes(List<InlineNode> inlines) {
        if (inlines == null || inlines.isEmpty()) {
            return null;
        }
        String plainText = normalizeText(InlineNodes.plainText(inlines));
        if (plainText.isEmpty()) {
            return null;
        }
        return inlines;
    }

    private String normalizeText(String text) {
        String normalized = Parser.unescapeEntities(text, false);
        normalized = normalized.replace("\u00a0", " ");
        normalized = normalized.replace("\uFFFD", "-");
        normalized = normalized.replaceAll("\\[\\*\\d+\\]", "");
        normalized = normalized.replaceAll("[ \\t]+", " ").trim();
        return normalized;
    }

    private String normalizeTextFragment(String text) {
        String normalized = Parser.unescapeEntities(text, false);
        normalized = normalized.replace("\u00a0", " ");
        normalized = normalized.replace("\uFFFD", "-");
        normalized = normalized.replaceAll("\\[\\*\\d+\\]", "");
        normalized = normalized.replaceAll("[ \\t]+", " ");
        return normalized;
    }

    private record FootnoteExtraction(
        Integer headingLine,
        List<HtmlFootnote> footnotes
    ) {}

    private static final class LineAccumulator {
        private final List<SourceLine> lines = new ArrayList<>();

        List<SourceLine> lines() {
            return lines;
        }

        int addLine(String text) {
            return addLine(text, null);
        }

        int addLine(String text, List<InlineNode> inlines) {
            if (text.isEmpty() && !lines.isEmpty() && lines.getLast().text().isEmpty()) {
                return lines.getLast().lineNumber();
            }
            lines.add(new SourceLine(lines.size() + 1, text, inlines));
            return lines.getLast().lineNumber();
        }

        void addBlankLine() {
            addLine("");
        }

        void trimTrailingBlankLine() {
            while (!lines.isEmpty() && lines.getLast().text().isEmpty()) {
                lines.removeLast();
            }
        }
    }
}
