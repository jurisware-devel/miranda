package dev.stanbook.pipeline;

import dev.stanbook.ir.html.HtmlFootnote;
import dev.stanbook.ir.html.HtmlNormalizedDocument;
import dev.stanbook.ir.html.HtmlOpinionBlock;
import dev.stanbook.ir.html.HtmlOpinionBlockType;
import dev.stanbook.ir.lowered.Footnote;
import dev.stanbook.ir.lowered.FootnoteSection;
import dev.stanbook.ir.lowered.Header;
import dev.stanbook.ir.lowered.LoweredDocument;
import dev.stanbook.ir.lowered.OpinionBody;
import dev.stanbook.ir.lowered.OpinionComponent;
import dev.stanbook.ir.lowered.OpinionComponentType;
import dev.stanbook.ir.lowered.OpinionRole;
import dev.stanbook.ir.lowered.PublicationStatus;
import dev.stanbook.ir.section.DocumentSection;
import dev.stanbook.ir.section.SectionType;
import dev.stanbook.ir.section.SectionedDocument;
import dev.stanbook.ir.source.SourceDocument;
import dev.stanbook.ir.source.SourceLine;
import dev.stanbook.parse.header.HeaderParser;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class HtmlLowerer {
    private final HeaderParser headerParser;

    public HtmlLowerer(HeaderParser headerParser) {
        this.headerParser = headerParser;
    }

    public LoweredDocument lower(SourceDocument source) {
        HtmlNormalizedDocument html = source.htmlDocument();
        if (html == null) {
            throw new IllegalArgumentException("Expected HTML-backed SourceDocument");
        }

        List<DocumentSection> sections = new ArrayList<>();
        if (!html.headerLines().isEmpty()) {
            sections.add(sectionFromRange(source, SectionType.HEADER_BLOCK,
                html.headerLines().getFirst().lineNumber(),
                html.headerLines().getLast().lineNumber()));
        }
        if (!html.opinionBlocks().isEmpty()) {
            sections.add(sectionFromRange(source, SectionType.OPINION_TEXT,
                html.opinionBlocks().getFirst().lineNumber(),
                html.opinionBlocks().getLast().lineNumber()));
        }
        if (html.footnotesHeadingLine() != null && !html.footnotes().isEmpty()) {
            int endLine = html.footnotes().getLast().lineNumbers().getLast();
            sections.add(sectionFromRange(source, SectionType.FOOTNOTES, html.footnotesHeadingLine(), endLine));
        }

        SectionedDocument sectioned = new SectionedDocument(source, List.copyOf(sections));
        Header header = sections.stream()
            .filter(section -> section.type() == SectionType.HEADER_BLOCK)
            .findFirst()
            .map(headerParser::parse)
            .orElseGet(() -> new Header(List.of()));
        PublicationStatus publicationStatus = headerParser.inferPublicationStatus(header);
        OpinionBody opinionBody = lowerOpinion(source, html);

        return new LoweredDocument(
            sectioned,
            header,
            opinionBody,
            lowerFootnotes(source, html),
            publicationStatus,
            List.of()
        );
    }

    private OpinionBody lowerOpinion(SourceDocument source, HtmlNormalizedDocument html) {
        List<OpinionComponent> components = new ArrayList<>();
        HtmlComponentBuilder current = null;

        for (HtmlOpinionBlock block : html.opinionBlocks()) {
            if (block.type() == HtmlOpinionBlockType.AUTHOR_MARKER) {
                if (current != null && !current.lines.isEmpty()) {
                    components.add(current.build());
                }
                current = createComponentBuilder(block);
                components.add(new OpinionComponent(
                    OpinionComponentType.METADATA,
                    current.role,
                    current.author,
                    current.perCuriam,
                    List.of(sourceLine(source, block.lineNumber())),
                    block.lineNumber(),
                    block.lineNumber()
                ));
                continue;
            }

            if (block.type() == HtmlOpinionBlockType.SUBHEADER) {
                if (current == null) {
                    current = defaultMajorityBuilder();
                }
                if (!current.lines.isEmpty()) {
                    components.add(current.build());
                    current = current.continuation();
                }
                components.add(new OpinionComponent(
                    OpinionComponentType.SUBHEADER,
                    OpinionRole.SUBHEADER,
                    null,
                    false,
                    List.of(sourceLine(source, block.lineNumber())),
                    block.lineNumber(),
                    block.lineNumber()
                ));
                continue;
            }

            if (current == null) {
                current = defaultMajorityBuilder();
            }
            current.lines.add(sourceLine(source, block.lineNumber()));
            current.finishParagraph(source);
        }

        if (current != null && !current.lines.isEmpty()) {
            components.add(current.build());
        }

        return new OpinionBody(List.copyOf(components));
    }

    private FootnoteSection lowerFootnotes(SourceDocument source, HtmlNormalizedDocument html) {
        if (html.footnotesHeadingLine() == null || html.footnotes().isEmpty()) {
            return new FootnoteSection(null, List.of(), List.of());
        }

        List<Footnote> footnotes = new ArrayList<>();
        for (HtmlFootnote footnote : html.footnotes()) {
            List<SourceLine> lines = footnote.lineNumbers().stream()
                .map(lineNumber -> sourceLine(source, lineNumber))
                .toList();
            footnotes.add(new Footnote(
                footnote.label(),
                lines,
                footnote.lineNumbers().getFirst(),
                footnote.lineNumbers().getLast()
            ));
        }

        return new FootnoteSection(html.footnotesHeadingLine(), List.copyOf(footnotes), List.of());
    }

    private HtmlComponentBuilder createComponentBuilder(HtmlOpinionBlock authorBlock) {
        String normalized = authorBlock.text().trim();
        int commaIndex = normalized.indexOf(',');
        if (commaIndex < 0) {
            return new HtmlComponentBuilder(OpinionComponentType.MAJORITY, OpinionRole.MAJORITY, null, false);
        }

        String author = toTitleCase(normalized.substring(0, commaIndex).trim());
        String roleText = normalized.substring(commaIndex + 1);
        int openParen = roleText.indexOf('(');
        int closeParen = roleText.indexOf(')', openParen + 1);
        if (openParen < 0 || closeParen < 0) {
            return new HtmlComponentBuilder(OpinionComponentType.MAJORITY, OpinionRole.MAJORITY, author, false);
        }

        String normalizedRole = roleText.substring(openParen + 1, closeParen).toLowerCase(Locale.ROOT);
        if (normalizedRole.contains("dissent")) {
            return new HtmlComponentBuilder(OpinionComponentType.DISSENT, OpinionRole.DISSENT, author, false);
        }
        if (normalizedRole.contains("concurr")) {
            return new HtmlComponentBuilder(OpinionComponentType.CONCURRENCE, OpinionRole.CONCURRENCE, author, false);
        }
        return new HtmlComponentBuilder(OpinionComponentType.MIXED, OpinionRole.MIXED_CASE_SPECIFIC, author, false);
    }

    private HtmlComponentBuilder defaultMajorityBuilder() {
        return new HtmlComponentBuilder(OpinionComponentType.MAJORITY, OpinionRole.MAJORITY, null, false);
    }

    private DocumentSection sectionFromRange(SourceDocument source, SectionType type, int startLine, int endLine) {
        return new DocumentSection(
            type,
            startLine,
            endLine,
            List.copyOf(source.lines().subList(startLine - 1, endLine))
        );
    }

    private SourceLine sourceLine(SourceDocument source, int lineNumber) {
        return source.lines().get(lineNumber - 1);
    }

    private String toTitleCase(String name) {
        String[] parts = name.toLowerCase(Locale.ROOT).split("\\s+");
        List<String> titled = new ArrayList<>();
        for (String part : parts) {
            if (part.isEmpty()) {
                continue;
            }
            titled.add(Character.toUpperCase(part.charAt(0)) + part.substring(1));
        }
        return String.join(" ", titled);
    }

    private List<SourceLine> trimTrailingBlanks(List<SourceLine> sourceLines) {
        List<SourceLine> trimmed = new ArrayList<>(sourceLines);
        while (!trimmed.isEmpty() && trimmed.getLast().text().isBlank()) {
            trimmed.removeLast();
        }
        return trimmed;
    }

    private final class HtmlComponentBuilder {
        private final OpinionComponentType type;
        private final OpinionRole role;
        private final String author;
        private final boolean perCuriam;
        private final List<SourceLine> lines = new ArrayList<>();

        private HtmlComponentBuilder(
            OpinionComponentType type,
            OpinionRole role,
            String author,
            boolean perCuriam
        ) {
            this.type = type;
            this.role = role;
            this.author = author;
            this.perCuriam = perCuriam;
        }

        private void finishParagraph(SourceDocument source) {
            if (lines.isEmpty() || lines.getLast().text().isEmpty()) {
                return;
            }
            int blankLineNumber = Math.min(lines.getLast().lineNumber() + 1, source.lines().size());
            SourceLine nextLine = source.lines().get(blankLineNumber - 1);
            if (nextLine.text().isEmpty()) {
                lines.add(nextLine);
            }
        }

        private OpinionComponent build() {
            List<SourceLine> trimmed = trimTrailingBlanks(lines);
            return new OpinionComponent(
                type,
                role,
                author,
                perCuriam,
                List.copyOf(trimmed),
                trimmed.getFirst().lineNumber(),
                trimmed.getLast().lineNumber()
            );
        }

        private HtmlComponentBuilder continuation() {
            return new HtmlComponentBuilder(type, role, author, perCuriam);
        }

        private List<SourceLine> trimTrailingBlanks(List<SourceLine> sourceLines) {
            return HtmlLowerer.this.trimTrailingBlanks(sourceLines);
        }
    }
}
