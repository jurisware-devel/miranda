package dev.stanbook.render.json;

import dev.stanbook.diagnostics.Diagnostic;
import dev.stanbook.ir.inline.EmphasisInline;
import dev.stanbook.ir.inline.FootnoteReferenceInline;
import dev.stanbook.ir.inline.InlineNode;
import dev.stanbook.ir.inline.LinkInline;
import dev.stanbook.ir.inline.PageMarkerInline;
import dev.stanbook.ir.inline.TextInline;
import dev.stanbook.ir.lowered.Footnote;
import dev.stanbook.ir.lowered.HeaderItemType;
import dev.stanbook.ir.lowered.OpinionComponent;
import dev.stanbook.ir.lowered.OpinionComponentType;
import dev.stanbook.ir.lowered.OpinionRole;
import dev.stanbook.ir.render.BlockType;
import dev.stanbook.ir.render.ReflowedBlock;
import dev.stanbook.ir.render.ReflowedDocument;
import dev.stanbook.ir.source.SourceDocument;
import dev.stanbook.ir.source.SourceLine;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class MirandaJsonRenderer {
    private static final Pattern SLIP_OP_PATTERN = Pattern.compile(
        "(?i)\\b\\d{4}\\s+NY\\s+Slip\\s+Op\\s+\\d+(?:\\(U\\))?\\b"
    );
    private static final Pattern OFFICIAL_CITATION_IN_BRACKETS_PATTERN = Pattern.compile("\\[(?<citation>[^\\]]+)\\]");
    private static final Pattern OFFICIAL_REPORTER_PATTERN = Pattern.compile(
        "\\b\\d+\\s+(?:NY2d|NY3d|AD2d|AD3d|Misc(?:\\s+2d|\\s+3d)?)\\s+\\d+\\b"
    );
    private static final Pattern OFFICIAL_PAGE_MARKER_PATTERN = Pattern.compile(
        "\\{\\*\\*(?<citation>\\d+\\s+(?:NY2d|NY3d|AD2d|AD3d|Misc(?:\\s+2d|\\s+3d)?)\\s+at\\s+\\d+)\\}"
    );
    private static final Pattern RECOGNIZED_CASE_TITLE_PATTERN = Pattern.compile(
        "^(?:Matter of\\s+.+\\s+v\\s+.+|People(?:\\s+ex\\s+rel\\.\\s+.+)?\\s+v\\s+.+|.+\\s+v\\s+.+)$",
        Pattern.CASE_INSENSITIVE
    );
    private static final DateTimeFormatter LONG_MONTH_DATE =
        DateTimeFormatter.ofPattern("MMMM d, uuuu", Locale.US);
    private static final Pattern DISPOSITION_ACTION_PATTERN = Pattern.compile(
        "(?i)\\b(order|judgment|appeal|motion|petition)\\b.*\\b(affirmed|reversed|modified|dismissed|vacated|remitted|adjudged|granted|denied)\\b"
    );
    private static final Pattern DISPOSITION_LEAD_PATTERN = Pattern.compile(
        "^(?:Accordingly,|On review of submissions|Order\\b|Judgment\\b|Appeal\\b|Motion\\b|Petition\\b).+",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern DISPOSITION_JUDGE_LINE_PATTERN = Pattern.compile(
        "^(?:Chief Judge\\b|Judge\\b|Judges\\b).*(?:concur|concurs|dissent|dissents|votes to).*$"
    );
    private static final Pattern DECIDED_LINE_PATTERN = Pattern.compile(
        "^(?:Decided(?: on)?\\s+)?(?<date>[A-Z][a-z]+\\s+\\d{1,2},\\s+\\d{4})$"
    );
    private static final Pattern DISPOSITION_OPINION_BY_SPLIT_PATTERN = Pattern.compile(
        "(?=\\bOpinion by\\b)",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern MAJORITY_JOINERS_PATTERN = Pattern.compile(
        "(?:(?<chief>Chief Judge\\s+[^;,.]+)\\s+and\\s+)?Judges\\s+(?<judges>.+?)\\s+concur(?:\\s+with\\s+Judge\\s+(?<withJudge>[^;,.]+))?",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern SINGLE_JUDGE_JOINER_PATTERN = Pattern.compile(
        "Judge\\s+(?<judge>[^;,.]+)\\s+concurs(?:\\s+in\\s+result)?(?:\\s+in\\s+an\\s+opinion)?(?:,\\s+in\\s+which\\s+(?<others>.+?)\\s+concur[s]?)?",
        Pattern.CASE_INSENSITIVE
    );

    public String render(SourceDocument source, ReflowedDocument document) {
        List<Writing> writings = buildWritings(document, null);
        TerminalSummary terminalSummary = extractTerminalSummary(source, document);
        if (terminalSummary == null) {
            terminalSummary = extractTerminalSummary(writings);
        }
        List<Writing> trimmedWritings = trimTerminalSummary(writings, terminalSummary);
        DispositionInfo disposition = buildDisposition(document, terminalSummary);
        List<Writing> writingsWithJoiners = attachJoiners(trimmedWritings, terminalSummary);
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("version", "0.1");
        root.put("documentType", "opinion");
        root.put("source", buildSource(source, document));
        root.put("header", buildHeader(document));
        root.put("appearances", buildAppearances(document));
        root.put("opinions", buildOpinions(writingsWithJoiners));
        root.put("footnotes", buildFootnotes(document));
        root.put("disposition", disposition == null ? null : disposition.json());
        root.put("renderingHints", buildRenderingHints(document, writingsWithJoiners));
        root.put("debug", buildDebug(source, document, writingsWithJoiners, disposition));
        return renderValue(root);
    }

    private Map<String, Object> buildSource(SourceDocument source, ReflowedDocument document) {
        Map<String, Object> sourceJson = new LinkedHashMap<>();
        sourceJson.put("kind", "lrb_html");
        sourceJson.put("caseId", caseIdFromPath(source));
        sourceJson.put("path", source.path().toString());
        sourceJson.put("publicationStatus", document.lowered().publicationStatus().name().toLowerCase(Locale.ROOT));
        return sourceJson;
    }

    private Map<String, Object> buildHeader(ReflowedDocument document) {
        CitationParts citationParts = extractCitationParts(firstHeaderValue(document, HeaderItemType.CITATION));
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("title", firstHeaderValue(document, HeaderItemType.CASE_NAME));
        header.put("slipOpinion", citationParts.slipOpinion());
        header.put("officialCitation", citationParts.officialCitation());
        header.put("court", firstHeaderValue(document, HeaderItemType.COURT));
        header.put("decisionDate", extractDecisionDate(document));
        return header;
    }

    private List<Map<String, Object>> buildAppearances(ReflowedDocument document) {
        List<Map<String, Object>> appearances = new ArrayList<>();
        for (var item : document.lowered().header().items()) {
            if (item.type() != HeaderItemType.COUNSEL) {
                continue;
            }
            Map<String, Object> appearance = new LinkedHashMap<>();
            appearance.put("side", inferAppearanceSide(item.line().text()));
            appearance.put("text", item.line().text());
            appearance.put("provenance", provenance(item.line().lineNumber(), item.line().lineNumber()));
            appearances.add(appearance);
        }
        return appearances;
    }

    private List<Map<String, Object>> buildOpinions(List<Writing> writings) {
        List<Map<String, Object>> opinions = new ArrayList<>();
        for (Writing writing : writings) {
            Map<String, Object> opinion = new LinkedHashMap<>();
            opinion.put("kind", writing.kind());
            opinion.put("author", writing.author());
            opinion.put("label", writing.label());
            opinion.put("joiners", writing.joiners());
            opinion.put("blocks", writing.blocks().stream().map(this::blockJson).toList());
            opinions.add(opinion);
        }
        return opinions;
    }

    private List<Map<String, Object>> buildFootnotes(ReflowedDocument document) {
        List<Map<String, Object>> footnotes = new ArrayList<>();
        for (Footnote footnote : document.lowered().footnotes().footnotes()) {
            Map<String, Object> footnoteJson = new LinkedHashMap<>();
            footnoteJson.put("label", footnote.label());
            List<ReflowedBlock> blocks = document.footnotes().blocksByStartLine().getOrDefault(footnote.startLine(), List.of());
            footnoteJson.put("blocks", blocks.stream().map(this::blockJson).toList());
            footnotes.add(footnoteJson);
        }
        return footnotes;
    }

    private Map<String, Object> buildRenderingHints(ReflowedDocument document, List<Writing> writings) {
        Map<String, Object> hints = new LinkedHashMap<>();
        hints.put("hasOfficialPageMarkers", document.lowered().publicationStatus().name().equals("PUBLISHED"));
        hints.put("hasAppearances", !buildAppearances(document).isEmpty());
        hints.put("hasFootnotes", !document.lowered().footnotes().footnotes().isEmpty());
        hints.put("hasSeparateOpinions", writings.size() > 1);
        return hints;
    }

    private Map<String, Object> buildDebug(SourceDocument source, ReflowedDocument document, List<Writing> writings, DispositionInfo disposition) {
        Map<String, Object> debug = new LinkedHashMap<>();
        List<Map<String, Object>> diagnostics = new ArrayList<>();
        for (Diagnostic diagnostic : document.lowered().diagnostics()) {
            diagnostics.add(diagnosticJson(diagnostic));
        }
        for (Diagnostic diagnostic : qaDiagnostics(source, document, writings, disposition)) {
            diagnostics.add(diagnosticJson(diagnostic));
        }
        debug.put("diagnostics", diagnostics);
        return debug;
    }

    private Map<String, Object> diagnosticJson(Diagnostic diagnostic) {
            Map<String, Object> diagnosticJson = new LinkedHashMap<>();
            diagnosticJson.put("severity", diagnostic.severity().name().toLowerCase(Locale.ROOT));
            diagnosticJson.put("code", diagnostic.code());
            diagnosticJson.put("message", diagnostic.message());
            diagnosticJson.put("lineNumber", diagnostic.lineNumber());
            return diagnosticJson;
    }

    private List<Diagnostic> qaDiagnostics(
        SourceDocument source,
        ReflowedDocument document,
        List<Writing> writings,
        DispositionInfo disposition
    ) {
        List<Diagnostic> diagnostics = new ArrayList<>();
        String title = firstHeaderValue(document, HeaderItemType.CASE_NAME);
        String firstHeaderLine = source.htmlDocument().headerLines().isEmpty()
            ? null
            : source.htmlDocument().headerLines().getFirst().text();
        Integer firstHeaderLineNumber = source.htmlDocument().headerLines().isEmpty()
            ? null
            : source.htmlDocument().headerLines().getFirst().lineNumber();

        if (title == null && firstHeaderLine != null && !firstHeaderLine.isBlank()) {
            diagnostics.add(new Diagnostic(
                "missing_case_title",
                dev.stanbook.diagnostics.Severity.WARNING,
                "Header title is missing from emitted JSON.",
                firstHeaderLineNumber
            ));
            if (RECOGNIZED_CASE_TITLE_PATTERN.matcher(firstHeaderLine).matches()) {
                diagnostics.add(new Diagnostic(
                    "case_title_extraction_failed",
                    dev.stanbook.diagnostics.Severity.WARNING,
                    "A likely case title was present in the source header but was not extracted into JSON.",
                    firstHeaderLineNumber
                ));
            }
        }

        String titleCandidate = title != null ? title : firstHeaderLine;
        if (titleCandidate != null && !titleCandidate.isBlank()
            && !RECOGNIZED_CASE_TITLE_PATTERN.matcher(titleCandidate).matches()) {
            diagnostics.add(new Diagnostic(
                "unrecognized_case_title_pattern",
                dev.stanbook.diagnostics.Severity.WARNING,
                "Case title does not match a recognized pattern.",
                firstHeaderLineNumber
            ));
        }

        if (extractDecisionDate(document) == null) {
            Integer lineNumber = document.lowered().header().items().stream()
                .filter(item -> item.type() == HeaderItemType.DECIDED_DATE || item.type() == HeaderItemType.DATE_OTHER)
                .map(item -> item.line().lineNumber())
                .findFirst()
                .orElse(firstHeaderLineNumber);
            diagnostics.add(new Diagnostic(
                "missing_decision_date",
                dev.stanbook.diagnostics.Severity.WARNING,
                "Decision date is missing from emitted JSON.",
                lineNumber
            ));
        }

        if (disposition == null && hasLikelyDispositionSourceLine(source)) {
            diagnostics.add(new Diagnostic(
                "missing_disposition",
                dev.stanbook.diagnostics.Severity.WARNING,
                "Disposition is missing from emitted JSON despite likely disposition text in the source.",
                likelyDispositionLineNumber(source)
            ));
        }

        if (writings.stream().anyMatch(writing -> writing.author() != null && writing.joiners().isEmpty())
            && hasLikelyJoinerSourceLine(source)) {
            diagnostics.add(new Diagnostic(
                "missing_joiners",
                dev.stanbook.diagnostics.Severity.INFO,
                "One or more opinions may be missing joiner information.",
                likelyJoinerLineNumber(source)
            ));
        }

        return List.copyOf(diagnostics);
    }

    private boolean hasLikelyDispositionSourceLine(SourceDocument source) {
        return source.lines().stream()
            .map(SourceLine::text)
            .map(String::trim)
            .anyMatch(this::isDispositionLine);
    }

    private Integer likelyDispositionLineNumber(SourceDocument source) {
        return source.lines().stream()
            .filter(line -> isDispositionLine(line.text().trim()))
            .map(SourceLine::lineNumber)
            .findFirst()
            .orElse(null);
    }

    private boolean hasLikelyJoinerSourceLine(SourceDocument source) {
        return source.lines().stream()
            .map(SourceLine::text)
            .map(String::trim)
            .anyMatch(text -> DISPOSITION_JUDGE_LINE_PATTERN.matcher(text).matches());
    }

    private Integer likelyJoinerLineNumber(SourceDocument source) {
        return source.lines().stream()
            .filter(line -> DISPOSITION_JUDGE_LINE_PATTERN.matcher(line.text().trim()).matches())
            .map(SourceLine::lineNumber)
            .findFirst()
            .orElse(null);
    }

    private List<Writing> buildWritings(ReflowedDocument document, TerminalSummary terminalSummary) {
        List<WritingAccumulator> accumulators = new ArrayList<>();
        WritingAccumulator current = null;
        String pendingLabel = null;

        for (OpinionComponent component : document.lowered().opinionBody().components()) {
            if (component.type() == OpinionComponentType.METADATA) {
                if (component.role() != OpinionRole.OPINION_BY) {
                    pendingLabel = joinComponentText(component);
                }
                continue;
            }
            if (component.type() == OpinionComponentType.SUBHEADER) {
                if (current != null) {
                    current.blocks.addAll(blocksForComponent(document, component));
                }
                continue;
            }

            if (current == null || !sameWriting(current, component)) {
                current = new WritingAccumulator(kindFor(component), component.author(), pendingLabel);
                accumulators.add(current);
            } else if (current.label == null && pendingLabel != null) {
                current.label = pendingLabel;
            }

            current.startLine = current.startLine == null ? component.startLine() : Math.min(current.startLine, component.startLine());
            current.endLine = current.endLine == null ? component.endLine() : Math.max(current.endLine, component.endLine());
            current.blocks.addAll(blocksForComponent(document, component));

            if (current.label == null && component.author() != null && component.type() != OpinionComponentType.MAJORITY) {
                current.label = defaultLabel(component);
            }
            pendingLabel = null;
        }

        return accumulators.stream()
            .map(acc -> new Writing(
                acc.kind,
                acc.author,
                acc.label,
                List.of(),
                trimTerminalSummaryBlocks(acc.blocks, terminalSummary)
            ))
            .toList();
    }

    private List<Writing> attachJoiners(
        List<Writing> writings,
        TerminalSummary terminalSummary
    ) {
        String joinerContext = joinerContext(terminalSummary);

        List<Writing> updated = new ArrayList<>();
        for (Writing writing : writings) {
            List<String> joiners = joinersForWriting(writing, joinerContext);
            updated.add(new Writing(writing.kind(), writing.author(), writing.label(), joiners, writing.blocks()));
        }
        return List.copyOf(updated);
    }

    private String joinerContext(TerminalSummary terminalSummary) {
        return terminalSummary == null ? "" : terminalSummary.text();
    }

    private boolean sameWriting(WritingAccumulator current, OpinionComponent component) {
        return current.kind.equals(kindFor(component))
            && java.util.Objects.equals(current.author, component.author());
    }

    private List<ReflowedBlock> blocksForComponent(ReflowedDocument document, OpinionComponent component) {
        return document.opinion().blocks().stream()
            .filter(block -> overlaps(component, block))
            .toList();
    }

    private boolean overlaps(OpinionComponent component, ReflowedBlock block) {
        if (block.sourceLines().isEmpty()) {
            return false;
        }
        int start = block.sourceLines().getFirst();
        int end = block.sourceLines().getLast();
        return !(end < component.startLine() || start > component.endLine());
    }

    private Map<String, Object> blockJson(ReflowedBlock block) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("type", switch (block.type()) {
            case PARAGRAPH -> "paragraph";
            case SUBHEADER -> "subheader";
            case FOOTNOTE_PARAGRAPH -> "paragraph";
        });
        json.put("inlines", blockInlines(block).stream().map(this::inlineJson).toList());
        json.put("provenance", provenance(block.sourceLines().getFirst(), block.sourceLines().getLast()));
        return json;
    }

    private List<InlineNode> blockInlines(ReflowedBlock block) {
        if (block.inlines() != null && !block.inlines().isEmpty()) {
            return block.inlines();
        }
        return inlineNodesFromText(block.text());
    }

    private Map<String, Object> inlineJson(InlineNode node) {
        Map<String, Object> json = new LinkedHashMap<>();
        if (node instanceof TextInline textInline) {
            json.put("type", "text");
            json.put("text", textInline.text());
        } else if (node instanceof EmphasisInline emphasisInline) {
            json.put("type", "emphasis");
            json.put("children", emphasisInline.children().stream().map(this::inlineJson).toList());
        } else if (node instanceof LinkInline linkInline) {
            json.put("type", "link");
            json.put("href", linkInline.href());
            json.put("children", linkInline.children().stream().map(this::inlineJson).toList());
        } else if (node instanceof FootnoteReferenceInline footnoteReferenceInline) {
            json.put("type", "footnote_reference");
            json.put("label", footnoteReferenceInline.label());
        } else if (node instanceof PageMarkerInline pageMarkerInline) {
            json.put("type", "page_marker");
            json.put("text", pageMarkerInline.text());
            json.put("citation", pageMarkerInline.citation());
        }
        return json;
    }

    private List<InlineNode> inlineNodesFromText(String text) {
        if (text == null || text.isEmpty()) {
            return List.of();
        }

        List<InlineNode> nodes = new ArrayList<>();
        Matcher matcher = OFFICIAL_PAGE_MARKER_PATTERN.matcher(text);
        int index = 0;
        while (matcher.find()) {
            if (matcher.start() > index) {
                nodes.add(new TextInline(text.substring(index, matcher.start())));
            }
            nodes.add(new PageMarkerInline(matcher.group(), matcher.group("citation")));
            index = matcher.end();
        }
        if (index < text.length()) {
            nodes.add(new TextInline(text.substring(index)));
        }
        return nodes.isEmpty() ? List.of(new TextInline(text)) : List.copyOf(nodes);
    }

    private Map<String, Object> provenance(int startLine, int endLine) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("startLine", startLine);
        json.put("endLine", endLine);
        return json;
    }

    private String firstHeaderValue(ReflowedDocument document, HeaderItemType type) {
        return document.lowered().header().items().stream()
            .filter(item -> item.type() == type)
            .map(item -> item.line().text())
            .findFirst()
            .orElse(null);
    }

    private CitationParts extractCitationParts(String citationText) {
        if (citationText == null || citationText.isBlank()) {
            return new CitationParts(null, null);
        }

        Matcher slipMatch = SLIP_OP_PATTERN.matcher(citationText);
        String slipOpinion = slipMatch.find() ? slipMatch.group().trim() : null;

        String officialCitation = null;
        Matcher bracketMatch = OFFICIAL_CITATION_IN_BRACKETS_PATTERN.matcher(citationText);
        while (bracketMatch.find()) {
            String candidate = bracketMatch.group("citation").trim();
            if (OFFICIAL_REPORTER_PATTERN.matcher(candidate).find()) {
                officialCitation = candidate;
                break;
            }
        }
        if (officialCitation == null && OFFICIAL_REPORTER_PATTERN.matcher(citationText).find()) {
            officialCitation = citationText.trim();
        }

        return new CitationParts(slipOpinion, officialCitation);
    }

    private String extractDecisionDate(ReflowedDocument document) {
        return document.lowered().header().items().stream()
            .filter(item -> item.type() == HeaderItemType.DECIDED_DATE || item.type() == HeaderItemType.DATE_OTHER)
            .map(item -> parseDecisionDate(item.line().text()))
            .filter(Objects::nonNull)
            .findFirst()
            .orElse(null);
    }

    private String parseDecisionDate(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher matcher = DECIDED_LINE_PATTERN.matcher(text.trim());
        if (!matcher.matches()) {
            return null;
        }
        try {
            LocalDate date = LocalDate.parse(matcher.group("date"), LONG_MONTH_DATE);
            return date.toString();
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private DispositionInfo buildDisposition(ReflowedDocument document, TerminalSummary terminalSummary) {
        Optional<DispositionInfo> headerAction = document.lowered().header().items().stream()
            .filter(item -> item.type() == HeaderItemType.ACTION)
            .findFirst()
            .map(item -> dispositionInfo(item.line().text(), item.line().lineNumber(), item.line().lineNumber()));
        if (headerAction.isPresent()) {
            return headerAction.get();
        }

        if (terminalSummary == null || terminalSummary.paragraphs().isEmpty()) {
            return null;
        }

        List<String> dispositionParagraphs = new ArrayList<>();
        for (String paragraph : terminalSummary.paragraphs()) {
            String stripped = paragraph.trim();
            if (stripped.isEmpty()) {
                if (!dispositionParagraphs.isEmpty()) {
                    break;
                }
                continue;
            }
            if (dispositionParagraphs.isEmpty()) {
                if (isDispositionActionLine(stripped)) {
                    dispositionParagraphs.add(stripped);
                }
                continue;
            }
            if (isDispositionTextContinuation(stripped)) {
                dispositionParagraphs.add(stripped);
                continue;
            }
            break;
        }

        if (dispositionParagraphs.isEmpty()) {
            return null;
        }

        String text = dispositionParagraphs.stream()
            .reduce((left, right) -> left + " " + right)
            .orElse(null);
        return dispositionInfo(text, terminalSummary.startLine(), terminalSummary.endLine());
    }

    private boolean isDispositionLine(String text) {
        return isDispositionActionLine(text) || DISPOSITION_JUDGE_LINE_PATTERN.matcher(text).matches();
    }

    private boolean isDispositionContinuation(String text) {
        return Character.isLowerCase(text.charAt(0))
            || text.startsWith("\"")
            || text.startsWith("(")
            || DISPOSITION_JUDGE_LINE_PATTERN.matcher(text).matches();
    }

    private boolean isDispositionActionLine(String text) {
        return DISPOSITION_LEAD_PATTERN.matcher(text).matches()
            || DISPOSITION_ACTION_PATTERN.matcher(text).find();
    }

    private boolean isDispositionTextContinuation(String text) {
        return Character.isLowerCase(text.charAt(0))
            || text.startsWith("\"")
            || text.startsWith("(");
    }

    private TerminalSummary extractTerminalSummary(SourceDocument source, ReflowedDocument document) {
        List<SourceLine> lines = source.lines();
        int upperBoundExclusive = document.lowered().sectioned().section(dev.stanbook.ir.section.SectionType.FOOTNOTES)
            .map(section -> section.startLine() - 1)
            .orElse(lines.size());

        List<SourceLine> collected = new ArrayList<>();
        int index = upperBoundExclusive - 1;
        while (index >= 0) {
            while (index >= 0 && lines.get(index).text().trim().isEmpty()) {
                index--;
            }
            if (index < 0) {
                break;
            }

            int paragraphEnd = index;
            while (index >= 0 && !lines.get(index).text().trim().isEmpty()) {
                index--;
            }
            int paragraphStart = index + 1;
            List<SourceLine> paragraph = lines.subList(paragraphStart, paragraphEnd + 1);
            if (!isTerminalSummaryParagraph(paragraph)) {
                break;
            }
            collected.addAll(0, paragraph);
        }

        if (collected.isEmpty()) {
            return null;
        }

        String text = collected.stream()
            .map(SourceLine::text)
            .map(String::trim)
            .reduce((left, right) -> left + " " + right)
            .orElse("");
        return new TerminalSummary(
            collected.stream()
                .map(SourceLine::text)
                .map(String::trim)
                .filter(line -> !line.isEmpty())
                .toList(),
            collected.getFirst().lineNumber(),
            collected.getLast().lineNumber(),
            text
        );
    }

    private boolean isTerminalSummaryLine(String text) {
        return isDispositionActionLine(text)
            || DISPOSITION_JUDGE_LINE_PATTERN.matcher(text).matches()
            || DECIDED_LINE_PATTERN.matcher(text).matches();
    }

    private boolean isTerminalSummaryContinuation(String text) {
        return isDispositionTextContinuation(text)
            || DISPOSITION_JUDGE_LINE_PATTERN.matcher(text).matches()
            || DECIDED_LINE_PATTERN.matcher(text).matches();
    }

    private boolean isTerminalSummaryParagraph(List<SourceLine> paragraph) {
        String text = paragraph.stream()
            .map(SourceLine::text)
            .map(String::trim)
            .filter(line -> !line.isEmpty())
            .reduce((left, right) -> left + " " + right)
            .orElse("");
        return !text.isEmpty() && isTerminalSummaryLine(text);
    }

    private List<ReflowedBlock> trimTerminalSummaryBlocks(List<ReflowedBlock> blocks, TerminalSummary terminalSummary) {
        if (terminalSummary == null) {
            return List.copyOf(blocks);
        }
        return blocks.stream()
            .filter(block -> !withinTerminalSummary(block, terminalSummary))
            .toList();
    }

    private boolean withinTerminalSummary(ReflowedBlock block, TerminalSummary terminalSummary) {
        if (block.sourceLines().isEmpty()) {
            return false;
        }
        int start = block.sourceLines().getFirst();
        int end = block.sourceLines().getLast();
        return start >= terminalSummary.startLine() && end <= terminalSummary.endLine();
    }

    private TerminalSummary extractTerminalSummary(List<Writing> writings) {
        if (writings.isEmpty()) {
            return null;
        }
        List<ReflowedBlock> blocks = writings.getLast().blocks();
        if (blocks.isEmpty()) {
            return null;
        }

        List<ReflowedBlock> collected = new ArrayList<>();
        for (int index = blocks.size() - 1; index >= 0; index--) {
            ReflowedBlock block = blocks.get(index);
            String text = blockText(block).trim();
            if (text.isEmpty()) {
                if (!collected.isEmpty()) {
                    break;
                }
                continue;
            }
            if (!isTerminalSummaryLine(text)) {
                break;
            }
            collected.addFirst(block);
        }

        if (collected.isEmpty()) {
            return null;
        }

        List<String> paragraphs = collected.stream()
            .map(this::blockText)
            .map(String::trim)
            .filter(text -> !text.isEmpty())
            .toList();
        String text = paragraphs.stream()
            .reduce((left, right) -> left + " " + right)
            .orElse("");
        return new TerminalSummary(
            paragraphs,
            collected.getFirst().sourceLines().getFirst(),
            collected.getLast().sourceLines().getLast(),
            text
        );
    }

    private List<Writing> trimTerminalSummary(List<Writing> writings, TerminalSummary terminalSummary) {
        if (terminalSummary == null || writings.isEmpty()) {
            return writings;
        }

        List<Writing> updated = new ArrayList<>(writings);
        Writing last = updated.getLast();
        updated.set(
            updated.size() - 1,
            new Writing(
                last.kind(),
                last.author(),
                last.label(),
                last.joiners(),
                trimTerminalSummaryBlocks(last.blocks(), terminalSummary)
            )
        );
        return List.copyOf(updated);
    }

    private String blockText(ReflowedBlock block) {
        return blockInlines(block).stream()
            .map(node -> {
                if (node instanceof TextInline textInline) {
                    return textInline.text();
                }
                if (node instanceof EmphasisInline emphasisInline) {
                    return emphasisInline.children().stream()
                        .filter(TextInline.class::isInstance)
                        .map(TextInline.class::cast)
                        .map(TextInline::text)
                        .reduce((left, right) -> left + right)
                        .orElse("");
                }
                if (node instanceof LinkInline linkInline) {
                    return linkInline.children().stream()
                        .map(this::inlineJsonText)
                        .reduce((left, right) -> left + right)
                        .orElse("");
                }
                if (node instanceof FootnoteReferenceInline footnoteReferenceInline) {
                    return footnoteReferenceInline.label();
                }
                if (node instanceof PageMarkerInline pageMarkerInline) {
                    return pageMarkerInline.text();
                }
                return "";
            })
            .reduce((left, right) -> left + right)
            .orElse("");
    }

    private String inlineJsonText(InlineNode node) {
        if (node instanceof TextInline textInline) {
            return textInline.text();
        }
        if (node instanceof EmphasisInline emphasisInline) {
            return emphasisInline.children().stream()
                .map(this::inlineJsonText)
                .reduce((left, right) -> left + right)
                .orElse("");
        }
        if (node instanceof LinkInline linkInline) {
            return linkInline.children().stream()
                .map(this::inlineJsonText)
                .reduce((left, right) -> left + right)
                .orElse("");
        }
        return "";
    }

    private DispositionInfo dispositionInfo(String text, int startLine, int endLine) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("text", text);
        json.put("parts", dispositionParts(text));
        json.put("provenance", provenance(startLine, endLine));
        return new DispositionInfo(text, json);
    }

    private List<Map<String, Object>> dispositionParts(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }

        String trimmed = text.trim();
        Matcher matcher = DISPOSITION_OPINION_BY_SPLIT_PATTERN.matcher(trimmed);
        if (!matcher.find()) {
            return List.of(dispositionPart("action", trimmed));
        }

        int splitIndex = matcher.start();
        String actionText = trimmed.substring(0, splitIndex).trim();
        String summaryText = trimmed.substring(splitIndex).trim();
        List<Map<String, Object>> parts = new ArrayList<>();
        if (!actionText.isEmpty()) {
            parts.add(dispositionPart("action", actionText));
        }
        if (!summaryText.isEmpty()) {
            parts.add(dispositionPart("summary", summaryText));
        }
        return List.copyOf(parts);
    }

    private Map<String, Object> dispositionPart(String type, String text) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("type", type);
        json.put("text", text);
        return json;
    }

    private List<String> joinersForWriting(Writing writing, String dispositionText) {
        if (dispositionText == null || dispositionText.isBlank()) {
            return List.of();
        }

        if ("majority".equals(writing.kind()) && writing.author() != null) {
            Matcher matcher = MAJORITY_JOINERS_PATTERN.matcher(dispositionText);
            while (matcher.find()) {
                String withJudge = matcher.group("withJudge");
                if (withJudge == null || normalizeJudgeName(withJudge).equals(normalizeJudgeName(writing.author()))) {
                    LinkedHashSet<String> joiners = new LinkedHashSet<>();
                    if (matcher.group("chief") != null) {
                        joiners.add(normalizeJudgePhrase(matcher.group("chief")));
                    }
                    joiners.addAll(parseJudgeList(matcher.group("judges")));
                    return List.copyOf(joiners);
                }
            }
        }

        if (writing.author() != null && ("concurrence".equals(writing.kind()) || "concurrence_in_result".equals(writing.kind()))) {
            Matcher matcher = SINGLE_JUDGE_JOINER_PATTERN.matcher(dispositionText);
            while (matcher.find()) {
                String judge = normalizeJudgeName(matcher.group("judge"));
                if (!judge.equals(normalizeJudgeName(writing.author()))) {
                    continue;
                }
                String others = matcher.group("others");
                if (others == null) {
                    return List.of();
                }
                return List.copyOf(parseJudgeList(others));
            }
        }

        return List.of();
    }

    private List<String> parseJudgeList(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        String normalized = text
            .replace(" and ", ", ")
            .replace(";", ",");
        List<String> judges = new ArrayList<>();
        for (String part : normalized.split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            judges.add(normalizeJudgePhrase(trimmed));
        }
        return judges;
    }

    private String normalizeJudgePhrase(String text) {
        String trimmed = text.trim();
        if (trimmed.regionMatches(true, 0, "Chief Judge ", 0, "Chief Judge ".length())) {
            return normalizeJudgeName(trimmed.substring("Chief Judge ".length()));
        }
        if (trimmed.regionMatches(true, 0, "Judge ", 0, "Judge ".length())) {
            return normalizeJudgeName(trimmed.substring("Judge ".length()));
        }
        return normalizeJudgeName(trimmed);
    }

    private String normalizeJudgeName(String text) {
        return Arrays.stream(text.trim().split("\\s+"))
            .filter(part -> !part.isBlank())
            .map(part -> {
                if (part.equals(part.toUpperCase(Locale.ROOT))) {
                    return Character.toUpperCase(part.charAt(0)) + part.substring(1).toLowerCase(Locale.ROOT);
                }
                return part;
            })
            .reduce((left, right) -> left + " " + right)
            .orElse(text.trim());
    }

    private String inferAppearanceSide(String text) {
        String lower = text.toLowerCase(Locale.ROOT);
        if (lower.contains("for appellant")) {
            return "appellant";
        }
        if (lower.contains("for respondent")) {
            return "respondent";
        }
        return null;
    }

    private String kindFor(OpinionComponent component) {
        return switch (component.role()) {
            case PER_CURIAM -> "per_curiam";
            case MEMORANDUM -> "memorandum";
            case OPINION_OF_THE_COURT -> "opinion_of_the_court";
            case CONCURRENCE, CONCURRENCE_IN_PART -> "concurrence";
            case CONCURRENCE_IN_RESULT -> "concurrence_in_result";
            case DISSENT, DISSENT_IN_PART -> "dissent";
            case CONCURRENCE_AND_DISSENT, MIXED_CASE_SPECIFIC -> "mixed";
            default -> switch (component.type()) {
                case CONCURRENCE -> "concurrence";
                case DISSENT -> "dissent";
                case MIXED -> "mixed";
                default -> "majority";
            };
        };
    }

    private String defaultLabel(OpinionComponent component) {
        if (component.author() == null) {
            return null;
        }
        return component.author() + ", J.";
    }

    private String joinComponentText(OpinionComponent component) {
        return component.lines().stream()
            .map(line -> line.text())
            .reduce((left, right) -> left + " " + right)
            .orElse(null);
    }

    private String caseIdFromPath(SourceDocument source) {
        String name = source.path().getFileName().toString();
        int dot = name.lastIndexOf('.');
        return dot >= 0 ? name.substring(0, dot) : name;
    }

    private String renderValue(Object value) {
        if (value == null) {
            return "null";
        }
        if (value instanceof String string) {
            return quote(string);
        }
        if (value instanceof Number || value instanceof Boolean) {
            return value.toString();
        }
        if (value instanceof Map<?, ?> map) {
            List<String> fields = new ArrayList<>();
            for (var entry : map.entrySet()) {
                fields.add(quote(String.valueOf(entry.getKey())) + ":" + renderValue(entry.getValue()));
            }
            return "{" + String.join(",", fields) + "}";
        }
        if (value instanceof List<?> list) {
            return "[" + list.stream().map(this::renderValue).reduce((left, right) -> left + "," + right).orElse("") + "]";
        }
        throw new IllegalArgumentException("Unsupported JSON value: " + value.getClass());
    }

    private String quote(String value) {
        String escaped = value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\b", "\\b")
            .replace("\f", "\\f")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t");
        return "\"" + escaped + "\"";
    }

    private record Writing(
        String kind,
        String author,
        String label,
        List<String> joiners,
        List<ReflowedBlock> blocks
    ) {}

    private record CitationParts(String slipOpinion, String officialCitation) {}

    private record DispositionInfo(String text, Map<String, Object> json) {}

    private record TerminalSummary(
        List<String> paragraphs,
        int startLine,
        int endLine,
        String text
    ) {}

    private static final class WritingAccumulator {
        private final String kind;
        private final String author;
        private String label;
        private final List<ReflowedBlock> blocks = new ArrayList<>();
        private Integer startLine;
        private Integer endLine;

        private WritingAccumulator(String kind, String author, String label) {
            this.kind = kind;
            this.author = author;
            this.label = label;
        }
    }
}
