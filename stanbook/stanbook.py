#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable
from typing import Iterable


SNIPPET_MARGIN = 40

INTRODUCTORY_SIGNAL_PATTERN = re.compile(r"(?<!\w)(?:see e\.g\.|cf\.)(?!\w)")
CROSS_REFERENCE_PATTERN = re.compile(r"\b(?:supra|infra)\b")
PAGE_MARKER_PATTERN = re.compile(r"\{\*\*\d+\s+(?:NY2d|NY3d|AD2d|AD3d)\s+at\s+\d+\}")
GARBAGE_PATTERN = re.compile(r"\[\*\d+\]")
OPINION_SUBHEADER_PATTERN = re.compile(r"^(?:OPINION OF THE COURT|Footnotes)$")
OPINION_START_PATTERN = re.compile(r"^(?:OPINION OF THE COURT|MEMORANDUM:?|Per Curiam\.?)$")
BODY_SUBHEADER_PATTERN = re.compile(r"^[A-Z][A-Z0-9 '&-]{3,}$")
ROMAN_SUBHEADER_PATTERN = re.compile(r"^(?:\[\*\d+\])?\s*[IVX]+\.$")
LETTER_SUBHEADER_PATTERN = re.compile(r"^(?:\[\*\d+\])?\s*[A-Z]\.$")
ROLE_PATTERN = (
    r"concurring in result in part and dissenting in part|"
    r"concurring in part and dissenting in part|"
    r"dissenting in part and concurring in part|"
    r"concurring in result|"
    r"dissenting in part|"
    r"concurring in part|"
    r"concurring|"
    r"dissenting"
)
PER_CURIAM_LINE_PATTERN = re.compile(r"^(?:\*\*)?Per Curiam\.?(?:\*\*)?$")
MEMORANDUM_LINE_PATTERN = re.compile(r"^(?:\*\*)?Memorandum\.?(?:\*\*)?$", re.IGNORECASE)
OPINION_OF_THE_COURT_LINE_PATTERN = re.compile(r"^(?:\*\*)?OPINION OF THE COURT(?:\*\*)?$")
OPINION_BY_PATTERN = re.compile(
    r"^Opinion by (?:(?P<title>Chief Judge|Judge) )(?P<judge>[A-Z][A-Za-z.' -]+)\.$"
)
ALL_CAPS_AUTHOR_PATTERN = re.compile(
    r"^(?P<judge>[A-Z][A-Z.' -]+), (?P<title>J\.|Chief Judge)\.?$"
)
JUDGE_OPENER_PATTERN = re.compile(
    r"^(?P<judge>[A-Z][A-Za-z.' -]+), J\.(?: \((?P<role>" + ROLE_PATTERN + r")\))?[\.:]?$"
)
JUDGE_OPENER_PREFIX_PATTERN = re.compile(
    r"^(?P<judge>[A-Z][A-Za-z.' -]+), J\.(?: \((?P<role>" + ROLE_PATTERN + r")\))?[\.:]"
)
CHIEF_JUDGE_OPENER_PATTERN = re.compile(
    r"^(?:Chief Judge (?P<judge1>[A-Z][A-Za-z.' -]+)|(?P<judge2>[A-Z][A-Za-z.' -]+), Chief Judge)"
    r"(?: \((?P<role>" + ROLE_PATTERN + r")\))?[\.:]?$"
)
CHIEF_JUDGE_OPENER_PREFIX_PATTERN = re.compile(
    r"^(?:Chief Judge (?P<judge1>[A-Z][A-Za-z.' -]+)|(?P<judge2>[A-Z][A-Za-z.' -]+), Chief Judge)"
    r"(?: \((?P<role>" + ROLE_PATTERN + r")\))?[\.:]"
)
INLINE_OPENER_PATTERN = re.compile(
    r"(?<=[.!?])\s+(?P<opener>"
    r"(?:[A-Z][A-Za-z.' -]+, J\.(?: \((?:" + ROLE_PATTERN + r")\))?[\.:]"
    r"|(?:Chief Judge [A-Z][A-Za-z.' -]+|[A-Z][A-Za-z.' -]+, Chief Judge)"
    r"(?: \((?:" + ROLE_PATTERN + r")\))?[\.:]))"
)
HEADER_CASE_NAME_PATTERN = re.compile(
    r"^(?:Matter of\s+[A-Z][A-Za-z0-9.'&-]*(?:\s+[A-Z][A-Za-z0-9.'&-]*)*\s+v\s+"
    r"[A-Z][A-Za-z0-9.'&-]*(?:\s+[A-Z][A-Za-z0-9.'&-]*)*"
    r"|[A-Z][A-Za-z0-9.'&-]*(?:\s+[A-Z][A-Za-z0-9.'&-]*)*\s+v\s+"
    r"[A-Z][A-Za-z0-9.'&-]*(?:\s+[A-Z][A-Za-z0-9.'&-]*)*)$"
)
HEADER_CITATION_PATTERN = re.compile(
    r"^\d+\s+(?:NY2d|NY3d|AD2d|AD3d|Misc(?:\s+2d|\s+3d)?)\s+\d+(?:,\s*\d+)?\s+\[[^\]]+\]$"
)
HEADER_COURT_PATTERN = re.compile(
    r"^(?:Court of Appeals|NY Court of Appeals|Appellate Division, (?:First|Second|Third|Fourth) Department)$"
)
HEADER_DATE_PATTERN = re.compile(
    r"^(?:(?:Corrected|Argued|Decided|Submitted|Heard)(?: on)?\s+.+|[A-Z][a-z]+ \d{1,2}, \d{4})$"
)
SLIP_OP_CITATION_PATTERN = re.compile(r"\b\d{4}\s+NY\s+Slip\s+Op\s+\d+(?:\(U\))?\b", re.IGNORECASE)
OFFICIAL_REPORTER_HEADER_PATTERN = re.compile(r"\b(?:NY2d|NY3d|AD2d|AD3d)\b")
HEADER_COUNSEL_PATTERN = re.compile(
    r".+\bfor (?:appellant|respondent|petitioner|defendant|plaintiff|claimant)\b",
    re.IGNORECASE,
)
HEADER_APPEARANCES_PATTERN = re.compile(r"^APPEARANCES OF COUNSEL$")
HEADER_DOCKET_PATTERN = re.compile(r"^(?:No\.\s+\d+)$")
HEADER_CAPTION_V_PATTERN = re.compile(r"^v$")
HEADER_CAPTION_PARTY_PATTERN = re.compile(
    r"^(?:\[\*\d+\])?.+,\s+(?:Respondent|Appellant|Petitioner|Defendant|Claimant),?\.?$"
)
HEADER_BOILERPLATE_PATTERN = re.compile(
    r"^(?:Published by .*New York State Law Reporting Bureau.*|Judiciary Law .*431\.|This opinion is uncorrected and subject to revision before publication|in the Official Reports\.|As corrected through .+)$"
)
HEADER_AUTHOR_PATTERN = re.compile(
    r"^(?:[A-Z][A-Za-z.' -]+, J\.|[A-Z][A-Z.' -]+, J\.|Per Curiam)$"
)
HEADER_ACTION_PATTERN = re.compile(
    r".+,\s+(?:affirmed|reversed|modified|remitted|dismissed|vacated|adjudged|ordered)\.?$",
    re.IGNORECASE,
)
HEADER_PANEL_PATTERN = re.compile(r"^(?:Before:|Present:)")
FOOTNOTE_START_PATTERN = re.compile(r"^\[\d+\]Footnote\s+(?P<label>[^:]+):\s*(?P<body>.*)$")
REFERENCES_HEADING_PATTERN = re.compile(r"^References$")
OFFICIAL_PAGE_MARKER_PATTERN = re.compile(r"\{\*\*\d+\s+(?:NY2d|NY3d|AD2d|AD3d)\s+at\s+\d+\}")
REPORTER_PATTERN = re.compile(
    r"\d+\s+(?:NY2d|NY3d|AD2d|AD3d|Misc(?:\s+2d|\s+3d)?)\s+\d+(?:,\s*\d+(?:-\d+)?)?(?:\s*\[[^\]]+\])?"
)
CASE_NAME_IN_CITATION_PATTERN = re.compile(
    r"(?P<case>"
    r"(?:Matter of\s+[A-Z][A-Za-z0-9.'&-]*(?:\s+[A-Z][A-Za-z0-9.'&-]*)*\s+v\s+"
    r"[A-Z][A-Za-z0-9.'&-]*(?:\s+[A-Z][A-Za-z0-9.'&-]*)*"
    r"|[A-Z][A-Za-z0-9.'&-]*(?:\s+[A-Z][A-Za-z0-9.'&-]*)*\s+v\s+"
    r"[A-Z][A-Za-z0-9.'&-]*(?:\s+[A-Z][A-Za-z0-9.'&-]*)*)"
    r")(?=,\s*" + REPORTER_PATTERN.pattern + r")"
)


