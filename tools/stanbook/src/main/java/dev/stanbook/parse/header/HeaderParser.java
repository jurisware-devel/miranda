package dev.stanbook.parse.header;

import dev.stanbook.ir.lowered.Header;
import dev.stanbook.ir.lowered.HeaderItem;
import dev.stanbook.ir.lowered.HeaderItemType;
import dev.stanbook.ir.lowered.PublicationStatus;
import dev.stanbook.ir.section.DocumentSection;
import dev.stanbook.ir.section.SectionType;
import dev.stanbook.ir.source.SourceLine;
import java.util.List;
import java.util.regex.Pattern;

public final class HeaderParser {
    private static final Pattern HEADER_CASE_NAME_PATTERN = Pattern.compile(
        "^(?:Matter of\\s+[A-Z][A-Za-z0-9.'&-]*(?:\\s+[A-Z][A-Za-z0-9.'&-]*)*\\s+v\\s+"
            + "[A-Z][A-Za-z0-9.'&-]*(?:\\s+[A-Z][A-Za-z0-9.'&-]*)*"
            + "|[A-Z][A-Za-z0-9.'&-]*(?:\\s+[A-Z][A-Za-z0-9.'&-]*)*\\s+v\\s+"
            + "[A-Z][A-Za-z0-9.'&-]*(?:\\s+[A-Z][A-Za-z0-9.'&-]*)*)$"
    );
    private static final Pattern HEADER_CITATION_PATTERN = Pattern.compile(
        "^\\d+\\s+(?:NY2d|NY3d|AD2d|AD3d|Misc(?:\\s+2d|\\s+3d)?)\\s+\\d+(?:,\\s*\\d+)?\\s+\\[[^\\]]+\\]$"
    );
    private static final Pattern HEADER_COURT_PATTERN = Pattern.compile(
        "^(?:Court of Appeals|NY Court of Appeals|Appellate Division, (?:First|Second|Third|Fourth) Department)$"
    );
    private static final Pattern HEADER_DATE_PATTERN = Pattern.compile(
        "^(?:(?:Corrected|Argued|Decided|Submitted|Heard)(?: on)?\\s+.+|[A-Z][a-z]+ \\d{1,2}, \\d{4})$"
    );
    private static final Pattern SLIP_OP_CITATION_PATTERN = Pattern.compile(
        "\\b\\d{4}\\s+NY\\s+Slip\\s+Op\\s+\\d+(?:\\(U\\))?\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern OFFICIAL_REPORTER_HEADER_PATTERN = Pattern.compile("\\b(?:NY2d|NY3d|AD2d|AD3d)\\b");
    private static final Pattern HEADER_COUNSEL_PATTERN = Pattern.compile(
        ".+\\bfor (?:appellant|respondent|petitioner|defendant|plaintiff|claimant)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern HEADER_APPEARANCES_PATTERN = Pattern.compile("^APPEARANCES OF COUNSEL$");
    private static final Pattern HEADER_DOCKET_PATTERN = Pattern.compile("^(?:No\\.\\s+\\d+)$");
    private static final Pattern HEADER_CAPTION_V_PATTERN = Pattern.compile("^v$");
    private static final Pattern HEADER_CAPTION_PARTY_PATTERN = Pattern.compile(
        "^(?:\\[\\*\\d+\\])?.+,\\s+(?:Respondent(?:s)?|Appellant(?:s)?|Petitioner(?:s)?|Defendant(?:s)?|Claimant(?:s)?),?\\.?$"
    );
    private static final Pattern HEADER_BOILERPLATE_PATTERN = Pattern.compile(
        "^(?:Published by .*New York State Law Reporting Bureau.*|Judiciary Law .*431\\.|"
            + "This opinion is uncorrected and subject to revision before publication|"
            + "in the Official Reports\\.|As corrected through .+)$"
    );
    private static final Pattern HEADER_AUTHOR_PATTERN = Pattern.compile(
        "^(?:[A-Z][A-Za-z.' -]+, J\\.|[A-Z][A-Z.' -]+, J\\.|Per Curiam)$"
    );
    private static final Pattern HEADER_ACTION_PATTERN = Pattern.compile(
        ".+,\\s+(?:affirmed|reversed|modified|remitted|dismissed|vacated|adjudged|ordered)\\.?$",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern HEADER_PANEL_PATTERN = Pattern.compile("^(?:Before:|Present:)");
    private static final Pattern GARBAGE_PATTERN = Pattern.compile("\\[\\*\\d+\\]");

    public Header parse(DocumentSection section) {
        if (section.type() != SectionType.HEADER_BLOCK) {
            throw new IllegalArgumentException("Expected HEADER_BLOCK section, got " + section.type());
        }

        List<HeaderItem> items = section.lines().stream()
            .map(line -> new HeaderItem(classifyHeaderLine(line), line))
            .toList();
        return new Header(items);
    }

    public PublicationStatus inferPublicationStatus(Header header) {
        String citationText = header.items().stream()
            .filter(item -> item.type() == HeaderItemType.CITATION)
            .map(item -> item.line().text())
            .reduce("", (left, right) -> left.isEmpty() ? right : left + " " + right);

        if (OFFICIAL_REPORTER_HEADER_PATTERN.matcher(citationText).find()) {
            return PublicationStatus.PUBLISHED;
        }
        if (SLIP_OP_CITATION_PATTERN.matcher(citationText).find()) {
            return PublicationStatus.SLIP_OP_ONLY;
        }
        return PublicationStatus.UNKNOWN;
    }

    HeaderItemType classifyHeaderLine(SourceLine line) {
        String stripped = line.text().trim();
        if (stripped.isEmpty()) {
            return HeaderItemType.BLANK;
        }
        if (GARBAGE_PATTERN.matcher(stripped).matches()) {
            return HeaderItemType.GARBAGE;
        }
        if (HEADER_BOILERPLATE_PATTERN.matcher(stripped).lookingAt()) {
            return HeaderItemType.BOILERPLATE;
        }
        if (HEADER_CASE_NAME_PATTERN.matcher(stripped).matches()) {
            return HeaderItemType.CASE_NAME;
        }
        if (HEADER_CITATION_PATTERN.matcher(stripped).matches() || SLIP_OP_CITATION_PATTERN.matcher(stripped).find()) {
            return HeaderItemType.CITATION;
        }
        if (HEADER_COURT_PATTERN.matcher(stripped).matches()) {
            return HeaderItemType.COURT;
        }
        if (HEADER_AUTHOR_PATTERN.matcher(stripped).matches()) {
            return HeaderItemType.AUTHOR;
        }
        if (HEADER_APPEARANCES_PATTERN.matcher(stripped).matches()) {
            return HeaderItemType.APPEARANCES_HEADING;
        }
        if (HEADER_DOCKET_PATTERN.matcher(stripped).matches()) {
            return HeaderItemType.DOCKET_NUMBER;
        }
        if (HEADER_CAPTION_V_PATTERN.matcher(stripped).matches()) {
            return HeaderItemType.CAPTION_V;
        }
        if (HEADER_CAPTION_PARTY_PATTERN.matcher(stripped).matches()) {
            return HeaderItemType.CAPTION_PARTY;
        }
        if (stripped.startsWith("Corrected")) {
            return HeaderItemType.CORRECTED_DATE;
        }
        if (stripped.startsWith("Argued")) {
            return HeaderItemType.ARGUED_DATE;
        }
        if (stripped.startsWith("Decided")) {
            return HeaderItemType.DECIDED_DATE;
        }
        if (HEADER_DATE_PATTERN.matcher(stripped).matches()) {
            return HeaderItemType.DATE_OTHER;
        }
        if (HEADER_COUNSEL_PATTERN.matcher(stripped).lookingAt()) {
            return HeaderItemType.COUNSEL;
        }
        if (HEADER_ACTION_PATTERN.matcher(stripped).lookingAt()) {
            return HeaderItemType.ACTION;
        }
        if (HEADER_PANEL_PATTERN.matcher(stripped).lookingAt()) {
            return HeaderItemType.PANEL;
        }
        return HeaderItemType.OTHER;
    }
}
