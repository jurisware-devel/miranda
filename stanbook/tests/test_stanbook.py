from pathlib import Path
import subprocess
import sys
import unittest

from stanbook import RULES
from stanbook import DocumentSection
from stanbook import HeaderComponent
from stanbook import ParsedOpinionBody
from stanbook import ParserError
from stanbook import ParsedHeader
from stanbook import SourceDocument
from stanbook import SourceLine
from stanbook import Span
from stanbook import analyze_lines
from stanbook import build_snippet
from stanbook import classify_header_line
from stanbook import format_finding
from stanbook import left_align_text
from stanbook import parse_footnotes_section
from stanbook import parse_opinion_section
from stanbook import parse_header_section
from stanbook import render_document_markdown
from stanbook import render_footnotes_markdown
from stanbook import render_header_markdown
from stanbook import render_opinion_body_markdown
from stanbook import is_header_line
from stanbook import infer_publication_status
from stanbook import reflow_component
from stanbook import reflow_footnote
from stanbook import reflow_footnotes
from stanbook import reflow_opinion_body
from stanbook import reflow_paragraph_lines
from stanbook import scan_line
from stanbook import segment_document


class StanbookTests(unittest.TestCase):
    def test_citation_signal_rule_generates_finding(self) -> None:
        findings = analyze_lines(
            ['"...in her bedroom (see e.g. People v Cawford, 128 NY3d 16, 19 [2006])."'],
            RULES,
        )

        self.assertEqual(len(findings), 2)
        finding = findings[0]
        self.assertEqual(finding.line_number, 1)
        self.assertEqual(finding.rule_id, "TB001")
        self.assertEqual(finding.rule_category, "citation_signal")
        self.assertEqual(
            finding.suggestion,
            '"...in her bedroom (*see e.g.* People v Cawford, 128 NY3d 16, 19 [2006])."',
        )

    def test_format_finding_includes_phase_one_fields(self) -> None:
        finding = analyze_lines(["see e.g. People v Smith, 128 NY3d 16 [2006]"], RULES)[0]

        self.assertEqual(
            format_finding(finding),
            "\n".join(
                [
                    "Line 1 | TB001 | Italicize 'see e.g.'",
                    'From: "see e.g. People v Smith, 128 NY3d 16 [2006]"',
                    'To:   "*see e.g.* People v Smith, 128 NY3d 16 [2006]"',
                    "Why:  Citation signals should be italicized when they introduce a citation.",
                ]
            ),
        )

    def test_rule_metadata_includes_examples_and_category(self) -> None:
        rule = RULES[0]

        self.assertEqual(rule.rule_id, "TB001")
        self.assertEqual(rule.category, "citation_signal")
        self.assertEqual(len(rule.examples), 1)
        self.assertEqual(
            rule.examples[0].after,
            "(*see e.g.* People v Cawford, 128 NY3d 16, 19 [2006])",
        )

    def test_source_document_preserves_line_numbers(self) -> None:
        document = SourceDocument(
            path=Path("<memory>"),
            lines=(
                SourceLine(line_number=1, text="first"),
                SourceLine(line_number=2, text="second"),
            ),
        )

        self.assertEqual(document.path.name, "<memory>")
        self.assertEqual(document.lines[1].line_number, 2)

    def test_header_detection_recognizes_header_lines(self) -> None:
        self.assertTrue(is_header_line("People v Smith"))
        self.assertTrue(is_header_line("41 NY3d 146 [2006]"))
        self.assertTrue(is_header_line("Argued January 5, 2006"))
        self.assertFalse(is_header_line("The issue before us is whether the order should be reversed."))

    def test_document_segmentation_splits_header_body_and_footnotes(self) -> None:
        document = SourceDocument(
            path=Path("<memory>"),
            lines=(
                SourceLine(1, "People v Smith"),
                SourceLine(2, "41 NY3d 146 [2006]"),
                SourceLine(3, "NY Court of Appeals"),
                SourceLine(4, "Argued January 5, 2006"),
                SourceLine(5, "Decided March 1, 2006"),
                SourceLine(6, "OPINION OF THE COURT"),
                SourceLine(7, "see e.g. People v Jones, 45 NY3d 12 [2004]"),
                SourceLine(8, "Footnotes"),
                SourceLine(9, "[FN1] Example footnote."),
            ),
        )

        sections = segment_document(document)

        self.assertEqual([section.section_type for section in sections], ["header_block", "opinion_text", "footnotes"])
        self.assertEqual(sections[0].start_line, 1)
        self.assertEqual(sections[0].end_line, 5)
        self.assertEqual(sections[1].start_line, 6)
        self.assertEqual(sections[2].start_line, 8)

    def test_document_segmentation_handles_sample_style_header(self) -> None:
        document = SourceDocument(
            path=Path("<memory>"),
            lines=(
                SourceLine(1, "People v Shaw"),
                SourceLine(2, "2026 NY Slip Op 00961"),
                SourceLine(3, "Decided on February 19, 2026"),
                SourceLine(4, "Court of Appeals"),
                SourceLine(5, "Halligan, J."),
                SourceLine(6, "Published by [1]New York State Law Reporting Bureau pursuant to"),
                SourceLine(7, "Judiciary Law § 431."),
                SourceLine(8, "[*1]The People & c., Respondent,"),
                SourceLine(9, "v"),
                SourceLine(10, "Samuel Shaw, & c., Appellant."),
                SourceLine(11, "Clea Weiss, for appellant."),
                SourceLine(12, "HALLIGAN, J."),
                SourceLine(13, "The defendant was convicted of two counts of murder."),
            ),
        )

        sections = segment_document(document)

        self.assertEqual([section.section_type for section in sections], ["header_block", "opinion_text"])
        self.assertEqual(sections[0].end_line, 12)
        self.assertEqual(sections[1].start_line, 13)

    def test_document_segmentation_starts_opinion_at_first_non_header_line(self) -> None:
        document = SourceDocument(
            path=Path("<memory>"),
            lines=(
                SourceLine(1, "People v Smith"),
                SourceLine(2, "41 NY3d 146 [2006]"),
                SourceLine(3, ""),
                SourceLine(4, "The issue before us is whether the order should be reversed."),
            ),
        )

        sections = segment_document(document)

        self.assertEqual([section.section_type for section in sections], ["header_block", "opinion_text"])
        self.assertEqual(sections[1].start_line, 4)

    def test_header_line_classifier_preserves_specific_component_types(self) -> None:
        self.assertEqual(classify_header_line(SourceLine(1, "People v Smith")), "header_case_name")
        self.assertEqual(classify_header_line(SourceLine(2, "41 NY3d 146 [2006]")), "header_citation")
        self.assertEqual(classify_header_line(SourceLine(3, "NY Court of Appeals")), "header_court")
        self.assertEqual(classify_header_line(SourceLine(4, "Corrected June 1, 2006")), "header_corrected_date")
        self.assertEqual(classify_header_line(SourceLine(5, "Argued January 5, 2006")), "header_argued_date")
        self.assertEqual(classify_header_line(SourceLine(6, "Decided March 1, 2006")), "header_decided_date")
        self.assertEqual(classify_header_line(SourceLine(7, "Jane Doe, for appellant.")), "header_counsel")
        self.assertEqual(classify_header_line(SourceLine(8, "People v Smith, 112 AD3d 114, reversed.")), "header_action")
        self.assertEqual(classify_header_line(SourceLine(9, "[*1]")), "header_garbage")
        self.assertEqual(classify_header_line(SourceLine(10, "APPEARANCES OF COUNSEL")), "header_appearances_heading")
        self.assertEqual(classify_header_line(SourceLine(11, "No. 113")), "header_docket_number")
        self.assertEqual(classify_header_line(SourceLine(12, "v")), "header_caption_v")
        self.assertEqual(
            classify_header_line(SourceLine(13, "Published by [1]New York State Law Reporting Bureau pursuant to")),
            "header_boilerplate",
        )
        self.assertEqual(classify_header_line(SourceLine(14, "Some unusual header line")), "header_other")

    def test_parse_header_section_preserves_order_and_labels(self) -> None:
        section = DocumentSection(
            section_type="header_block",
            start_line=1,
            end_line=6,
            lines=(
                SourceLine(1, "People v Smith"),
                SourceLine(2, "2024 NY Slip Op 01234(U)"),
                SourceLine(3, "NY Court of Appeals"),
                SourceLine(4, "Argued January 5, 2024"),
                SourceLine(5, "Decided March 1, 2024"),
                SourceLine(6, "Jane Doe, for appellant."),
            ),
        )

        parsed = parse_header_section(section)

        self.assertEqual(
            [component.component_type for component in parsed.components],
            [
                "header_case_name",
                "header_citation",
                "header_court",
                "header_argued_date",
                "header_decided_date",
                "header_counsel",
            ],
        )
        self.assertEqual([component.line.line_number for component in parsed.components], [1, 2, 3, 4, 5, 6])
        self.assertEqual(parsed.publication_status, "slip_op_only")

    def test_publication_status_detects_published_when_official_reporter_present(self) -> None:
        components = (
            HeaderComponent("header_case_name", SourceLine(1, "People v Smith")),
            HeaderComponent("header_citation", SourceLine(2, "41 NY3d 146 [2006]")),
            HeaderComponent("header_citation", SourceLine(3, "2006 NY Slip Op 12345(U)")),
        )

        self.assertEqual(infer_publication_status(components), "published")

    def test_publication_status_is_unknown_without_citation(self) -> None:
        components = (
            HeaderComponent("header_case_name", SourceLine(1, "People v Smith")),
            HeaderComponent("header_other", SourceLine(2, "Unusual header text")),
        )

        self.assertEqual(infer_publication_status(components), "unknown")

    def test_parse_opinion_section_detects_per_curiam_majority(self) -> None:
        section = DocumentSection(
            section_type="opinion_text",
            start_line=10,
            end_line=12,
            lines=(
                SourceLine(10, "Memorandum"),
                SourceLine(11, "The order should be affirmed."),
                SourceLine(12, "Because the issue is unpreserved."),
            ),
        )

        parsed = parse_opinion_section(section)

        self.assertEqual(len(parsed.errors), 0)
        self.assertEqual(len(parsed.components), 1)
        self.assertEqual(parsed.components[0].component_type, "majority_opinion")
        self.assertTrue(parsed.components[0].is_per_curiam)
        self.assertEqual(parsed.components[0].role_label, "memorandum")

    def test_parse_opinion_section_assigns_majority_author_from_metadata(self) -> None:
        section = DocumentSection(
            section_type="opinion_text",
            start_line=20,
            end_line=22,
            lines=(
                SourceLine(20, "Opinion by Judge Smith."),
                SourceLine(21, "The order should be affirmed."),
                SourceLine(22, "The statute is clear."),
            ),
        )

        parsed = parse_opinion_section(section)

        self.assertEqual(parsed.components[0].component_type, "opinion_metadata")
        self.assertEqual(parsed.components[1].component_type, "majority_opinion")
        self.assertEqual(parsed.components[1].author, "Smith")
        self.assertFalse(parsed.components[1].is_per_curiam)

    def test_parse_opinion_section_records_conflict_for_per_curiam_and_named_majority(self) -> None:
        section = DocumentSection(
            section_type="opinion_text",
            start_line=30,
            end_line=32,
            lines=(
                SourceLine(30, "Per Curiam."),
                SourceLine(31, "Opinion by Judge Smith."),
                SourceLine(32, "The order should be affirmed."),
            ),
        )

        parsed = parse_opinion_section(section)

        self.assertEqual(len(parsed.errors), 1)
        self.assertEqual(parsed.errors[0].code, "conflicting_majority_authorship")

    def test_parse_opinion_section_detects_named_dissent(self) -> None:
        section = DocumentSection(
            section_type="opinion_text",
            start_line=40,
            end_line=43,
            lines=(
                SourceLine(40, "Per Curiam."),
                SourceLine(41, "The order should be affirmed."),
                SourceLine(42, "Rivera, J. (dissenting):"),
                SourceLine(43, "I would reverse."),
            ),
        )

        parsed = parse_opinion_section(section)

        self.assertEqual([component.component_type for component in parsed.components], ["majority_opinion", "dissenting_opinion"])
        self.assertEqual(parsed.components[1].author, "Rivera")
        self.assertEqual(parsed.components[1].role_label, "dissent")

    def test_parse_opinion_section_detects_inline_transition(self) -> None:
        section = DocumentSection(
            section_type="opinion_text",
            start_line=50,
            end_line=50,
            lines=(
                SourceLine(50, "The order should be affirmed. Garcia, J. (dissenting): I would reverse."),
            ),
        )

        parsed = parse_opinion_section(section)

        self.assertEqual(len(parsed.components), 2)
        self.assertEqual(parsed.components[0].component_type, "majority_opinion")
        self.assertEqual(parsed.components[1].component_type, "dissenting_opinion")
        self.assertEqual(parsed.components[1].author, "Garcia")

    def test_parse_opinion_section_detects_all_caps_majority_author_line(self) -> None:
        section = DocumentSection(
            section_type="opinion_text",
            start_line=60,
            end_line=62,
            lines=(
                SourceLine(60, "HALLIGAN, J."),
                SourceLine(61, "The defendant was convicted."),
                SourceLine(62, "The judgment should be modified."),
            ),
        )

        parsed = parse_opinion_section(section)

        self.assertEqual(len(parsed.components), 1)
        self.assertEqual(parsed.components[0].component_type, "majority_opinion")
        self.assertEqual(parsed.components[0].author, "Halligan")

    def test_parse_opinion_section_detects_roman_and_letter_subheaders(self) -> None:
        section = DocumentSection(
            section_type="opinion_text",
            start_line=70,
            end_line=75,
            lines=(
                SourceLine(70, "TROUTMAN, J."),
                SourceLine(71, "Opening paragraph."),
                SourceLine(72, "I."),
                SourceLine(73, "Section body."),
                SourceLine(74, "A."),
                SourceLine(75, "Subsection body."),
            ),
        )

        parsed = parse_opinion_section(section)

        self.assertEqual(
            [component.component_type for component in parsed.components],
            ["majority_opinion", "opinion_subheader", "majority_opinion", "opinion_subheader", "majority_opinion"],
        )

    def test_left_align_text_removes_leading_indentation(self) -> None:
        self.assertEqual(left_align_text("        The defendant was convicted."), "The defendant was convicted.")

    def test_reflow_paragraph_lines_joins_wrapped_lines(self) -> None:
        self.assertEqual(
            reflow_paragraph_lines(
                [
                    "The defendant was convicted of two counts of murder in the first",
                    "degree and one count of robbery.",
                ]
            ),
            "The defendant was convicted of two counts of murder in the first degree and one count of robbery.",
        )

    def test_reflow_component_preserves_blank_line_paragraph_breaks(self) -> None:
        component = ParsedOpinionBody(
            components=(
                type(
                    "OpinionComponentStub",
                    (),
                    {
                        "component_type": "majority_opinion",
                        "lines": (
                            SourceLine(1, "   First wrapped"),
                            SourceLine(2, "line of text."),
                            SourceLine(3, ""),
                            SourceLine(4, "   Second paragraph starts"),
                            SourceLine(5, "here."),
                        ),
                    },
                )(),
            ),
            errors=(),
        ).components[0]

        blocks = reflow_component(component)

        self.assertEqual(len(blocks), 2)
        self.assertEqual(blocks[0].text, "First wrapped line of text.")
        self.assertEqual(blocks[1].text, "Second paragraph starts here.")

    def test_reflow_opinion_body_respects_subheader_boundaries(self) -> None:
        section = DocumentSection(
            section_type="opinion_text",
            start_line=80,
            end_line=84,
            lines=(
                SourceLine(80, "TROUTMAN, J."),
                SourceLine(81, "Opening paragraph first"),
                SourceLine(82, "line."),
                SourceLine(83, "I."),
                SourceLine(84, "New section starts here."),
            ),
        )

        parsed = parse_opinion_section(section)
        blocks = reflow_opinion_body(parsed)

        self.assertEqual([block.block_type for block in blocks], ["paragraph", "subheader", "paragraph"])
        self.assertEqual(blocks[0].text, "TROUTMAN, J. Opening paragraph first line.")
        self.assertEqual(blocks[1].text, "I.")
        self.assertEqual(blocks[2].text, "New section starts here.")

    def test_parse_footnotes_section_extracts_individual_footnotes(self) -> None:
        section = DocumentSection(
            section_type="footnotes",
            start_line=100,
            end_line=109,
            lines=(
                SourceLine(100, "Footnotes"),
                SourceLine(101, ""),
                SourceLine(102, "[25]Footnote 1: First footnote opening line"),
                SourceLine(103, "continues here."),
                SourceLine(104, "[26]Footnote 2: Second footnote starts"),
                SourceLine(105, "and continues."),
                SourceLine(106, ""),
                SourceLine(107, "References"),
                SourceLine(108, "1. http://example.com"),
                SourceLine(109, "2. http://example.org"),
            ),
        )

        parsed = parse_footnotes_section(section)

        self.assertEqual(parsed.heading_line, 100)
        self.assertEqual([footnote.label for footnote in parsed.footnotes], ["1", "2"])
        self.assertEqual(parsed.footnotes[0].start_line, 102)
        self.assertEqual(parsed.trailing_lines[0].text, "References")

    def test_reflow_footnote_joins_wrapped_lines_and_preserves_blank_breaks(self) -> None:
        section = DocumentSection(
            section_type="footnotes",
            start_line=110,
            end_line=116,
            lines=(
                SourceLine(110, "Footnotes"),
                SourceLine(111, "[25]Footnote 1: First wrapped"),
                SourceLine(112, "line."),
                SourceLine(113, ""),
                SourceLine(114, "Second paragraph"),
                SourceLine(115, "here."),
                SourceLine(116, "References"),
            ),
        )

        parsed = parse_footnotes_section(section)
        blocks = reflow_footnote(parsed.footnotes[0])

        self.assertEqual(len(blocks), 2)
        self.assertEqual(blocks[0].text, "First wrapped line.")
        self.assertEqual(blocks[1].text, "Second paragraph here.")

    def test_reflow_footnotes_returns_blocks_by_label(self) -> None:
        section = DocumentSection(
            section_type="footnotes",
            start_line=120,
            end_line=124,
            lines=(
                SourceLine(120, "Footnotes"),
                SourceLine(121, "[25]Footnote 1: Alpha"),
                SourceLine(122, "[26]Footnote 2: Beta"),
                SourceLine(123, "continued."),
                SourceLine(124, "References"),
            ),
        )

        parsed = parse_footnotes_section(section)
        reflowed = reflow_footnotes(parsed)

        self.assertEqual(sorted(reflowed.keys()), ["1", "2"])
        self.assertEqual(reflowed["2"][0].text, "Beta continued.")

    def test_render_header_markdown_outputs_basic_header_block(self) -> None:
        header = parse_header_section(
            DocumentSection(
                section_type="header_block",
                start_line=1,
                end_line=4,
                lines=(
                    SourceLine(1, "People v Shaw"),
                    SourceLine(2, "2026 NY Slip Op 00961"),
                    SourceLine(3, "Court of Appeals"),
                    SourceLine(4, "Halligan, J."),
                ),
            )
        )
        opinion = parse_opinion_section(
            DocumentSection(
                section_type="opinion_text",
                start_line=5,
                end_line=6,
                lines=(
                    SourceLine(5, "The defendant was convicted."),
                    SourceLine(6, "The judgment should be modified."),
                ),
            )
        )

        rendered = render_header_markdown(header, opinion)

        self.assertIn("# People v Shaw", rendered)
        self.assertIn("2026 NY Slip Op 00961", rendered)
        self.assertIn("Court of Appeals", rendered)
        self.assertIn("Halligan, J.", rendered)

    def test_render_opinion_body_markdown_preserves_official_page_markers_for_published(self) -> None:
        opinion = parse_opinion_section(
            DocumentSection(
                section_type="opinion_text",
                start_line=1,
                end_line=3,
                lines=(
                    SourceLine(1, "{**2 NY3d at 595} OPINION OF THE COURT"),
                    SourceLine(2, "Rosenblatt, J."),
                    SourceLine(3, "The conviction must be reversed."),
                ),
            )
        )

        rendered = render_opinion_body_markdown(opinion, publication_status="published")

        self.assertIn("{**2 NY3d at 595}", rendered)

    def test_render_opinion_body_markdown_strips_slip_page_markers(self) -> None:
        opinion = parse_opinion_section(
            DocumentSection(
                section_type="opinion_text",
                start_line=1,
                end_line=3,
                lines=(
                    SourceLine(1, "[*2]I."),
                    SourceLine(2, "The defendant was convicted of two counts"),
                    SourceLine(3, "of murder."),
                ),
            )
        )

        rendered = render_opinion_body_markdown(opinion, publication_status="slip_op_only")

        self.assertIn("## I.", rendered)
        self.assertNotIn("[*2]", rendered)

    def test_render_footnotes_markdown_outputs_numbered_blocks(self) -> None:
        parsed = parse_footnotes_section(
            DocumentSection(
                section_type="footnotes",
                start_line=1,
                end_line=4,
                lines=(
                    SourceLine(1, "Footnotes"),
                    SourceLine(2, "[25]Footnote 1: First wrapped"),
                    SourceLine(3, "line."),
                    SourceLine(4, "References"),
                ),
            )
        )

        rendered = render_footnotes_markdown(parsed)

        self.assertIn("## Footnotes", rendered)
        self.assertIn("1. First wrapped line.", rendered)

    def test_render_document_markdown_outputs_end_to_end_shape(self) -> None:
        document = SourceDocument(
            path=Path("<memory>"),
            lines=(
                SourceLine(1, "People v Sample"),
                SourceLine(2, "2026 NY Slip Op 00001"),
                SourceLine(3, "Court of Appeals"),
                SourceLine(4, "Sample, J."),
                SourceLine(5, ""),
                SourceLine(6, "The People & c., Respondent,"),
                SourceLine(7, "v"),
                SourceLine(8, "John Sample, Appellant."),
                SourceLine(9, "Sample Counsel, for appellant."),
                SourceLine(10, "SAMPLE, J."),
                SourceLine(11, "The defendant was convicted of two counts"),
                SourceLine(12, "of murder."),
                SourceLine(13, "Footnotes"),
                SourceLine(14, "[25]Footnote 1: Example footnote"),
                SourceLine(15, "text."),
                SourceLine(16, "References"),
            ),
        )

        rendered = render_document_markdown(document)

        self.assertIn("# People v Sample", rendered)
        self.assertIn("The defendant was convicted of two counts of murder.", rendered)
        self.assertIn("## Footnotes", rendered)
        self.assertIn("1. Example footnote text.", rendered)

    def test_single_rule_can_report_multiple_matches_on_one_line(self) -> None:
        findings = analyze_lines(
            ["see e.g. People v Smith, 128 NY3d 16 and later see e.g. People v Jones, 45 AD3d 12"],
            [RULES[0]],
        )

        self.assertEqual(len(findings), 2)
        self.assertLess(findings[0].column, findings[1].column)

    def test_case_name_rule_generates_finding_in_full_citation(self) -> None:
        findings = analyze_lines(["see People v Smith, 128 NY3d 16, 19 [2006]"], RULES)

        case_name_findings = [finding for finding in findings if finding.rule_id == "TB003"]
        self.assertEqual(len(case_name_findings), 1)
        self.assertEqual(
            case_name_findings[0].suggestion,
            "see *People v Smith*, 128 NY3d 16, 19 [2006]",
        )

    def test_case_name_rule_skips_prose_reference(self) -> None:
        findings = analyze_lines(["In People v Smith, the Court held that the issue was preserved."], RULES)

        self.assertEqual(findings, [])

    def test_cf_signal_generates_finding_in_citation_context(self) -> None:
        findings = analyze_lines(["cf. People v Smith, 128 NY3d 16 [2006]"], RULES)

        cf_findings = [finding for finding in findings if finding.rule_id == "TB002"]
        self.assertEqual(len(cf_findings), 1)
        self.assertEqual(
            cf_findings[0].suggestion,
            "*cf.* People v Smith, 128 NY3d 16 [2006]",
        )

    def test_signal_rule_skips_non_citation_context(self) -> None:
        findings = analyze_lines(["We see e.g. many examples in the record."], RULES)

        self.assertEqual(findings, [])

    def test_scanner_emits_expected_token_types(self) -> None:
        source_line = SourceLine(line_number=1, text="see e.g. [*1] {**41 NY3d at 147} supra")
        tokens = scan_line(source_line)

        self.assertEqual(
            [token.token_type for token in tokens],
            ["introductory_signal", "garbage", "page_marker", "cross_reference"],
        )

    def test_snippet_builder_clips_long_lines(self) -> None:
        text = "A" * 50 + "People v Smith" + "B" * 50
        snippet = build_snippet(text, Span(line_number=1, start=50, end=64), margin=10)

        self.assertTrue(snippet.startswith("..."))
        self.assertTrue(snippet.endswith("..."))
        self.assertIn("People v Smith", snippet)

    def test_finding_tracks_end_column_and_snippet(self) -> None:
        finding = analyze_lines(["see e.g. People v Smith, 128 NY3d 16 [2006]"], RULES)[0]

        self.assertGreater(finding.end_column, finding.column)
        self.assertIn("People v Smith", finding.snippet)

    def test_cli_prints_no_suggestions_when_clean(self) -> None:
        workspace = Path(__file__).resolve().parents[1]
        tmp_dir = workspace / "tests" / "tmp"
        tmp_dir.mkdir(exist_ok=True)
        sample = tmp_dir / "clean.txt"
        self.addCleanup(lambda: sample.unlink(missing_ok=True))
        sample.write_text("Nothing to fix here.\n", encoding="utf-8")

        result = subprocess.run(
            [sys.executable, "stanbook.py", str(sample)],
            capture_output=True,
            text=True,
            cwd=workspace,
            check=False,
        )

        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "No suggestions!")

    def test_cli_reports_missing_file(self) -> None:
        result = subprocess.run(
            [sys.executable, "stanbook.py", "missing.txt"],
            capture_output=True,
            text=True,
            cwd=Path(__file__).resolve().parents[1],
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Error: file not found:", result.stderr)


if __name__ == "__main__":
    unittest.main()