@dataclass(frozen=True)
class Span:
    line_number: int
    start: int
    end: int


@dataclass(frozen=True)
class SourceLine:
    line_number: int
    text: str


@dataclass(frozen=True)
class SourceDocument:
    path: Path
    lines: tuple[SourceLine, ...]

    @classmethod
    def from_path(cls, path: Path) -> SourceDocument:
        try:
            raw_text = path.read_text(encoding="utf-8")
        except FileNotFoundError as exc:
            raise SystemExit(f"Error: file not found: {path}") from exc
        except IsADirectoryError as exc:
            raise SystemExit(f"Error: path is a directory, not a file: {path}") from exc
        except UnicodeDecodeError:
            try:
                raw_text = path.read_text(encoding="cp1252")
            except UnicodeDecodeError as exc:
                raise SystemExit(f"Error: could not decode file as UTF-8 or cp1252: {path}") from exc
        except OSError as exc:
            raise SystemExit(f"Error: could not read file: {path}: {exc.strerror}") from exc

        raw_lines = raw_text.splitlines()

        return cls(
            path=path,
            lines=tuple(
                SourceLine(line_number=index, text=text)
                for index, text in enumerate(raw_lines, start=1)
            ),
        )


@dataclass(frozen=True)
class DocumentSection:
    section_type: str
    start_line: int
    end_line: int
    lines: tuple[SourceLine, ...]


