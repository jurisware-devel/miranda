package dev.stanbook.io;

import dev.stanbook.ir.html.HtmlFootnote;
import dev.stanbook.ir.html.HtmlHeadnote;
import dev.stanbook.ir.html.HtmlHeaderLine;
import dev.stanbook.ir.html.HtmlLabeledBlock;
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
import java.util.Locale;
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
        "^(?:Chief Judge\\s+[A-Z][A-Za-z.' -]+|(?:[A-Z][A-Za-z.' -]+|[A-Z][A-Z.' -]+)(?:,\\s*(?:[A-Z][A-Za-z.' -]+|[A-Z][A-Z.' -]+))*(?:\\s+and\\s+(?:[A-Z][A-Za-z.' -]+|[A-Z][A-Z.' -]+))?,\\s+(?:J\\.|JJ\\.|Chief Judge))(?:\\s*\\([^)]*\\))?[.:]?$"
    );
    private static final Pattern PANEL_SUMMARY_LINE_PATTERN = Pattern.compile(
        "^(?:Chief Judge\\b|Judge\\b|Judges\\b).*(?:\\band\\s+Judges\\b|\\bconcur\\b|\\bconcurs\\b|\\bdissent\\b|\\bdissents\\b|\\bvotes\\s+to\\b).*$",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern SUBHEADER_PATTERN = Pattern.compile(
        "^(?:[IVXLC]+\\.|[A-Z]\\.|\\d+\\.)$"
    );
    private static final Pattern OPINION_START_PATTERN = Pattern.compile(
        "^(?:OPINION OF THE COURT|Memorandum[.:]?|Per Curiam\\.?)$",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern OFFICIAL_PAGE_MARKER_PATTERN = Pattern.compile(
        "\\{\\*\\*(?<citation>\\d+\\s+(?:NY2d|NY3d|AD2d|AD3d|Misc(?:\\s+2d|\\s+3d)?)\\s+at\\s+\\d+)\\}"
    );
    private static final Pattern AVAILABLE_AT_URL_PATTERN = Pattern.compile(
        "(?i)(?<prefix>\\bavailable\\s+at\\s+)(?<url>https?://\\S+)"
    );
    private static final Pattern STRUCTURAL_OPINION_HEADING_PATTERN = Pattern.compile(
        "^(?<role>.+?)\\s+opinion\\s+by\\s+(?<author>.+?)\\.?$",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern LEADING_ROLE_ANNOTATION_PATTERN = Pattern.compile(
        "^\\((?<role>[^)]+)\\)\\.(?<rest>\\s*.*)$"
    );

    public SourceDocument load(Path path, String rawHtml) {
        Document document = Jsoup.parse(rawHtml);
        LineAccumulator accumulator = new LineAccumulator();

        List<HtmlHeaderLine> headerLines = extractHeaderLines(document, accumulator);
        List<HtmlLabeledBlock> summarySections = extractSummarySections(document, accumulator);
        List<HtmlHeadnote> headnotes = extractHeadnotes(document, accumulator);
        List<HtmlLabeledBlock> pointsOfCounsel = extractPointsOfCounsel(document, accumulator);
        List<HtmlOpinionBlock> opinionBlocks = extractOpinionBlocks(document, accumulator);
        List<Integer> fallbackOpinionLineNumbers = opinionBlocks.isEmpty()
            ? extractFallbackOpinionLines(document, accumulator)
            : List.of();
        FootnoteExtraction footnotes = extractFootnoteLines(document, rawHtml, accumulator);

        return new SourceDocument(
            path,
            List.copyOf(accumulator.lines()),
            new HtmlNormalizedDocument(
                List.copyOf(headerLines),
                List.copyOf(summarySections),
                List.copyOf(headnotes),
                List.copyOf(pointsOfCounsel),
                List.copyOf(opinionBlocks),
                List.copyOf(fallbackOpinionLineNumbers),
                footnotes.headingLine(),
                List.copyOf(footnotes.footnotes())
            )
        );
    }

    private List<HtmlHeaderLine> extractHeaderLines(Document document, LineAccumulator accumulator) {
        List<HtmlHeaderLine> headerLines = new ArrayList<>();
        Element primaryHeaderTable = document.selectFirst("table");
        addHeaderLinesFromTable(headerLines, accumulator, primaryHeaderTable);

        Element dateline = document.selectFirst("dateline");
        if (dateline != null) {
            addHeaderLine(headerLines, accumulator, renderInline(dateline));
        }

        Element body = document.body();
        if (body == null) {
            return List.copyOf(headerLines);
        }

        int opinionStartIndex = findTopLevelOpinionStartIndex(body);
        if (opinionStartIndex < 0) {
            return List.copyOf(headerLines);
        }

        for (int index = 0; index < opinionStartIndex; index++) {
            Node node = body.childNode(index);
            if (node instanceof TextNode textNode) {
                addHeaderLine(headerLines, accumulator, textNode.text());
                continue;
            }
            if (!(node instanceof Element element)) {
                continue;
            }
            String tag = element.tagName();
            if ("table".equalsIgnoreCase(tag)) {
                if (element != primaryHeaderTable) {
                    addHeaderLinesFromTable(headerLines, accumulator, element);
                }
                continue;
            }
            if ("div".equalsIgnoreCase(tag) || "p".equalsIgnoreCase(tag)) {
                addHeaderLine(headerLines, accumulator, renderInline(element));
            }
        }

        return List.copyOf(headerLines);
    }

    private List<HtmlLabeledBlock> extractSummarySections(Document document, LineAccumulator accumulator) {
        Element summary = document.selectFirst("summary");
        if (summary == null) {
            return List.of();
        }

        List<HtmlLabeledBlock> sections = new ArrayList<>();
        String currentLabel = null;
        for (Node child : summary.childNodes()) {
            if (child instanceof Element element && "stmcs".equalsIgnoreCase(element.tagName())) {
                String label = normalizeText(renderInline(element));
                currentLabel = label.isEmpty() ? null : label;
                continue;
            }

            HtmlLabeledBlock block = labeledBlockFromNode(accumulator, currentLabel, child, "summary");
            if (block != null) {
                sections.add(block);
            }
        }

        return List.copyOf(sections);
    }

    private List<HtmlHeadnote> extractHeadnotes(Document document, LineAccumulator accumulator) {
        Elements headnoteElements = document.select("headnote");
        if (headnoteElements.isEmpty()) {
            return List.of();
        }

        List<HtmlHeadnote> headnotes = new ArrayList<>();
        for (Element headnote : headnoteElements) {
            List<String> classifications = headnote.select("classification").stream()
                .map(this::renderInline)
                .map(this::normalizeText)
                .filter(text -> !text.isEmpty())
                .toList();

            for (Node child : headnote.childNodes()) {
                if (!(child instanceof Element element)) {
                    continue;
                }
                if ("classification".equalsIgnoreCase(element.tagName())) {
                    continue;
                }

                StructuredText structuredText = appendStructuredText(accumulator, renderInline(child));
                if (structuredText == null) {
                    continue;
                }

                headnotes.add(new HtmlHeadnote(
                    List.copyOf(classifications),
                    structuredText.text(),
                    structuredText.startLine(),
                    structuredText.endLine()
                ));
            }
        }

        return List.copyOf(headnotes);
    }

    private List<HtmlLabeledBlock> extractPointsOfCounsel(Document document, LineAccumulator accumulator) {
        Elements counselBlocks = document.select("counselblock");
        if (counselBlocks.isEmpty()) {
            return List.of();
        }

        List<HtmlLabeledBlock> points = new ArrayList<>();
        for (Element counselBlock : counselBlocks) {
            String label = counselBlock.children().stream()
                .filter(child -> "div".equalsIgnoreCase(child.tagName()))
                .map(this::renderInline)
                .map(this::normalizeText)
                .filter(text -> !text.isEmpty())
                .findFirst()
                .orElseGet(() -> {
                    String fallback = normalizeText(counselBlock.attr("type")).replace('_', ' ');
                    return fallback.isEmpty() ? "Counsel" : toTitleLabel(fallback);
                });
            for (Node child : counselBlock.childNodes()) {
                HtmlLabeledBlock block = labeledBlockFromNode(accumulator, label, child, "points of counsel");
                if (block != null) {
                    points.add(block);
                }
            }
        }

        return List.copyOf(points);
    }

    private void addHeaderLinesFromTable(List<HtmlHeaderLine> headerLines, LineAccumulator accumulator, Element table) {
        if (table == null) {
            return;
        }
        for (Element row : table.select("tr")) {
            Element cell = row.selectFirst("td");
            if (cell != null) {
                addHeaderLine(headerLines, accumulator, renderInline(cell));
            }
        }
    }

    private List<HtmlOpinionBlock> extractOpinionBlocks(Document document, LineAccumulator accumulator) {
        List<HtmlOpinionBlock> blocks = new ArrayList<>();
        Element body = document.body();
        if (body == null) {
            return List.of();
        }

        Elements contentNodes = body.select("sc, p, para, blockquote, div[align=center], conopnjd, disopjd");
        boolean inOpinion = false;
        for (Element element : contentNodes) {
            String tag = element.tagName();
            if ("sc".equalsIgnoreCase(tag) && !isStructuralAuthorMarkerNode(element)) {
                continue;
            }
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

            if (isStructuralOpinionHeadingNode(element)) {
                String authorMarker = structuralOpinionHeadingToAuthorMarker(element);
                if (authorMarker != null) {
                    addOpinionBlock(
                        blocks,
                        accumulator,
                        HtmlOpinionBlockType.AUTHOR_MARKER,
                        authorMarker,
                        null,
                        sourceTagFor(element),
                        opinionCategoryFor(element)
                    );
                }
                continue;
            }

            if ("p".equalsIgnoreCase(tag) || "para".equalsIgnoreCase(tag) || "blockquote".equalsIgnoreCase(tag)) {
                String rendered = renderInline(element);
                List<InlineNode> inlines = extractInlineNodes(element);
                if (splitLeadingAuthorMarker(blocks, accumulator, rendered, inlines, element)) {
                    continue;
                }
                addOpinionBlock(
                    blocks,
                    accumulator,
                    classifyOpinionBlockType(element, rendered),
                    rendered,
                    inlines,
                    sourceTagFor(element),
                    opinionCategoryFor(element)
                );
                continue;
            }
            if ("div".equalsIgnoreCase(tag)) {
                String rendered = renderInline(element);
                if (rendered.isBlank()) {
                    continue;
                }
                List<InlineNode> inlines = extractInlineNodes(element);
                if (splitLeadingAuthorMarker(blocks, accumulator, rendered, inlines, element)) {
                    continue;
                }
                addOpinionBlock(
                    blocks,
                    accumulator,
                    classifyOpinionBlockType(element, rendered),
                    rendered,
                    inlines,
                    sourceTagFor(element),
                    opinionCategoryFor(element)
                );
                continue;
            }
            if ("sc".equalsIgnoreCase(tag)) {
                addOpinionBlock(
                    blocks,
                    accumulator,
                    HtmlOpinionBlockType.AUTHOR_MARKER,
                    renderAuthorLine(element),
                    null,
                    sourceTagFor(element),
                    opinionCategoryFor(element)
                );
            }
        }

        accumulator.trimTrailingBlankLine();
        return List.copyOf(blocks);
    }

    private boolean isStructuralAuthorMarkerNode(Element element) {
        Element parent = element.parent();
        if (parent == null) {
            return false;
        }
        String parentTag = parent.tagName();
        return "body".equalsIgnoreCase(parentTag) || "opinion".equalsIgnoreCase(parentTag);
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
            List<Node> segmentNodes = new ArrayList<>();
            for (Node child : fragment.body().childNodes()) {
                if (isFootnoteBreak(child)) {
                    appendFootnoteSegment(accumulator, lineNumbers, segmentNodes);
                    segmentNodes.clear();
                    continue;
                }
                segmentNodes.add(child);
            }
            appendFootnoteSegment(accumulator, lineNumbers, segmentNodes);
            if (!lineNumbers.isEmpty()) {
                footnotes.add(new HtmlFootnote(label, List.copyOf(lineNumbers)));
            }
        }
        accumulator.trimTrailingBlankLine();
        return new FootnoteExtraction(headingLine, List.copyOf(footnotes));
    }

    private boolean isFootnoteBreak(Node node) {
        return node instanceof Element element && "br".equalsIgnoreCase(element.tagName());
    }

    private void appendFootnoteSegment(LineAccumulator accumulator, List<Integer> lineNumbers, List<Node> segmentNodes) {
        if (segmentNodes == null || segmentNodes.isEmpty()) {
            return;
        }

        String rendered = renderInline(segmentNodes);
        String normalized = normalizeText(rendered);
        if (normalized.isEmpty()) {
            return;
        }

        List<InlineNode> inlines = segmentNodes.stream()
            .flatMap(node -> extractInlineNodes(node).stream())
            .toList();
        lineNumbers.add(accumulator.addLine(normalized, normalizeInlineNodes(inlines)));
        accumulator.addBlankLine();
    }

    private List<Integer> extractFallbackOpinionLines(Document document, LineAccumulator accumulator) {
        Element body = document.body();
        if (body == null) {
            return List.of();
        }

        int startIndex = 0;
        for (int index = 0; index < body.childNodeSize(); index++) {
            Node node = body.childNode(index);
            if (node instanceof Element element && "table".equalsIgnoreCase(element.tagName())) {
                startIndex = index + 1;
            }
        }

        List<Integer> lineNumbers = new ArrayList<>();
        for (int index = startIndex; index < body.childNodeSize(); index++) {
            Node node = body.childNode(index);
            if (isFootnotesHeading(node)) {
                break;
            }
            if (node instanceof Element element) {
                String tag = element.tagName();
                if ("form".equalsIgnoreCase(tag) || "script".equalsIgnoreCase(tag) || "style".equalsIgnoreCase(tag)) {
                    break;
                }
            }
            addFallbackLines(lineNumbers, accumulator, renderInline(node));
        }

        accumulator.trimTrailingBlankLine();
        return List.copyOf(lineNumbers);
    }

    private int findTopLevelOpinionStartIndex(Element body) {
        for (int index = 0; index < body.childNodeSize(); index++) {
            if (!(body.childNode(index) instanceof Element element)) {
                continue;
            }
            if (isOpinionStartNode(element)) {
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

    private boolean isStructuralOpinionHeadingNode(Element element) {
        String tag = element.tagName();
        return "conopnjd".equalsIgnoreCase(tag) || "disopjd".equalsIgnoreCase(tag);
    }

    private boolean isOpinionStartNode(Element element) {
        if ("sc".equalsIgnoreCase(element.tagName())) {
            return true;
        }
        String normalized = normalizeText(renderInline(element));
        String withoutLeadingMarker = normalized.replaceFirst("^\\{\\*\\*[^}]+\\}\\s*", "");
        return OPINION_START_PATTERN.matcher(withoutLeadingMarker).matches()
            || isStandaloneAuthorMarker(withoutLeadingMarker);
    }

    private boolean splitLeadingAuthorMarker(
        List<HtmlOpinionBlock> blocks,
        LineAccumulator accumulator,
        String rendered,
        List<InlineNode> inlines,
        Element sourceElement
    ) {
        List<String> normalizedLines = normalizeIntoLines(rendered);
        if (normalizedLines.size() != 1) {
            return false;
        }

        String line = normalizedLines.getFirst();
        int splitIndex = leadingAuthorMarkerEnd(line);
        if (splitIndex < 0 || splitIndex >= line.length()) {
            return false;
        }

        String rawAuthorLine = line.substring(0, splitIndex).trim();
        String authorLine = rawAuthorLine;
        String remainder = line.substring(splitIndex).trim();
        if (!isStandaloneAuthorMarker(authorLine) || remainder.isEmpty()) {
            return false;
        }

        Matcher roleAnnotationMatcher = LEADING_ROLE_ANNOTATION_PATTERN.matcher(remainder);
        if (roleAnnotationMatcher.matches() && !authorLine.contains("(")) {
            authorLine = authorLine + " (" + roleAnnotationMatcher.group("role").trim() + ").";
            remainder = roleAnnotationMatcher.group("rest").trim();
        }

        String opinionCategory = opinionCategoryFor(sourceElement);
        if (opinionCategory != null && !authorLine.contains("(")) {
            authorLine = appendRoleAnnotation(authorLine, opinionCategory);
        }

        addOpinionBlock(
            blocks,
            accumulator,
            HtmlOpinionBlockType.AUTHOR_MARKER,
            authorLine,
            null,
            sourceTagFor(sourceElement),
            opinionCategory
        );
        if (!remainder.isEmpty()) {
            addOpinionBlock(
                blocks,
                accumulator,
                HtmlOpinionBlockType.PARAGRAPH,
                remainder,
                trimLeadingInlineText(inlines, inlineTrimLength(rawAuthorLine)),
                sourceTagFor(sourceElement),
                opinionCategory
            );
        }
        return true;
    }

    private int inlineTrimLength(String renderedText) {
        if (renderedText == null || renderedText.isEmpty()) {
            return 0;
        }
        // Inline nodes do not include the markdown asterisks we add while rendering emphasis.
        return renderedText.replace("*", "").length();
    }

    private int leadingAuthorMarkerEnd(String line) {
        int searchFromExclusive = line.length();
        while (searchFromExclusive > 0) {
            int candidate = previousSentenceBoundary(line, searchFromExclusive);
            if (candidate < 0) {
                return -1;
            }
            if (isStandaloneAuthorMarker(line.substring(0, candidate).trim())) {
                return candidate;
            }
            searchFromExclusive = candidate - 1;
        }
        return -1;
    }

    private int previousSentenceBoundary(String line, int fromIndexExclusive) {
        for (int index = fromIndexExclusive - 1; index >= 0; index--) {
            char c = line.charAt(index);
            if ((c == '.' || c == ':') && index + 1 < line.length() && Character.isWhitespace(line.charAt(index + 1))) {
                return index + 1;
            }
        }
        return -1;
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
        String authorLine = line.toString();
        String opinionCategory = opinionCategoryFor(scElement);
        if (opinionCategory != null && !authorLine.contains("(")) {
            return appendRoleAnnotation(authorLine, opinionCategory);
        }
        return authorLine;
    }

    private String structuralOpinionHeadingToAuthorMarker(Element element) {
        String normalized = normalizeText(renderInline(element));
        if (normalized.isEmpty()) {
            return null;
        }

        Matcher matcher = STRUCTURAL_OPINION_HEADING_PATTERN.matcher(normalized);
        if (!matcher.matches()) {
            return null;
        }

        String role = matcher.group("role").trim().toLowerCase();
        String author = matcher.group("author").trim().replaceFirst("\\.$", "");
        if (author.isEmpty()) {
            return null;
        }
        return author + " (" + role + ").";
    }

    private void addHeaderLine(List<HtmlHeaderLine> headerLines, LineAccumulator accumulator, String rendered) {
        for (String normalized : normalizeIntoLines(rendered)) {
            headerLines.add(new HtmlHeaderLine(accumulator.addLine(normalized), normalized));
        }
    }

    private HtmlLabeledBlock labeledBlockFromNode(
        LineAccumulator accumulator,
        String label,
        Node node,
        String containerName
    ) {
        if (!(node instanceof Element element)) {
            return null;
        }

        String tag = element.tagName().toLowerCase(Locale.ROOT);
        if ("div".equals(tag)) {
            String normalized = normalizeText(renderInline(element));
            if (normalized.equalsIgnoreCase(containerName.toUpperCase(Locale.ROOT))
                || normalized.equalsIgnoreCase(containerName)) {
                return null;
            }
        }

        StructuredText structuredText = appendStructuredText(accumulator, renderInline(element));
        if (structuredText == null) {
            return null;
        }

        return new HtmlLabeledBlock(label, structuredText.text(), structuredText.startLine(), structuredText.endLine());
    }

    private StructuredText appendStructuredText(LineAccumulator accumulator, String rendered) {
        List<String> normalizedLines = normalizeIntoLines(rendered);
        if (normalizedLines.isEmpty()) {
            return null;
        }

        Integer startLine = null;
        int endLine = -1;
        for (String normalized : normalizedLines) {
            int lineNumber = accumulator.addLine(normalized);
            if (startLine == null) {
                startLine = lineNumber;
            }
            endLine = lineNumber;
        }
        return new StructuredText(String.join(" ", normalizedLines), startLine, endLine);
    }

    private void addOpinionBlock(
        List<HtmlOpinionBlock> blocks,
        LineAccumulator accumulator,
        HtmlOpinionBlockType type,
        String rendered,
        List<InlineNode> inlines,
        String sourceTag,
        String opinionCategory
    ) {
        List<String> normalizedLines = normalizeIntoLines(rendered);
        if (normalizedLines.isEmpty()) {
            return;
        }
        for (int index = 0; index < normalizedLines.size(); index++) {
            String normalized = normalizedLines.get(index);
            if (!blocks.isEmpty()) {
                HtmlOpinionBlock previous = blocks.getLast();
                if (previous.type() == type
                    && previous.text().equals(normalized)
                    && java.util.Objects.equals(previous.sourceTag(), sourceTag)
                    && java.util.Objects.equals(previous.opinionCategory(), opinionCategory)) {
                    continue;
                }
            }
            List<InlineNode> lineInlines = index == 0 ? normalizeInlineNodes(inlines) : null;
            blocks.add(new HtmlOpinionBlock(type, accumulator.addLine(normalized, lineInlines), normalized, sourceTag, opinionCategory));
        }
        if (type == HtmlOpinionBlockType.PARAGRAPH || type == HtmlOpinionBlockType.BLOCK_QUOTE) {
            accumulator.addBlankLine();
        }
    }

    private void addFallbackLines(List<Integer> lineNumbers, LineAccumulator accumulator, String rendered) {
        List<String> normalizedLines = normalizeIntoLines(rendered);
        if (normalizedLines.isEmpty()) {
            return;
        }
        for (String normalized : normalizedLines) {
            lineNumbers.add(accumulator.addLine(normalized));
        }
        accumulator.addBlankLine();
    }

    private HtmlOpinionBlockType classifyOpinionBlockType(Element element, String rendered) {
        String normalized = normalizeText(rendered);
        String sourceTag = sourceTagFor(element);
        if ("blockquote".equalsIgnoreCase(element.tagName())
            || ("para".equalsIgnoreCase(element.tagName()) && "blocked".equalsIgnoreCase(element.attr("type")))) {
            return HtmlOpinionBlockType.BLOCK_QUOTE;
        }
        if (("conopnjd".equals(sourceTag) || "disopjd".equals(sourceTag))
            && isStandaloneAuthorMarker(normalized)) {
            return HtmlOpinionBlockType.PARAGRAPH;
        }
        if (isStandaloneAuthorMarker(normalized)) {
            return HtmlOpinionBlockType.AUTHOR_MARKER;
        }
        if ("centerhd".equalsIgnoreCase(sourceTag) || SUBHEADER_PATTERN.matcher(normalized).matches()) {
            return HtmlOpinionBlockType.SUBHEADER;
        }
        return HtmlOpinionBlockType.PARAGRAPH;
    }

    private String sourceTagFor(Element element) {
        if (element == null) {
            return null;
        }
        Element current = element;
        while (current != null && !"body".equalsIgnoreCase(current.tagName())) {
            String tag = current.tagName().toLowerCase(Locale.ROOT);
            if (isCustomStructureTag(tag)) {
                return tag;
            }
            current = current.parent();
        }
        return null;
    }

    private String opinionCategoryFor(Element element) {
        if (element == null) {
            return null;
        }
        Element opinion = element.closest("opinion");
        if (opinion == null) {
            return null;
        }
        String category = normalizeText(opinion.attr("category")).toLowerCase(Locale.ROOT);
        return category.isEmpty() ? null : category;
    }

    private boolean isCustomStructureTag(String tag) {
        return "para".equals(tag)
            || "centerhd".equals(tag)
            || "conopn".equals(tag)
            || "conopnjd".equals(tag)
            || "disop".equals(tag)
            || "disopjd".equals(tag)
            || "disconop".equals(tag)
            || "opinion".equals(tag);
    }

    private String appendRoleAnnotation(String authorLine, String opinionCategory) {
        String trimmed = authorLine == null ? "" : authorLine.trim();
        if (trimmed.isEmpty()) {
            return trimmed;
        }
        if (trimmed.endsWith(":")) {
            return trimmed.substring(0, trimmed.length() - 1) + " (" + opinionCategory + "):";
        }
        if (trimmed.endsWith(".")) {
            return trimmed.substring(0, trimmed.length() - 1) + " (" + opinionCategory + ").";
        }
        return trimmed + " (" + opinionCategory + ").";
    }

    private boolean isStandaloneAuthorMarker(String text) {
        String normalized = normalizeText(text);
        return AUTHOR_MARKER_PATTERN.matcher(normalized).matches()
            && !PANEL_SUMMARY_LINE_PATTERN.matcher(normalized).matches();
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
            int leadingWhitespace = 0;
            while (leadingWhitespace < content.length() && Character.isWhitespace(content.charAt(leadingWhitespace))) {
                leadingWhitespace++;
            }
            int trailingWhitespace = 0;
            while (trailingWhitespace < content.length() - leadingWhitespace
                && Character.isWhitespace(content.charAt(content.length() - 1 - trailingWhitespace))) {
                trailingWhitespace++;
            }

            String leading = content.substring(0, leadingWhitespace);
            String trailing = trailingWhitespace == 0 ? "" : content.substring(content.length() - trailingWhitespace);
            String core = content.substring(leadingWhitespace, content.length() - trailingWhitespace);
            return core.isEmpty() ? content : leading + "*" + core + "*" + trailing;
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
        children = linkifyAvailableAtUrls(children);
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

    private List<InlineNode> linkifyAvailableAtUrls(List<InlineNode> sourceNodes) {
        if (sourceNodes.isEmpty()) {
            return List.of();
        }

        List<InlineNode> nodes = new ArrayList<>();
        int index = 0;
        String overrideText = null;

        while (index < sourceNodes.size()) {
            InlineNode node = sourceNodes.get(index);
            if (!(node instanceof TextInline) && overrideText == null) {
                nodes.add(node);
                index++;
                continue;
            }

            String text = overrideText != null ? overrideText : ((TextInline) node).text();
            Matcher matcher = AVAILABLE_AT_URL_PATTERN.matcher(text);
            if (!matcher.find()) {
                if (!text.isEmpty()) {
                    nodes.add(new TextInline(text));
                }
                overrideText = null;
                index++;
                continue;
            }

            if (matcher.start() > 0) {
                nodes.add(new TextInline(text.substring(0, matcher.start())));
            }

            nodes.add(new TextInline(matcher.group("prefix")));
            UrlCollection collection = collectAvailableAtUrl(sourceNodes, index, text, matcher.start("url"));
            if (!collection.href().isEmpty() && !collection.children().isEmpty()) {
                nodes.add(new LinkInline(collection.href(), collection.children()));
            } else {
                nodes.add(new TextInline(text.substring(matcher.start("url"), matcher.end())));
            }

            overrideText = collection.trailingText();
            index = collection.resumeIndex();
        }

        return nodes.isEmpty() ? List.of() : List.copyOf(nodes);
    }

    private UrlCollection collectAvailableAtUrl(List<InlineNode> sourceNodes, int startIndex, String startText, int startOffset) {
        List<InlineNode> children = new ArrayList<>();
        StringBuilder href = new StringBuilder();
        int index = startIndex;
        String currentText = startText;
        int offset = startOffset;

        while (true) {
            String remaining = currentText.substring(offset);
            int whitespaceIndex = firstWhitespaceIndex(remaining);
            String consumed = whitespaceIndex >= 0 ? remaining.substring(0, whitespaceIndex) : remaining;
            if (!consumed.isEmpty()) {
                children.add(new TextInline(consumed));
                href.append(consumed);
            }
            if (whitespaceIndex >= 0) {
                return trimCollectedUrl(children, href, index, remaining.substring(whitespaceIndex));
            }

            while (true) {
                index++;
                if (index >= sourceNodes.size()) {
                    return trimCollectedUrl(children, href, index, "");
                }

                InlineNode next = sourceNodes.get(index);
                if (next instanceof PageMarkerInline pageMarkerInline) {
                    children.add(pageMarkerInline);
                    continue;
                }
                if (next instanceof TextInline nextTextInline) {
                    currentText = nextTextInline.text();
                    offset = 0;
                    break;
                }
                return trimCollectedUrl(children, href, index, "");
            }
        }
    }

    private UrlCollection trimCollectedUrl(
        List<InlineNode> children,
        StringBuilder href,
        int resumeIndex,
        String trailingText
    ) {
        String trailing = trailingText;

        while (!children.isEmpty()) {
            InlineNode last = children.getLast();
            if (!(last instanceof TextInline textInline) || textInline.text().isEmpty()) {
                break;
            }

            String text = textInline.text();
            char lastChar = text.charAt(text.length() - 1);
            if (!isTrailingUrlPunctuation(lastChar)) {
                break;
            }

            trailing = lastChar + trailing;
            href.setLength(Math.max(0, href.length() - 1));
            String shortened = text.substring(0, text.length() - 1);
            if (shortened.isEmpty()) {
                children.removeLast();
            } else {
                children.set(children.size() - 1, new TextInline(shortened));
            }
        }

        return new UrlCollection(
            children.isEmpty() ? List.of() : List.copyOf(children),
            href.toString(),
            resumeIndex,
            trailing
        );
    }

    private int firstWhitespaceIndex(String text) {
        for (int index = 0; index < text.length(); index++) {
            if (Character.isWhitespace(text.charAt(index))) {
                return index;
            }
        }
        return -1;
    }

    private boolean isTrailingUrlPunctuation(char c) {
        return c == '.'
            || c == ','
            || c == ';'
            || c == ':'
            || c == ')'
            || c == ']'
            || c == '>';
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

    private List<InlineNode> trimLeadingInlineText(List<InlineNode> inlines, int charactersToTrim) {
        if (inlines == null || inlines.isEmpty()) {
            return null;
        }

        TrimResult result = trimLeadingInlineText(inlines, Math.max(charactersToTrim, 0), false);
        return normalizeInlineNodes(result.nodes());
    }

    private TrimResult trimLeadingInlineText(List<InlineNode> inlines, int remainingToTrim, boolean trimLeadingWhitespace) {
        List<InlineNode> trimmed = new ArrayList<>();
        int remaining = remainingToTrim;
        boolean stripWhitespace = trimLeadingWhitespace;

        for (InlineNode node : inlines) {
            TrimResult result = trimLeadingInlineText(node, remaining, stripWhitespace);
            remaining = result.remainingToTrim();
            stripWhitespace = result.trimLeadingWhitespace();
            if (result.nodes() != null) {
                trimmed.addAll(result.nodes());
            }
        }

        return new TrimResult(trimmed.isEmpty() ? null : List.copyOf(trimmed), remaining, stripWhitespace);
    }

    private TrimResult trimLeadingInlineText(InlineNode node, int remainingToTrim, boolean trimLeadingWhitespace) {
        if (node instanceof TextInline textInline) {
            String text = textInline.text();
            int start = 0;

            while (remainingToTrim > 0 && start < text.length()) {
                start++;
                remainingToTrim--;
            }
            while (trimLeadingWhitespace && start < text.length() && Character.isWhitespace(text.charAt(start))) {
                start++;
            }

            boolean stillTrimLeadingWhitespace = trimLeadingWhitespace && start >= text.length();
            if (start >= text.length()) {
                return TrimResult.ofNodes(null, remainingToTrim, stillTrimLeadingWhitespace);
            }

            return TrimResult.ofNode(
                new TextInline(text.substring(start)),
                remainingToTrim,
                false
            );
        }

        if (node instanceof EmphasisInline emphasisInline) {
            TrimResult children = trimLeadingInlineText(emphasisInline.children(), remainingToTrim, trimLeadingWhitespace);
            if (children.nodes() == null || children.nodes().isEmpty()) {
                return new TrimResult(null, children.remainingToTrim(), children.trimLeadingWhitespace());
            }
            return TrimResult.ofNode(
                new EmphasisInline(children.nodes()),
                children.remainingToTrim(),
                children.trimLeadingWhitespace()
            );
        }

        if (node instanceof LinkInline linkInline) {
            TrimResult children = trimLeadingInlineText(linkInline.children(), remainingToTrim, trimLeadingWhitespace);
            if (children.nodes() == null || children.nodes().isEmpty()) {
                return new TrimResult(null, children.remainingToTrim(), children.trimLeadingWhitespace());
            }
            return TrimResult.ofNode(
                new LinkInline(linkInline.href(), children.nodes()),
                children.remainingToTrim(),
                children.trimLeadingWhitespace()
            );
        }

        if (remainingToTrim > 0) {
            return TrimResult.ofNodes(null, remainingToTrim, trimLeadingWhitespace);
        }

        return TrimResult.ofNode(node, remainingToTrim, trimLeadingWhitespace);
    }

    private List<InlineNode> normalizeInlineNodes(List<InlineNode> inlines) {
        if (inlines == null || inlines.isEmpty()) {
            return null;
        }
        List<InlineNode> normalizedNodes = new ArrayList<>();
        for (InlineNode node : inlines) {
            if (node instanceof TextInline textInline) {
                if (!textInline.text().isEmpty()) {
                    normalizedNodes.add(textInline);
                }
                continue;
            }
            if (node instanceof EmphasisInline emphasisInline) {
                List<InlineNode> normalizedChildren = normalizeInlineNodes(emphasisInline.children());
                if (normalizedChildren != null && !normalizedChildren.isEmpty()) {
                    normalizedNodes.add(new EmphasisInline(normalizedChildren));
                }
                continue;
            }
            if (node instanceof LinkInline linkInline) {
                List<InlineNode> normalizedChildren = normalizeInlineNodes(linkInline.children());
                if (normalizedChildren != null && !normalizedChildren.isEmpty()) {
                    normalizedNodes.add(new LinkInline(linkInline.href(), normalizedChildren));
                }
                continue;
            }
            normalizedNodes.add(node);
        }

        List<InlineNode> spacingNormalized = new ArrayList<>();
        for (int index = 0; index < normalizedNodes.size(); index++) {
            InlineNode node = normalizedNodes.get(index);
            if (node instanceof TextInline textInline && textInline.text().isBlank()) {
                Character previous = previousVisibleChar(normalizedNodes, index - 1);
                Character next = nextVisibleChar(normalizedNodes, index + 1);
                if (followsOpeningPunctuation(previous) || precedesClosingPunctuation(next)) {
                    continue;
                }
                spacingNormalized.add(new TextInline(" "));
                continue;
            }
            spacingNormalized.add(node);
        }

        String plainText = normalizeText(InlineNodes.plainText(spacingNormalized));
        if (plainText.isEmpty()) {
            return null;
        }
        return List.copyOf(spacingNormalized);
    }

    private Character previousVisibleChar(List<InlineNode> nodes, int index) {
        for (int cursor = index; cursor >= 0; cursor--) {
            Character candidate = lastVisibleChar(nodes.get(cursor));
            if (candidate != null) {
                return candidate;
            }
        }
        return null;
    }

    private Character nextVisibleChar(List<InlineNode> nodes, int index) {
        for (int cursor = index; cursor < nodes.size(); cursor++) {
            Character candidate = firstVisibleChar(nodes.get(cursor));
            if (candidate != null) {
                return candidate;
            }
        }
        return null;
    }

    private Character firstVisibleChar(InlineNode node) {
        if (node instanceof TextInline textInline) {
            return firstNonWhitespaceChar(textInline.text());
        }
        if (node instanceof EmphasisInline emphasisInline) {
            return firstVisibleChar(emphasisInline.children());
        }
        if (node instanceof LinkInline linkInline) {
            return firstVisibleChar(linkInline.children());
        }
        if (node instanceof FootnoteReferenceInline footnoteReferenceInline) {
            return footnoteReferenceInline.label().isEmpty() ? null : '[';
        }
        if (node instanceof PageMarkerInline pageMarkerInline) {
            return firstNonWhitespaceChar(pageMarkerInline.text());
        }
        return null;
    }

    private Character firstVisibleChar(List<InlineNode> nodes) {
        if (nodes == null) {
            return null;
        }
        for (InlineNode node : nodes) {
            Character candidate = firstVisibleChar(node);
            if (candidate != null) {
                return candidate;
            }
        }
        return null;
    }

    private Character lastVisibleChar(InlineNode node) {
        if (node instanceof TextInline textInline) {
            return lastNonWhitespaceChar(textInline.text());
        }
        if (node instanceof EmphasisInline emphasisInline) {
            return lastVisibleChar(emphasisInline.children());
        }
        if (node instanceof LinkInline linkInline) {
            return lastVisibleChar(linkInline.children());
        }
        if (node instanceof FootnoteReferenceInline footnoteReferenceInline) {
            return footnoteReferenceInline.label().isEmpty() ? null : ']';
        }
        if (node instanceof PageMarkerInline pageMarkerInline) {
            return lastNonWhitespaceChar(pageMarkerInline.text());
        }
        return null;
    }

    private Character lastVisibleChar(List<InlineNode> nodes) {
        if (nodes == null) {
            return null;
        }
        for (int index = nodes.size() - 1; index >= 0; index--) {
            Character candidate = lastVisibleChar(nodes.get(index));
            if (candidate != null) {
                return candidate;
            }
        }
        return null;
    }

    private Character firstNonWhitespaceChar(String text) {
        for (int index = 0; index < text.length(); index++) {
            char candidate = text.charAt(index);
            if (!Character.isWhitespace(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private Character lastNonWhitespaceChar(String text) {
        for (int index = text.length() - 1; index >= 0; index--) {
            char candidate = text.charAt(index);
            if (!Character.isWhitespace(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private boolean followsOpeningPunctuation(Character character) {
        return character != null && "([{\"'".indexOf(character) >= 0;
    }

    private boolean precedesClosingPunctuation(Character character) {
        return character != null && ".,;:!?)]}\"'".indexOf(character) >= 0;
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

    private String toTitleLabel(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String[] parts = text.trim().split("\\s+");
        List<String> titled = new ArrayList<>();
        for (String part : parts) {
            String lower = part.toLowerCase(Locale.ROOT);
            titled.add(Character.toUpperCase(lower.charAt(0)) + lower.substring(1));
        }
        return String.join(" ", titled);
    }

    private record FootnoteExtraction(
        Integer headingLine,
        List<HtmlFootnote> footnotes
    ) {}

    private record StructuredText(
        String text,
        int startLine,
        int endLine
    ) {}

    private record TrimResult(
        List<InlineNode> nodes,
        int remainingToTrim,
        boolean trimLeadingWhitespace
    ) {
        static TrimResult ofNodes(List<InlineNode> nodes, int remainingToTrim, boolean trimLeadingWhitespace) {
            return new TrimResult(nodes, remainingToTrim, trimLeadingWhitespace);
        }

        static TrimResult ofNode(InlineNode node, int remainingToTrim, boolean trimLeadingWhitespace) {
            return new TrimResult(node == null ? null : List.of(node), remainingToTrim, trimLeadingWhitespace);
        }
    }

    private record UrlCollection(
        List<InlineNode> children,
        String href,
        int resumeIndex,
        String trailingText
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
