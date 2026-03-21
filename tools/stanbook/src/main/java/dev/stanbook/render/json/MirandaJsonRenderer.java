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
import java.util.Set;
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
        "^(?:Accordingly,\\s+)?(?:The\\s+)?(?:order|judgment|appeal|motion|petition)\\b.*\\b(affirmed|reversed|modified|dismissed|vacated|remitted|adjudged|granted|denied)\\b.*$",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern STRONG_DISPOSITION_ACTION_PATTERN = Pattern.compile(
        "^(?:Accordingly,\\s+)?(?:Appeal|Order|Judgment|Motion|Petition)\\s+"
            + "(?:dismissed|reversed|modified|affirmed|vacated|remitted|adjudged|granted|denied)\\b.*$",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern DISPOSITION_LEAD_PATTERN = Pattern.compile(
        "^(?:On review of submissions|The\\s+(?:order|judgment|appeal|motion|petition)\\b|Order\\b|Judgment\\b|Appeal\\b|Motion\\b|Petition\\b).+",
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
    private static final Pattern DISPOSITION_JUDGE_SPLIT_PATTERN = Pattern.compile(
        "(?<=\\.)\\s+(?=(?:Chief Judge|Judge|Judges)\\b.*(?:concur|concurs|dissent|dissents|votes to)\\b)",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern DISPOSITION_ACTION_START_PATTERN = Pattern.compile(
        "(?:^|\\.\\s+)(?<action>(?:On review of submissions\\b|Accordingly,\\s+|(?:The\\s+)?(?:order|judgment|appeal|motion|petition)\\b).*)$",
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
        List<Writing> preservedWritings = preserveUnclassifiedBlocks(document, trimmedWritings, disposition);
        List<Writing> writingsWithJoiners = attachJoiners(preservedWritings, terminalSummary);
        List<Diagnostic> diagnostics = buildDiagnostics(source, document, writingsWithJoiners, disposition);
        ExtractionAssessment extraction = assessExtraction(source, document, writingsWithJoiners, diagnostics);
        List<Map<String, Object>> appearances = buildAppearances(document);
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("version", "0.1");
        root.put("documentType", "opinion");
        root.put("source", buildSource(source, document, extraction));
        root.put("header", buildHeader(document, appearances));
        root.put("opinions", extraction.structuredOpinionsHighConfidence() ? buildOpinions(writingsWithJoiners) : List.of());
        root.put("disposition", disposition == null ? null : disposition.json());
        root.put("footnotes", extraction.structuredFootnotesHighConfidence() ? buildFootnotes(document) : List.of());
        root.put("renderingHints", buildRenderingHints(document, writingsWithJoiners, extraction));
        root.put("debug", buildDebug(diagnostics, extraction));
        root.put("fallback", buildFallbackSource(source, document));
        return renderValue(root);
    }

    private Map<String, Object> buildSource(SourceDocument source, ReflowedDocument document, ExtractionAssessment extraction) {
        Map<String, Object> sourceJson = new LinkedHashMap<>();
        sourceJson.put("kind", "lrb_html");
        sourceJson.put("caseId", caseIdFromPath(source));
        sourceJson.put("path", normalizedSourcePath(source));
        sourceJson.put("publicationStatus", document.lowered().publicationStatus().name().toLowerCase(Locale.ROOT));
        sourceJson.put("structuredExtraction", extraction.json());
        return sourceJson;
    }

    private Map<String, Object> buildHeader(ReflowedDocument document, List<Map<String, Object>> appearances) {
        CitationParts citationParts = extractCitationParts(firstHeaderValue(document, HeaderItemType.CITATION));
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("title", firstHeaderValue(document, HeaderItemType.CASE_NAME));
        header.put("caption", extractCaptionLines(document));
        header.put("slipOpinion", citationParts.slipOpinion());
        header.put("officialCitation", citationParts.officialCitation());
        header.put("court", firstHeaderValue(document, HeaderItemType.COURT));
        header.put("decisionDate", extractDecisionDate(document));
        header.put("appearances", appearances);
        return header;
    }

    private List<String> extractCaptionLines(ReflowedDocument document) {
        List<String> captionLines = new ArrayList<>();
        for (var item : document.lowered().header().items()) {
            if (item.type() != HeaderItemType.CAPTION_PARTY && item.type() != HeaderItemType.CAPTION_V) {
                continue;
            }
            String text = item.line().text().trim();
            if (!text.isEmpty()) {
                captionLines.add(text);
            }
        }
        return captionLines;
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
            opinion.put("authorStatus", writing.authorStatus());
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

    private Map<String, Object> buildRenderingHints(
        ReflowedDocument document,
        List<Writing> writings,
        ExtractionAssessment extraction
    ) {
        Map<String, Object> hints = new LinkedHashMap<>();
        hints.put("hasOfficialPageMarkers", document.lowered().publicationStatus().name().equals("PUBLISHED"));
        hints.put("hasAppearances", !buildAppearances(document).isEmpty());
        hints.put("hasFootnotes", extraction.structuredFootnotesHighConfidence() && !document.lowered().footnotes().footnotes().isEmpty());
        hints.put("hasSeparateOpinions", extraction.structuredOpinionsHighConfidence() && writings.size() > 1);
        hints.put("usesOpinionSourceFallback", !extraction.structuredOpinionsHighConfidence());
        hints.put("usesFootnoteSourceFallback", !extraction.structuredFootnotesHighConfidence());
        return hints;
    }

    private Map<String, Object> buildDebug(List<Diagnostic> diagnosticsList, ExtractionAssessment extraction) {
        Map<String, Object> debug = new LinkedHashMap<>();
        List<Map<String, Object>> diagnostics = new ArrayList<>();
        for (Diagnostic diagnostic : diagnosticsList) {
            diagnostics.add(diagnosticJson(diagnostic));
        }
        debug.put("diagnostics", diagnostics);
        debug.put("structuredExtraction", extraction.json());
        return debug;
    }

    private List<Diagnostic> buildDiagnostics(
        SourceDocument source,
        ReflowedDocument document,
        List<Writing> writings,
        DispositionInfo disposition
    ) {
        List<Diagnostic> diagnostics = new ArrayList<>();
        diagnostics.addAll(document.lowered().diagnostics());
        diagnostics.addAll(qaDiagnostics(source, document, writings, disposition));
        return List.copyOf(diagnostics);
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

    private ExtractionAssessment assessExtraction(
        SourceDocument source,
        ReflowedDocument document,
        List<Writing> writings,
        List<Diagnostic> diagnostics
    ) {
        List<String> opinionReasons = new ArrayList<>();
        Set<Integer> structuredOpinionLines = structuredOpinionLines(document, writings);
        Set<Integer> sourceOpinionLines = new LinkedHashSet<>();
        source.htmlDocument().opinionBlocks().stream()
            .map(block -> block.lineNumber())
            .forEach(sourceOpinionLines::add);
        source.htmlDocument().fallbackOpinionLineNumbers().forEach(sourceOpinionLines::add);
        if (sourceOpinionLines.isEmpty()) {
            opinionReasons.add("no_opinion_source_lines_detected");
        }
        if (source.htmlDocument().opinionBlocks().isEmpty() && !source.htmlDocument().fallbackOpinionLineNumbers().isEmpty()) {
            opinionReasons.add("no_structured_opinion_blocks_detected");
        }
        if (!source.htmlDocument().opinionBlocks().isEmpty() && writings.isEmpty()) {
            opinionReasons.add("opinion_writings_not_emitted");
        }
        double opinionCoverage = coverageRatio(sourceOpinionLines, structuredOpinionLines);
        if (!sourceOpinionLines.isEmpty() && opinionCoverage < 1.0d) {
            opinionReasons.add("opinion_line_coverage_incomplete");
        }

        List<String> footnoteReasons = new ArrayList<>();
        Set<Integer> sourceFootnoteLines = new LinkedHashSet<>();
        source.htmlDocument().footnotes().forEach(footnote -> sourceFootnoteLines.addAll(footnote.lineNumbers()));
        Set<Integer> structuredFootnoteLines = structuredFootnoteLines(document);
        if (sourceFootnoteLines.isEmpty()) {
            footnoteReasons.add("no_footnote_source_lines_detected");
        }
        double footnoteCoverage = coverageRatio(sourceFootnoteLines, structuredFootnoteLines);
        if (!sourceFootnoteLines.isEmpty() && footnoteCoverage < 1.0d) {
            footnoteReasons.add("footnote_line_coverage_incomplete");
        }

        boolean hasErrorDiagnostic = diagnostics.stream()
            .anyMatch(diagnostic -> diagnostic.severity() == dev.stanbook.diagnostics.Severity.ERROR);
        if (hasErrorDiagnostic) {
            opinionReasons.add("error_diagnostics_present");
            if (!sourceFootnoteLines.isEmpty()) {
                footnoteReasons.add("error_diagnostics_present");
            }
        }

        boolean structuredOpinionsHighConfidence =
            !sourceOpinionLines.isEmpty()
                && source.htmlDocument().fallbackOpinionLineNumbers().isEmpty()
                && !writings.isEmpty()
                && opinionCoverage == 1.0d
                && !hasErrorDiagnostic;
        boolean structuredFootnotesHighConfidence =
            sourceFootnoteLines.isEmpty() || (footnoteCoverage == 1.0d && !hasErrorDiagnostic);

        return new ExtractionAssessment(
            structuredOpinionsHighConfidence,
            structuredFootnotesHighConfidence,
            opinionCoverage,
            footnoteCoverage,
            List.copyOf(opinionReasons),
            List.copyOf(footnoteReasons)
        );
    }

    private Set<Integer> structuredOpinionLines(ReflowedDocument document, List<Writing> writings) {
        Set<Integer> lines = new LinkedHashSet<>();
        document.lowered().opinionBody().components().forEach(component -> {
            for (int line = component.startLine(); line <= component.endLine(); line++) {
                lines.add(line);
            }
        });
        if (!writings.isEmpty()) {
            writings.stream()
                .flatMap(writing -> writing.blocks().stream())
                .flatMap(block -> block.sourceLines().stream())
                .forEach(lines::add);
        }
        return lines;
    }

    private Set<Integer> structuredFootnoteLines(ReflowedDocument document) {
        Set<Integer> lines = new LinkedHashSet<>();
        document.footnotes().blocksByStartLine().values().forEach(blocks ->
            blocks.forEach(block -> lines.addAll(block.sourceLines()))
        );
        return lines;
    }

    private double coverageRatio(Set<Integer> sourceLines, Set<Integer> coveredLines) {
        if (sourceLines.isEmpty()) {
            return 1.0d;
        }
        long coveredCount = sourceLines.stream().filter(coveredLines::contains).count();
        return (double) coveredCount / (double) sourceLines.size();
    }

    private Map<String, Object> buildFallbackSource(SourceDocument source, ReflowedDocument document) {
        Map<String, Object> fallback = new LinkedHashMap<>();
        fallback.put("headerLines", linesJson(source, source.htmlDocument().headerLines().stream()
            .map(dev.stanbook.ir.html.HtmlHeaderLine::lineNumber)
            .toList()));
        fallback.put("opinionLines", linesJson(source, opinionFallbackLineNumbers(source, document)));
        fallback.put("footnoteLines", linesJson(source, source.htmlDocument().footnotes().stream()
            .flatMap(footnote -> footnote.lineNumbers().stream())
            .toList()));
        return fallback;
    }

    private List<Integer> opinionFallbackLineNumbers(SourceDocument source, ReflowedDocument document) {
        if (!source.htmlDocument().fallbackOpinionLineNumbers().isEmpty()) {
            return source.htmlDocument().fallbackOpinionLineNumbers();
        }
        return document.lowered().sectioned().section(dev.stanbook.ir.section.SectionType.OPINION_TEXT)
            .map(section -> section.lines().stream().map(SourceLine::lineNumber).toList())
            .orElse(List.of());
    }

    private List<Map<String, Object>> linesJson(SourceDocument source, List<Integer> lineNumbers) {
        List<Map<String, Object>> lines = new ArrayList<>();
        for (Integer lineNumber : new LinkedHashSet<>(lineNumbers)) {
            if (lineNumber == null || lineNumber < 1 || lineNumber > source.lines().size()) {
                continue;
            }
            SourceLine line = source.lines().get(lineNumber - 1);
            if (line.text().isBlank()) {
                continue;
            }
            Map<String, Object> json = new LinkedHashMap<>();
            json.put("lineNumber", line.lineNumber());
            json.put("text", line.text());
            lines.add(json);
        }
        return lines;
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
            String author = authorFor(component);
            String authorStatus = authorStatusFor(component);
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

            if (current == null || !sameWriting(current, component, author)) {
                if (shouldMergeAnonymousMajorityPrelude(current, component, author)) {
                    WritingAccumulator merged = new WritingAccumulator(kindFor(component), author, authorStatus, pendingLabel);
                    merged.blocks.addAll(current.blocks);
                    merged.startLine = current.startLine;
                    merged.endLine = current.endLine;
                    accumulators.set(accumulators.size() - 1, merged);
                    current = merged;
                } else {
                    current = new WritingAccumulator(kindFor(component), author, authorStatus, pendingLabel);
                    accumulators.add(current);
                }
            } else if (current.label == null && pendingLabel != null) {
                current.label = pendingLabel;
            }

            current.startLine = current.startLine == null ? component.startLine() : Math.min(current.startLine, component.startLine());
            current.endLine = current.endLine == null ? component.endLine() : Math.max(current.endLine, component.endLine());
            appendDistinctBlocks(current.blocks, blocksForComponent(document, component));

            if (current.label == null
                && author != null
                && component.type() != OpinionComponentType.MAJORITY
                && component.type() != OpinionComponentType.BLOCK_QUOTE) {
                current.label = defaultLabel(component);
            }
            pendingLabel = null;
        }

        List<Writing> writings = accumulators.stream()
            .map(acc -> new Writing(
                acc.kind,
                acc.author,
                acc.authorStatus,
                normalizeWritingLabel(acc.label),
                List.of(),
                trimTerminalSummaryBlocks(acc.blocks, terminalSummary)
            ))
            .toList();
        return applyHeaderAuthorInferences(document, writings);
    }

    private List<Writing> applyHeaderAuthorInferences(ReflowedDocument document, List<Writing> writings) {
        String headerAuthor = firstHeaderValue(document, HeaderItemType.AUTHOR);
        String inferredAuthor = inferredAuthorFromHeader(headerAuthor);
        if (inferredAuthor == null) {
            return writings;
        }

        List<Writing> updated = new ArrayList<>();
        boolean applied = false;
        for (Writing writing : writings) {
            if (!applied
                && writing.author() == null
                && ("majority".equals(writing.kind()) || "opinion_of_the_court".equals(writing.kind()))) {
                String inferredLabel = writing.label() == null && !"Per Curiam".equals(inferredAuthor)
                    ? normalizeWritingLabel(inferredAuthor + ", J.")
                    : writing.label();
                String inferredStatus = "Per Curiam".equalsIgnoreCase(headerAuthor == null ? "" : headerAuthor.trim())
                    ? "anonymous"
                    : "named";
                updated.add(new Writing(
                    writing.kind(),
                    "named".equals(inferredStatus) ? inferredAuthor : null,
                    inferredStatus,
                    inferredLabel,
                    writing.joiners(),
                    writing.blocks()
                ));
                applied = true;
                continue;
            }
            updated.add(writing);
        }
        return List.copyOf(updated);
    }

    private String inferredAuthorFromHeader(String headerAuthor) {
        if (headerAuthor == null) {
            return null;
        }
        String trimmed = headerAuthor.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if ("Per Curiam".equalsIgnoreCase(trimmed)) {
            return "Per Curiam";
        }
        if (trimmed.matches("^(?:[A-Z][A-Za-z.' -]+|[A-Z][A-Z.' -]+),\\s+J\\.$")) {
            int commaIndex = trimmed.indexOf(',');
            if (commaIndex > 0) {
                return trimmed.substring(0, commaIndex).trim();
            }
        }
        return null;
    }

    private List<Writing> attachJoiners(
        List<Writing> writings,
        TerminalSummary terminalSummary
    ) {
        String joinerContext = joinerContext(terminalSummary);

        List<Writing> updated = new ArrayList<>();
        for (Writing writing : writings) {
            List<String> joiners = joinersForWriting(writing, joinerContext);
            updated.add(new Writing(writing.kind(), writing.author(), writing.authorStatus(), writing.label(), joiners, writing.blocks()));
        }
        return List.copyOf(updated);
    }

    private List<Writing> preserveUnclassifiedBlocks(
        ReflowedDocument document,
        List<Writing> writings,
        DispositionInfo disposition
    ) {
        if (document.opinion().blocks().isEmpty()) {
            return writings;
        }

        List<Writing> ordered = new ArrayList<>();
        List<ReflowedBlock> fallbackBlocks = new ArrayList<>();
        boolean[] emitted = new boolean[writings.size()];

        for (ReflowedBlock block : document.opinion().blocks()) {
            if (isRepresentedByDisposition(block, disposition)) {
                flushFallbackWriting(ordered, fallbackBlocks);
                continue;
            }

            int ownerIndex = ownerIndexForBlock(block, writings);
            if (ownerIndex >= 0) {
                flushFallbackWriting(ordered, fallbackBlocks);
                if (!emitted[ownerIndex]) {
                    ordered.add(writings.get(ownerIndex));
                    emitted[ownerIndex] = true;
                }
                continue;
            }

            fallbackBlocks.add(block);
        }

        flushFallbackWriting(ordered, fallbackBlocks);
        for (int index = 0; index < writings.size(); index++) {
            if (!emitted[index]) {
                ordered.add(writings.get(index));
            }
        }
        return List.copyOf(ordered);
    }

    private int ownerIndexForBlock(ReflowedBlock block, List<Writing> writings) {
        for (int index = 0; index < writings.size(); index++) {
            Writing writing = writings.get(index);
            boolean ownsBlock = writing.blocks().stream().anyMatch(candidate -> sameBlock(candidate, block));
            if (ownsBlock) {
                return index;
            }
        }
        return -1;
    }

    private boolean isRepresentedByDisposition(ReflowedBlock block, DispositionInfo disposition) {
        if (disposition == null || block.sourceLines().isEmpty()) {
            return false;
        }
        int dispositionStart = disposition.startLine();
        int dispositionEnd = disposition.endLine();
        int blockStart = block.sourceLines().getFirst();
        int blockEnd = block.sourceLines().getLast();
        return blockStart >= dispositionStart && blockEnd <= dispositionEnd;
    }

    private void flushFallbackWriting(List<Writing> ordered, List<ReflowedBlock> fallbackBlocks) {
        if (fallbackBlocks.isEmpty()) {
            return;
        }
        ordered.add(new Writing(
            "unknown",
            null,
            "unknown",
            "Unrecognized text",
            List.of(),
            List.copyOf(fallbackBlocks)
        ));
        fallbackBlocks.clear();
    }

    private String joinerContext(TerminalSummary terminalSummary) {
        return terminalSummary == null ? "" : terminalSummary.text();
    }

    private boolean sameWriting(WritingAccumulator current, OpinionComponent component, String author) {
        return current.kind.equals(kindFor(component))
            && java.util.Objects.equals(current.author, author);
    }

    private boolean shouldMergeAnonymousMajorityPrelude(WritingAccumulator current, OpinionComponent component, String author) {
        if (current == null || !"majority".equals(current.kind) || current.author != null) {
            return false;
        }
        if (!"majority".equals(kindFor(component)) || author == null) {
            return false;
        }
        return !current.blocks.isEmpty() && current.blocks.stream().allMatch(this::isOpinionOfTheCourtPreludeBlock);
    }

    private boolean isOpinionOfTheCourtPreludeBlock(ReflowedBlock block) {
        String normalized = OFFICIAL_PAGE_MARKER_PATTERN.matcher(block.text()).replaceAll("");
        normalized = normalized.replaceAll("\\s+", " ").trim();
        return normalized.equalsIgnoreCase("OPINION OF THE COURT");
    }

    private List<ReflowedBlock> blocksForComponent(ReflowedDocument document, OpinionComponent component) {
        return document.opinion().blocks().stream()
            .filter(block -> overlaps(component, block))
            .toList();
    }

    private void appendDistinctBlocks(List<ReflowedBlock> target, List<ReflowedBlock> additions) {
        for (ReflowedBlock block : additions) {
            if (!target.isEmpty() && sameBlock(target.getLast(), block)) {
                continue;
            }
            target.add(block);
        }
    }

    private boolean sameBlock(ReflowedBlock left, ReflowedBlock right) {
        return left == right
            || (left.type() == right.type()
                && java.util.Objects.equals(left.sourceLines(), right.sourceLines())
                && java.util.Objects.equals(left.text(), right.text()));
    }

    private boolean overlaps(OpinionComponent component, ReflowedBlock block) {
        if (block.type() == dev.stanbook.ir.render.BlockType.QUOTE) {
            return component.type() == OpinionComponentType.BLOCK_QUOTE
                && !block.sourceLines().isEmpty()
                && component.startLine() == block.sourceLines().getFirst();
        }
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
            case QUOTE -> "quote";
            case SUBHEADER -> "subheader";
            case FOOTNOTE_PARAGRAPH -> "paragraph";
        });
        if (block.inlines() != null && !block.inlines().isEmpty()) {
            json.put("inlines", blockInlines(block).stream().map(this::inlineJson).toList());
        }
        if (block.blocks() != null && !block.blocks().isEmpty()) {
            json.put("blocks", block.blocks().stream().map(this::blockJson).toList());
        }
        if (!block.sourceLines().isEmpty()) {
            json.put("provenance", provenance(block.sourceLines().getFirst(), block.sourceLines().getLast()));
        }
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
        DispositionInfo terminalDisposition = dispositionFromTerminalSummary(terminalSummary);
        if (terminalDisposition != null) {
            return terminalDisposition;
        }

        return document.lowered().header().items().stream()
            .filter(item -> item.type() == HeaderItemType.ACTION)
            .findFirst()
            .map(item -> dispositionInfo(item.line().text(), item.line().lineNumber(), item.line().lineNumber()))
            .orElse(null);
    }

    private DispositionInfo dispositionFromTerminalSummary(TerminalSummary terminalSummary) {
        if (terminalSummary == null || terminalSummary.paragraphs().isEmpty()) {
            return null;
        }

        List<String> dispositionParagraphs = new ArrayList<>();
        boolean sawDispositionAction = false;
        for (String paragraph : terminalSummary.paragraphs()) {
            String stripped = paragraph.trim();
            if (stripped.isEmpty()) {
                if (!dispositionParagraphs.isEmpty()) {
                    break;
                }
                continue;
            }
            if (dispositionParagraphs.isEmpty()) {
                if (isDispositionActionLine(stripped) || DISPOSITION_JUDGE_LINE_PATTERN.matcher(stripped).matches()) {
                    dispositionParagraphs.add(stripped);
                    sawDispositionAction = sawDispositionAction || isDispositionActionLine(stripped);
                }
                continue;
            }
            if (!sawDispositionAction && DISPOSITION_JUDGE_LINE_PATTERN.matcher(stripped).matches()) {
                dispositionParagraphs.add(stripped);
                continue;
            }
            if (isDispositionActionLine(stripped) || isDispositionTextContinuation(stripped)) {
                dispositionParagraphs.add(stripped);
                sawDispositionAction = sawDispositionAction || isDispositionActionLine(stripped);
                continue;
            }
            break;
        }

        if (dispositionParagraphs.isEmpty() || !sawDispositionAction) {
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
            || DISPOSITION_ACTION_PATTERN.matcher(text).matches();
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
                last.authorStatus(),
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
        return new DispositionInfo(text, startLine, endLine, json);
    }

    private List<Map<String, Object>> dispositionParts(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }

        String trimmed = text.trim();
        Matcher matcher = DISPOSITION_OPINION_BY_SPLIT_PATTERN.matcher(trimmed);
        if (matcher.find()) {
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

        String[] judgeSplitParts = DISPOSITION_JUDGE_SPLIT_PATTERN.split(trimmed, 2);
        if (judgeSplitParts.length == 2) {
            String actionText = judgeSplitParts[0].trim();
            String summaryText = judgeSplitParts[1].trim();
            if (STRONG_DISPOSITION_ACTION_PATTERN.matcher(actionText).matches()
                && DISPOSITION_JUDGE_LINE_PATTERN.matcher(summaryText).matches()) {
                return List.of(
                    dispositionPart("action", actionText),
                    dispositionPart("summary", summaryText)
                );
            }
        }

        Matcher actionMatcher = DISPOSITION_ACTION_START_PATTERN.matcher(trimmed);
        if (actionMatcher.find() && actionMatcher.start("action") > 0) {
            String summaryText = trimmed.substring(0, actionMatcher.start("action")).trim();
            String actionText = trimmed.substring(actionMatcher.start("action")).trim();
            if (DISPOSITION_JUDGE_LINE_PATTERN.matcher(summaryText).matches() && !actionText.isEmpty()) {
                return List.of(
                    dispositionPart("summary", summaryText),
                    dispositionPart("action", actionText)
                );
            }
        }

        return List.of(dispositionPart("action", trimmed));
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
            case PER_CURIAM, MEMORANDUM -> "majority";
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

    private String authorFor(OpinionComponent component) {
        return component.author();
    }

    private String authorStatusFor(OpinionComponent component) {
        if (component.author() != null) {
            return "named";
        }
        if (component.role() == OpinionRole.PER_CURIAM || component.perCuriam()) {
            return "anonymous";
        }
        return "unknown";
    }

    private String defaultLabel(OpinionComponent component) {
        String author = authorFor(component);
        if (author == null || "Per Curiam".equals(author)) {
            return null;
        }
        return normalizeWritingLabel(author + ", J.");
    }

    private String normalizeWritingLabel(String label) {
        if (label == null) {
            return null;
        }

        String withoutColon = label.replaceFirst(":\\s*$", "").stripTrailing();
        if (withoutColon.matches(".*J\\.\\s*$")) {
            return withoutColon;
        }
        return withoutColon.replaceFirst("\\.\\s*$", "");
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

    private String normalizedSourcePath(SourceDocument source) {
        List<String> segments = new ArrayList<>();
        for (java.nio.file.Path part : source.path()) {
            segments.add(part.toString());
        }

        for (int index = 0; index < segments.size(); index++) {
            if (!"opinions".equals(segments.get(index))) {
                continue;
            }
            if (index + 1 >= segments.size()) {
                break;
            }
            return String.join("/", segments.subList(index + 1, segments.size()));
        }

        return source.path().toString().replace('\\', '/');
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
        String authorStatus,
        String label,
        List<String> joiners,
        List<ReflowedBlock> blocks
    ) {}

    private record CitationParts(String slipOpinion, String officialCitation) {}

    private record DispositionInfo(String text, int startLine, int endLine, Map<String, Object> json) {}

    private record TerminalSummary(
        List<String> paragraphs,
        int startLine,
        int endLine,
        String text
    ) {}

    private record ExtractionAssessment(
        boolean structuredOpinionsHighConfidence,
        boolean structuredFootnotesHighConfidence,
        double opinionLineCoverage,
        double footnoteLineCoverage,
        List<String> opinionFallbackReasons,
        List<String> footnoteFallbackReasons
    ) {
        private Map<String, Object> json() {
            Map<String, Object> json = new LinkedHashMap<>();
            json.put("opinions", structuredOpinionsHighConfidence ? "high_confidence" : "fallback_only");
            json.put("footnotes", structuredFootnotesHighConfidence ? "high_confidence" : "fallback_only");
            json.put("opinionLineCoverage", opinionLineCoverage);
            json.put("footnoteLineCoverage", footnoteLineCoverage);
            json.put("opinionFallbackReasons", opinionFallbackReasons);
            json.put("footnoteFallbackReasons", footnoteFallbackReasons);
            return json;
        }
    }

    private static final class WritingAccumulator {
        private final String kind;
        private final String author;
        private final String authorStatus;
        private String label;
        private final List<ReflowedBlock> blocks = new ArrayList<>();
        private Integer startLine;
        private Integer endLine;

        private WritingAccumulator(String kind, String author, String authorStatus, String label) {
            this.kind = kind;
            this.author = author;
            this.authorStatus = authorStatus;
            this.label = label;
        }
    }
}