@dataclass(frozen=True)
class HeaderComponent:
    component_type: str
    line: SourceLine


@dataclass(frozen=True)
class ParsedHeader:
    components: tuple[HeaderComponent, ...]
    publication_status: str


@dataclass(frozen=True)
class ParserError:
    code: str
    message: str
    line_number: int


@dataclass(frozen=True)
class OpinionComponent:
    component_type: str
    role_label: str
    author: str | None
    is_per_curiam: bool
    lines: tuple[SourceLine, ...]
    start_line: int
    end_line: int


@dataclass(frozen=True)
class ParsedOpinionBody:
    components: tuple[OpinionComponent, ...]
    errors: tuple[ParserError, ...]


@dataclass(frozen=True)
class ReflowedBlock:
    block_type: str
    text: str
    source_lines: tuple[int, ...]


@dataclass(frozen=True)
class Footnote:
    label: str
    lines: tuple[SourceLine, ...]
    start_line: int
    end_line: int


@dataclass(frozen=True)
class ParsedFootnotes:
    heading_line: int | None
    footnotes: tuple[Footnote, ...]
    trailing_lines: tuple[SourceLine, ...]


@dataclass(frozen=True)
class RuleExample:
    before: str
    after: str


@dataclass(frozen=True)
class Token:
    token_type: str
    span: Span
    text: str


@dataclass(frozen=True)
class RuleMatch:
    span: Span
    replacement: str


@dataclass(frozen=True)
class RuleDefinition:
    rule_id: str
    name: str
    category: str
    reason: str
    examples: tuple[RuleExample, ...]
    detect: Callable[[SourceLine, tuple[Token, ...]], list[RuleMatch]]


@dataclass(frozen=True)
class Finding:
    line_number: int
    rule_id: str
    rule_name: str
    rule_category: str
    reason: str
    original: str
    suggestion: str
    snippet: str
    column: int = 0
    end_column: int = 0


def is_already_italicized(text: str, start: int, end: int) -> bool:
    return start > 0 and end < len(text) and text[start - 1] == "*" and text[end] == "*"


def normalize_judge_name(name: str) -> str:
    return " ".join(part.capitalize() for part in name.split())


def build_italicized_text(text: str, start: int, end: int) -> str:
    return f"{text[:start]}*{text[start:end]}*{text[end:]}"


def build_snippet(text: str, span: Span, margin: int = SNIPPET_MARGIN) -> str:
    if len(text) <= margin * 2:
        return text

    start = max(0, span.start - margin)
    end = min(len(text), span.end + margin)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(text) else ""
    return f"{prefix}{text[start:end]}{suffix}"


def left_align_text(text: str) -> str:
    return text.lstrip()


def reflow_paragraph_lines(lines: list[str]) -> str:
    return " ".join(part.strip() for part in lines if part.strip())


def reflow_component(component: OpinionComponent) -> tuple[ReflowedBlock, ...]:
    if component.component_type == "opinion_subheader":
        text = "\n".join(left_align_text(line.text).strip() for line in component.lines if line.text.strip())
        return (
            ReflowedBlock(
                block_type="subheader",
                text=text,
                source_lines=tuple(line.line_number for line in component.lines),
            ),
        )

    paragraphs: list[ReflowedBlock] = []
    current_lines: list[str] = []
    current_source_lines: list[int] = []

    for line in component.lines:
        normalized = left_align_text(line.text).rstrip()
        if not normalized.strip():
            if current_lines:
                paragraphs.append(
                    ReflowedBlock(
                        block_type="paragraph",
                        text=reflow_paragraph_lines(current_lines),
                        source_lines=tuple(current_source_lines),
                    )
                )
                current_lines = []
                current_source_lines = []
            continue
        current_lines.append(normalized)
        current_source_lines.append(line.line_number)

    if current_lines:
        paragraphs.append(
            ReflowedBlock(
                block_type="paragraph",
                text=reflow_paragraph_lines(current_lines),
                source_lines=tuple(current_source_lines),
            )
        )

    return tuple(paragraphs)


def reflow_opinion_body(parsed_opinion: ParsedOpinionBody) -> tuple[ReflowedBlock, ...]:
    blocks: list[ReflowedBlock] = []
    for component in parsed_opinion.components:
        blocks.extend(reflow_component(component))
    return tuple(blocks)


def make_footnote(label: str, lines: list[SourceLine]) -> Footnote:
    return Footnote(
        label=label,
        lines=tuple(lines),
        start_line=lines[0].line_number,
        end_line=lines[-1].line_number,
    )


def parse_footnotes_section(section: DocumentSection) -> ParsedFootnotes:
    if section.section_type != "footnotes":
        raise ValueError(f"Expected footnotes section, got {section.section_type}")

    heading_line: int | None = None
    footnotes: list[Footnote] = []
    trailing_lines: list[SourceLine] = []
    current_label: str | None = None
    current_lines: list[SourceLine] = []
    in_references = False

    def close_current() -> None:
        nonlocal current_label, current_lines
        if current_label is not None and current_lines:
            footnotes.append(make_footnote(current_label, current_lines))
        current_label = None
        current_lines = []

    for line in section.lines:
        stripped = line.text.strip()
        if heading_line is None and stripped == "Footnotes":
            heading_line = line.line_number
            continue
        if REFERENCES_HEADING_PATTERN.match(stripped):
            close_current()
            in_references = True
            trailing_lines.append(line)
            continue
        if in_references:
            trailing_lines.append(line)
            continue

        match = FOOTNOTE_START_PATTERN.match(stripped)
        if match:
            close_current()
            current_label = match.group("label")
            body = match.group("body")
            current_lines = [SourceLine(line.line_number, body)] if body else []
            continue

        if current_label is not None:
            current_lines.append(line)

    close_current()
    return ParsedFootnotes(
        heading_line=heading_line,
        footnotes=tuple(footnotes),
        trailing_lines=tuple(trailing_lines),
    )


def reflow_footnote(footnote: Footnote) -> tuple[ReflowedBlock, ...]:
    paragraphs: list[ReflowedBlock] = []
    current_lines: list[str] = []
    current_source_lines: list[int] = []

    for line in footnote.lines:
        normalized = left_align_text(line.text).rstrip()
        if not normalized.strip():
            if current_lines:
                paragraphs.append(
                    ReflowedBlock(
                        block_type="footnote_paragraph",
                        text=reflow_paragraph_lines(current_lines),
                        source_lines=tuple(current_source_lines),
                    )
                )
                current_lines = []
                current_source_lines = []
            continue
        current_lines.append(normalized)
        current_source_lines.append(line.line_number)

    if current_lines:
        paragraphs.append(
            ReflowedBlock(
                block_type="footnote_paragraph",
                text=reflow_paragraph_lines(current_lines),
                source_lines=tuple(current_source_lines),
            )
        )

    return tuple(paragraphs)


def reflow_footnotes(parsed_footnotes: ParsedFootnotes) -> dict[str, tuple[ReflowedBlock, ...]]:
    return {footnote.label: reflow_footnote(footnote) for footnote in parsed_footnotes.footnotes}


def clean_render_text(text: str, preserve_official_markers: bool = False) -> str:
    cleaned = left_align_text(text)
    cleaned = re.sub(r"\[\*\d+\]", "", cleaned)
    cleaned = re.sub(r"^\[\d+\]", "", cleaned)
    if not preserve_official_markers:
        cleaned = OFFICIAL_PAGE_MARKER_PATTERN.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def determine_header_author(parsed_header: ParsedHeader, parsed_opinion: ParsedOpinionBody) -> str | None:
    for component in parsed_header.components:
        if component.component_type == "header_author":
            return clean_render_text(component.line.text)
    for component in parsed_opinion.components:
        if component.component_type == "majority_opinion":
            if component.is_per_curiam:
                return "Per Curiam"
            if component.author:
                return f"{component.author}, J."
    return None


def render_header_markdown(parsed_header: ParsedHeader, parsed_opinion: ParsedOpinionBody) -> str:
    title = None
    citation = None
    court = None
    for component in parsed_header.components:
        text = clean_render_text(component.line.text, preserve_official_markers=True)
        if component.component_type == "header_case_name" and not title:
            title = text
        elif component.component_type == "header_citation" and not citation:
            citation = text
        elif component.component_type == "header_court" and not court:
            court = text

    author = determine_header_author(parsed_header, parsed_opinion)
    parts = [f"# {title}" if title else None, citation, court, author]
    return "\n\n".join(part for part in parts if part)


def render_opinion_body_markdown(
    parsed_opinion: ParsedOpinionBody, publication_status: str
) -> str:
    preserve_markers = publication_status == "published"
    rendered_blocks: list[str] = []
    for block in reflow_opinion_body(parsed_opinion):
        text = clean_render_text(block.text, preserve_official_markers=preserve_markers)
        if not text:
            continue
        if block.block_type == "subheader":
            level = "###" if re.fullmatch(r"[A-Z]\.", text) else "##"
            rendered_blocks.append(f"{level} {text}")
        else:
            rendered_blocks.append(text)
    return "\n\n".join(rendered_blocks)


def render_footnotes_markdown(parsed_footnotes: ParsedFootnotes) -> str:
    if not parsed_footnotes.footnotes:
        return ""

    parts = ["## Footnotes"]
    for footnote in parsed_footnotes.footnotes:
        blocks = reflow_footnote(footnote)
        paragraphs = [clean_render_text(block.text) for block in blocks if clean_render_text(block.text)]
        if not paragraphs:
            continue
        body = "\n\n".join(paragraphs)
        parts.append(f"{footnote.label}. {body}")
    return "\n\n".join(parts)


def render_document_markdown(document: SourceDocument) -> str:
    sections = {section.section_type: section for section in segment_document(document)}
    parsed_header = (
        parse_header_section(sections["header_block"])
        if "header_block" in sections
        else ParsedHeader(components=tuple(), publication_status="unknown")
    )
    parsed_opinion = (
        parse_opinion_section(sections["opinion_text"])
        if "opinion_text" in sections
        else ParsedOpinionBody(components=tuple(), errors=tuple())
    )
    parsed_footnotes = (
        parse_footnotes_section(sections["footnotes"])
        if "footnotes" in sections
        else ParsedFootnotes(heading_line=None, footnotes=tuple(), trailing_lines=tuple())
    )

    parts = [
        render_header_markdown(parsed_header, parsed_opinion),
        render_opinion_body_markdown(parsed_opinion, parsed_header.publication_status),
        render_footnotes_markdown(parsed_footnotes),
    ]
    return "\n\n".join(part for part in parts if part)


def is_header_line(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return True
    if OPINION_START_PATTERN.match(stripped) or stripped == "Footnotes":
        return False
    if SLIP_OP_CITATION_PATTERN.search(stripped):
        return True
    return any(
        pattern.match(stripped)
        for pattern in (
            HEADER_CASE_NAME_PATTERN,
            HEADER_CITATION_PATTERN,
            HEADER_COURT_PATTERN,
            HEADER_DATE_PATTERN,
            HEADER_COUNSEL_PATTERN,
            HEADER_APPEARANCES_PATTERN,
            HEADER_DOCKET_PATTERN,
            HEADER_CAPTION_V_PATTERN,
            HEADER_CAPTION_PARTY_PATTERN,
            HEADER_BOILERPLATE_PATTERN,
            HEADER_AUTHOR_PATTERN,
            HEADER_ACTION_PATTERN,
            HEADER_PANEL_PATTERN,
            GARBAGE_PATTERN,
        )
    )


def find_opinion_start(lines: tuple[SourceLine, ...]) -> int:
    for index, line in enumerate(lines):
        stripped = line.text.strip()
        if not stripped:
            continue
        if OPINION_START_PATTERN.match(stripped):
            return index
        if not is_header_line(line.text):
            return index
    return len(lines)


def build_section(section_type: str, lines: tuple[SourceLine, ...]) -> DocumentSection | None:
    if not lines:
        return None
    return DocumentSection(
        section_type=section_type,
        start_line=lines[0].line_number,
        end_line=lines[-1].line_number,
        lines=lines,
    )


def segment_document(document: SourceDocument) -> tuple[DocumentSection, ...]:
    footnotes_start: int | None = None
    for index, line in enumerate(document.lines):
        if line.text.strip() == "Footnotes":
            footnotes_start = index
            break

    main_lines = document.lines if footnotes_start is None else document.lines[:footnotes_start]
    footnote_lines = tuple() if footnotes_start is None else document.lines[footnotes_start:]
    opinion_start = find_opinion_start(main_lines)
    header_lines = main_lines[:opinion_start]
    opinion_lines = main_lines[opinion_start:]

    sections = [
        build_section("header_block", header_lines),
        build_section("opinion_text", opinion_lines),
        build_section("footnotes", footnote_lines),
    ]
    return tuple(section for section in sections if section is not None)


def classify_header_line(line: SourceLine) -> str:
    stripped = line.text.strip()
    if not stripped:
        return "header_blank"
    if GARBAGE_PATTERN.fullmatch(stripped):
        return "header_garbage"
    if HEADER_BOILERPLATE_PATTERN.match(stripped):
        return "header_boilerplate"
    if HEADER_CASE_NAME_PATTERN.match(stripped):
        return "header_case_name"
    if HEADER_CITATION_PATTERN.match(stripped) or SLIP_OP_CITATION_PATTERN.search(stripped):
        return "header_citation"
    if HEADER_COURT_PATTERN.match(stripped):
        return "header_court"
    if HEADER_AUTHOR_PATTERN.match(stripped):
        return "header_author"
    if HEADER_APPEARANCES_PATTERN.match(stripped):
        return "header_appearances_heading"
    if HEADER_DOCKET_PATTERN.match(stripped):
        return "header_docket_number"
    if HEADER_CAPTION_V_PATTERN.match(stripped):
        return "header_caption_v"
    if HEADER_CAPTION_PARTY_PATTERN.match(stripped):
        return "header_caption_party"
    if stripped.startswith("Corrected"):
        return "header_corrected_date"
    if stripped.startswith("Argued"):
        return "header_argued_date"
    if stripped.startswith("Decided"):
        return "header_decided_date"
    if HEADER_DATE_PATTERN.match(stripped):
        return "header_date_other"
    if HEADER_COUNSEL_PATTERN.match(stripped):
        return "header_counsel"
    if HEADER_ACTION_PATTERN.match(stripped):
        return "header_action"
    if HEADER_PANEL_PATTERN.match(stripped):
        return "header_panel"
    return "header_other"


def infer_publication_status(components: tuple[HeaderComponent, ...]) -> str:
    citation_text = " ".join(
        component.line.text
        for component in components
        if component.component_type == "header_citation"
    )
    if OFFICIAL_REPORTER_HEADER_PATTERN.search(citation_text):
        return "published"
    if SLIP_OP_CITATION_PATTERN.search(citation_text):
        return "slip_op_only"
    return "unknown"


def parse_header_section(section: DocumentSection) -> ParsedHeader:
    if section.section_type != "header_block":
        raise ValueError(f"Expected header_block section, got {section.section_type}")

    components = tuple(
        HeaderComponent(component_type=classify_header_line(line), line=line)
        for line in section.lines
    )
    return ParsedHeader(
        components=components,
        publication_status=infer_publication_status(components),
    )


def make_opinion_component(
    component_type: str,
    role_label: str,
    author: str | None,
    is_per_curiam: bool,
    lines: list[SourceLine],
) -> OpinionComponent:
    return OpinionComponent(
        component_type=component_type,
        role_label=role_label,
        author=author,
        is_per_curiam=is_per_curiam,
        lines=tuple(lines),
        start_line=lines[0].line_number,
        end_line=lines[-1].line_number,
    )


def normalize_role(role: str | None) -> tuple[str, str]:
    if role is None:
        return "majority_opinion", "majority"
    normalized = role.lower()
    if "concurring" in normalized and "dissenting" in normalized:
        return "mixed_opinion", "concurrence_and_dissent"
    if normalized == "concurring in result":
        return "concurring_opinion", "concurrence_in_result"
    if normalized == "concurring in part":
        return "concurring_opinion", "concurrence_in_part"
    if normalized == "dissenting in part":
        return "dissenting_opinion", "dissent_in_part"
    if normalized == "concurring":
        return "concurring_opinion", "concurrence"
    if normalized == "dissenting":
        return "dissenting_opinion", "dissent"
    return "mixed_opinion", "mixed_case_specific_opinion"


def detect_opinion_opener(text: str) -> tuple[str, str, str | None, bool] | None:
    stripped = text.strip()
    if not stripped:
        return None
    if PER_CURIAM_LINE_PATTERN.match(stripped):
        return ("majority_opinion", "per_curiam", None, True)
    if MEMORANDUM_LINE_PATTERN.match(stripped):
        return ("majority_opinion", "memorandum", None, True)
    if OPINION_OF_THE_COURT_LINE_PATTERN.match(stripped):
        return ("majority_opinion", "opinion_of_the_court", None, False)

    judge_match = JUDGE_OPENER_PATTERN.match(stripped)
    if judge_match:
        component_type, role_label = normalize_role(judge_match.group("role"))
        return (component_type, role_label, normalize_judge_name(judge_match.group("judge")), False)

    chief_match = CHIEF_JUDGE_OPENER_PATTERN.match(stripped)
    if chief_match:
        component_type, role_label = normalize_role(chief_match.group("role"))
        judge = normalize_judge_name(chief_match.group("judge1") or chief_match.group("judge2"))
        return (component_type, role_label, judge, False)

    return None


def parse_opinion_metadata_line(text: str) -> tuple[str, str | None] | None:
    match = OPINION_BY_PATTERN.match(text.strip())
    if not match:
        return None
    return ("opinion_by", normalize_judge_name(match.group("judge")))


def detect_opinion_opener_prefix(text: str) -> tuple[tuple[str, str, str | None, bool], int] | None:
    stripped = text.lstrip()
    offset = len(text) - len(stripped)
    judge_match = JUDGE_OPENER_PREFIX_PATTERN.match(stripped)
    if judge_match:
        component_type, role_label = normalize_role(judge_match.group("role"))
        return (
            (component_type, role_label, normalize_judge_name(judge_match.group("judge")), False),
            offset + judge_match.end(),
        )

    chief_match = CHIEF_JUDGE_OPENER_PREFIX_PATTERN.match(stripped)
    if chief_match:
        component_type, role_label = normalize_role(chief_match.group("role"))
        judge = normalize_judge_name(chief_match.group("judge1") or chief_match.group("judge2"))
        return ((component_type, role_label, judge, False), offset + chief_match.end())

    return None


def parse_opinion_section(section: DocumentSection) -> ParsedOpinionBody:
    if section.section_type != "opinion_text":
        raise ValueError(f"Expected opinion_text section, got {section.section_type}")

    components: list[OpinionComponent] = []
    errors: list[ParserError] = []
    current_type = ""
    current_role = ""
    current_author: str | None = None
    current_per_curiam = False
    current_lines: list[SourceLine] = []
    pending_majority_author: str | None = None
    saw_per_curiam_majority = False

    def close_component() -> None:
        nonlocal current_type, current_role, current_author, current_per_curiam, current_lines
        if current_lines:
            components.append(
                make_opinion_component(
                    current_type,
                    current_role,
                    current_author,
                    current_per_curiam,
                    current_lines,
                )
            )
        current_type = ""
        current_role = ""
        current_author = None
        current_per_curiam = False
        current_lines = []

    def start_component(
        component_type: str,
        role_label: str,
        author: str | None,
        is_per_curiam: bool,
        line: SourceLine,
    ) -> None:
        nonlocal current_type, current_role, current_author, current_per_curiam, current_lines
        close_component()
        current_type = component_type
        current_role = role_label
        current_author = author
        current_per_curiam = is_per_curiam
        current_lines = [line]

    for line in section.lines:
        metadata = parse_opinion_metadata_line(line.text)
        if metadata is not None:
            _, judge = metadata
            pending_majority_author = judge
            if saw_per_curiam_majority and judge is not None:
                errors.append(
                    ParserError(
                        code="conflicting_majority_authorship",
                        message="Per curiam majority marker conflicts with a named majority author.",
                        line_number=line.line_number,
                    )
                )
            components.append(
                OpinionComponent(
                    component_type="opinion_metadata",
                    role_label="opinion_by",
                    author=judge,
                    is_per_curiam=False,
                    lines=(line,),
                    start_line=line.line_number,
                    end_line=line.line_number,
                )
            )
            continue

        inline_match = INLINE_OPENER_PATTERN.search(line.text)
        if inline_match:
            before_text = line.text[: inline_match.start()].rstrip()
            opener_text = line.text[inline_match.start("opener") :].lstrip()
            if before_text:
                if not current_lines:
                    start_component(
                        "majority_opinion",
                        "majority",
                        pending_majority_author,
                        False,
                        SourceLine(line.line_number, before_text),
                    )
                    pending_majority_author = None
                else:
                    current_lines.append(SourceLine(line.line_number, before_text))
            opener_prefix = detect_opinion_opener_prefix(opener_text)
            if opener_prefix is not None:
                opener, opener_end = opener_prefix
                component_type, role_label, author, is_per_curiam = opener
                if component_type == "majority_opinion" and author is not None and saw_per_curiam_majority:
                    errors.append(
                        ParserError(
                            code="conflicting_majority_authorship",
                            message="Per curiam majority marker conflicts with a named majority author.",
                            line_number=line.line_number,
                        )
                    )
                if component_type == "majority_opinion" and is_per_curiam:
                    saw_per_curiam_majority = True
                opener_fragment = opener_text[:opener_end].rstrip()
                remainder = opener_text[opener_end:].lstrip()
                start_component(
                    component_type,
                    role_label,
                    author,
                    is_per_curiam,
                    SourceLine(line.line_number, opener_fragment),
                )
                if remainder:
                    current_lines.append(SourceLine(line.line_number, remainder))
                continue

        opener = detect_opinion_opener(line.text)
        if opener is not None:
            component_type, role_label, author, is_per_curiam = opener
            if component_type == "majority_opinion" and author is not None and saw_per_curiam_majority:
                errors.append(
                    ParserError(
                        code="conflicting_majority_authorship",
                        message="Per curiam majority marker conflicts with a named majority author.",
                        line_number=line.line_number,
                    )
                )
            if component_type == "majority_opinion" and is_per_curiam:
                saw_per_curiam_majority = True
            if component_type == "majority_opinion" and author is None and pending_majority_author is not None:
                author = pending_majority_author
                pending_majority_author = None
            start_component(component_type, role_label, author, is_per_curiam, line)
            continue

        stripped = line.text.strip()
        all_caps_author = ALL_CAPS_AUTHOR_PATTERN.match(stripped)
        if all_caps_author:
            judge = normalize_judge_name(all_caps_author.group("judge"))
            start_component(
                "majority_opinion",
                "majority",
                judge,
                False,
                line,
            )
            continue

        if ROMAN_SUBHEADER_PATTERN.match(stripped) or LETTER_SUBHEADER_PATTERN.match(stripped):
            close_component()
            components.append(
                OpinionComponent(
                    component_type="opinion_subheader",
                    role_label="opinion_subheader",
                    author=None,
                    is_per_curiam=False,
                    lines=(line,),
                    start_line=line.line_number,
                    end_line=line.line_number,
                )
            )
            continue

        if BODY_SUBHEADER_PATTERN.match(stripped) and stripped not in {"Per Curiam", "Memorandum", "OPINION OF THE COURT"}:
            close_component()
            components.append(
                OpinionComponent(
                    component_type="opinion_subheader",
                    role_label="opinion_subheader",
                    author=None,
                    is_per_curiam=False,
                    lines=(line,),
                    start_line=line.line_number,
                    end_line=line.line_number,
                )
            )
            continue

        if not current_lines:
            start_component(
                "majority_opinion",
                "majority",
                pending_majority_author,
                False,
                line,
            )
            pending_majority_author = None
        else:
            current_lines.append(line)

    close_component()
    return ParsedOpinionBody(components=tuple(components), errors=tuple(errors))


def scan_line(line: SourceLine) -> tuple[Token, ...]:
    tokens: list[Token] = []
    for token_type, pattern in (
        ("introductory_signal", INTRODUCTORY_SIGNAL_PATTERN),
        ("cross_reference", CROSS_REFERENCE_PATTERN),
        ("page_marker", PAGE_MARKER_PATTERN),
        ("garbage", GARBAGE_PATTERN),
    ):
        for match in pattern.finditer(line.text):
            tokens.append(
                Token(
                    token_type=token_type,
                    span=Span(line.line_number, match.start(), match.end()),
                    text=match.group(0),
                )
            )

    stripped = line.text.strip()
    if stripped:
        for token_type, pattern in (
            ("opinion_subheader", OPINION_SUBHEADER_PATTERN),
            ("header_casename", HEADER_CASE_NAME_PATTERN),
            ("header_citation", HEADER_CITATION_PATTERN),
            ("header_court", HEADER_COURT_PATTERN),
        ):
            if pattern.match(stripped):
                start = line.text.find(stripped)
                tokens.append(
                    Token(
                        token_type=token_type,
                        span=Span(line.line_number, start, start + len(stripped)),
                        text=stripped,
                    )
                )

    return tuple(sorted(tokens, key=lambda token: (token.span.start, token.span.end, token.token_type)))


def build_signal_detector(signal_text: str) -> Callable[[SourceLine, tuple[Token, ...]], list[RuleMatch]]:
    def detect(line: SourceLine, tokens: tuple[Token, ...]) -> list[RuleMatch]:
        matches: list[RuleMatch] = []
        for token in tokens:
            if token.token_type != "introductory_signal" or token.text != signal_text:
                continue
            reporter_match = REPORTER_PATTERN.search(line.text, pos=token.span.end)
            if not reporter_match:
                continue
            if is_already_italicized(line.text, token.span.start, token.span.end):
                continue
            matches.append(
                RuleMatch(
                    span=token.span,
                    replacement=build_italicized_text(line.text, token.span.start, token.span.end),
                )
            )
        return matches

    return detect


def detect_italicize_case_names_in_citations(
    line: SourceLine, tokens: tuple[Token, ...]
) -> list[RuleMatch]:
    del tokens
    matches: list[RuleMatch] = []
    for case_match in CASE_NAME_IN_CITATION_PATTERN.finditer(line.text):
        start, end = case_match.span("case")
        if is_already_italicized(line.text, start, end):
            continue
        matches.append(
            RuleMatch(
                span=Span(line.line_number, start, end),
                replacement=build_italicized_text(line.text, start, end),
            )
        )
    return matches


RULES: tuple[RuleDefinition, ...] = (
    RuleDefinition(
        rule_id="TB001",
        name="Italicize 'see e.g.'",
        category="citation_signal",
        reason="Citation signals should be italicized when they introduce a citation.",
        examples=(
            RuleExample(
                before="(see e.g. People v Cawford, 128 NY3d 16, 19 [2006])",
                after="(*see e.g.* People v Cawford, 128 NY3d 16, 19 [2006])",
            ),
        ),
        detect=build_signal_detector("see e.g."),
    ),
    RuleDefinition(
        rule_id="TB002",
        name="Italicize 'cf.'",
        category="citation_signal",
        reason="Citation signals should be italicized when they introduce a citation.",
        examples=(
            RuleExample(
                before="(cf. People v Smith, 128 NY3d 16 [2006])",
                after="(*cf.* People v Smith, 128 NY3d 16 [2006])",
            ),
        ),
        detect=build_signal_detector("cf."),
    ),
    RuleDefinition(
        rule_id="TB003",
        name="Italicize case names in full citations",
        category="case_name",
        reason="Case names should be italicized in obvious citation contexts.",
        examples=(
            RuleExample(
                before="People v Smith, 128 NY3d 16, 19 [2006]",
                after="*People v Smith*, 128 NY3d 16, 19 [2006]",
            ),
            RuleExample(
                before="Matter of Jones v Smith, 45 AD3d 12 [2004]",
                after="*Matter of Jones v Smith*, 45 AD3d 12 [2004]",
            ),
        ),
        detect=detect_italicize_case_names_in_citations,
    ),
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="stanbook",
        description=(
            "Analyze a plain-text opinion file and emit Tan-Book-derived Markdown "
            "formatting suggestions."
        ),
    )
    parser.add_argument("path", help="Path to the opinion text file")
    return parser


def build_finding(rule: RuleDefinition, line: SourceLine, match: RuleMatch) -> Finding:
    return Finding(
        line_number=line.line_number,
        rule_id=rule.rule_id,
        rule_name=rule.name,
        rule_category=rule.category,
        reason=rule.reason,
        original=line.text,
        suggestion=match.replacement,
        snippet=build_snippet(line.text, match.span),
        column=match.span.start,
        end_column=match.span.end,
    )


def analyze_document(document: SourceDocument, rules: Iterable[RuleDefinition]) -> list[Finding]:
    findings: list[Finding] = []
    for section in segment_document(document):
        for line in section.lines:
            tokens = scan_line(line)
            for rule in rules:
                matches = rule.detect(line, tokens)
                findings.extend(build_finding(rule, line, match) for match in matches)
    return sorted(findings, key=lambda finding: (finding.line_number, finding.column, finding.rule_id))


def analyze_lines(lines: Iterable[str], rules: Iterable[RuleDefinition]) -> list[Finding]:
    document = SourceDocument(
        path=Path("<memory>"),
        lines=tuple(
            SourceLine(line_number=index, text=text)
            for index, text in enumerate(lines, start=1)
        ),
    )
    return analyze_document(document, rules)


def format_finding(finding: Finding) -> str:
    return "\n".join(
        [
            f"Line {finding.line_number} | {finding.rule_id} | {finding.rule_name}",
            f'From: "{finding.original}"',
            f'To:   "{finding.suggestion}"',
            f"Why:  {finding.reason}",
        ]
    )


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    document = SourceDocument.from_path(Path(args.path))
    findings = analyze_document(document, RULES)

    if not findings:
        print("No suggestions!")
        return 0

    print("\n\n".join(format_finding(finding) for finding in findings))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
