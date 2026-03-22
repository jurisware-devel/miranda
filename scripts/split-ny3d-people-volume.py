#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from pypdf import PdfReader, PdfWriter


CASE_LINE_RE = re.compile(
    r"- `(?P<cite>(?P<volume>\d+) NY3d (?P<page>\d+))` - (?P<case_name>.+?) \(`(?P<case_id>[^`]+)`\)"
)
OFFSET_RE = re.compile(
    r"- Volume (?P<volume>\d+), Page 1 begins on page (?P<offset>\d+) of `(?P<pdf>[^`]+)`\."
)
TOC_PAGE_RE = re.compile(r"[—-](?P<volume>\d+)\s+NY3d\s+(?P<page>\d+)")
REPORTER_PAGE_RE = re.compile(
    r"(?:(?P<page_before>\d+)\s+(?P<volume_before>\d+)\s+NEW YORK REPORTS,\s*3d SERIES|"
    r"(?P<volume_after>\d+)\s+NEW YORK REPORTS,\s*3d SERIES\s*(?P<page_after>\d+))"
)
MEMORANDA_PAGE_RE = re.compile(r"(\d+)MEMORANDA")
BRACKET_PAGE_RE = re.compile(r"\[\d+\s+NY3d\s+(\d+)\]\s+(\d+)")
NOISE_WORDS = {
    "people",
    "rel",
    "the",
    "state",
    "new",
    "york",
    "matter",
    "appellant",
    "respondent",
    "petitioner",
}


def slugify(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_")
    return slug or "case"


def normalize_assumptions_text(text: str) -> str:
    return text.replace("\ufeff", "")


def parse_assumptions(path: Path) -> tuple[int, str, list[dict[str, object]]]:
    offset = None
    pdf_name = None
    cases: list[dict[str, object]] = []

    for line in normalize_assumptions_text(path.read_text(encoding="utf-8")).splitlines():
        offset_match = OFFSET_RE.match(line)
        if offset_match:
            offset = int(offset_match.group("offset"))
            pdf_name = offset_match.group("pdf")
            continue

        case_match = CASE_LINE_RE.match(line)
        if case_match:
            cases.append(
                {
                    "case_id": case_match.group("case_id"),
                    "case_name": case_match.group("case_name").strip(),
                    "cite": case_match.group("cite"),
                    "volume": int(case_match.group("volume")),
                    "reporter_page": int(case_match.group("page")),
                }
            )

    if offset is None or pdf_name is None:
        raise ValueError(f"Could not parse a numeric page-1 offset from {path}")

    if not cases:
        raise ValueError(f"No case citations found in {path}")

    return offset, pdf_name, cases


def resolve_volume_paths(target: Path) -> tuple[Path, Path]:
    if target.is_file():
        if target.name not in {"VOL_INFO.md", "ASSUMPTIONS.md"}:
            raise ValueError(f"Expected a volume directory or VOL_INFO.md, got {target}")
        return target.parent, target
    vol_info_path = target / "VOL_INFO.md"
    if vol_info_path.exists():
        return target, vol_info_path
    return target, target / "ASSUMPTIONS.md"


def resolve_output_dir(volume_dir: Path, output_dir_name: str) -> Path:
    if output_dir_name in {"", "."}:
        return volume_dir
    return volume_dir / output_dir_name


def collect_all_case_start_pages(reader: PdfReader, volume: int, heading_page: int) -> list[int]:
    reporter_pages = set()

    for page_index in range(heading_page - 1):
        text = reader.pages[page_index].extract_text() or ""
        for match in TOC_PAGE_RE.finditer(text):
            if int(match.group("volume")) == volume:
                reporter_pages.add(int(match.group("page")))

    if 1 not in reporter_pages:
        reporter_pages.add(1)

    return sorted(reporter_pages)


def page_to_reporter_map(reader: PdfReader, volume: int) -> dict[int, int]:
    mapping: dict[int, int] = {}
    for pdf_page in range(1, len(reader.pages) + 1):
        text = reader.pages[pdf_page - 1].extract_text() or ""
        tail = text[-500:]
        match = REPORTER_PAGE_RE.search(tail)
        if match:
            matched_volume = int(match.group("volume_before") or match.group("volume_after"))
            if matched_volume == volume:
                mapping[pdf_page] = int(match.group("page_before") or match.group("page_after"))
                continue

        match = MEMORANDA_PAGE_RE.search(tail)
        if match:
            mapping[pdf_page] = int(match.group(1))
            continue

        bracket_matches = BRACKET_PAGE_RE.findall(text)
        if bracket_matches:
            mapping[pdf_page] = int(bracket_matches[-1][1])
    return mapping


def candidate_case_tokens(case_name: str) -> list[str]:
    tokens = re.findall(r"[A-Za-z][A-Za-z'-]{2,}", case_name.lower())
    filtered = [
        token
        for token in tokens
        if token not in NOISE_WORDS and token not in {"v", "ex", "of", "in", "on", "for"}
    ]
    filtered.sort(key=len, reverse=True)
    return filtered


def is_probable_case_block(text: str, case_name: str) -> bool:
    normalized = re.sub(r"\s+", " ", text).lower()
    normalized_compact = re.sub(r"\s+", "", text).lower()
    search_window = normalized[:4000]
    search_window_compact = normalized_compact[:4000]
    tokens = candidate_case_tokens(case_name)
    if tokens:
        if not any(token in search_window or token in search_window_compact for token in tokens[:3]):
            return False
    if "SUMMARY" not in text or ("HEADNOTE" not in text and "HEADNOTES" not in text):
        return False
    upper_text = text.upper()
    return (
        "THE PEOPLE OF THE STATE OF NEW YORK" in upper_text
        or "PEOPLE EX REL." in upper_text
        or " NY3D " in upper_text
        or " v " in normalized
    )


def cleanup_generated_outputs(output_dir: Path, volume: int) -> None:
    pattern = re.compile(rf"{volume}NY3d\d+\.pdf$")
    for pdf_path in output_dir.glob(f"{volume}NY3d*.pdf"):
        if pattern.fullmatch(pdf_path.name):
            pdf_path.unlink(missing_ok=True)
    (output_dir / "manifest.json").unlink(missing_ok=True)


def extract_cases(target: Path, output_dir_name: str) -> Path:
    volume_dir, assumptions_path = resolve_volume_paths(target)
    offset, pdf_name, people_cases = parse_assumptions(assumptions_path)

    pdf_path = volume_dir / pdf_name
    reader = PdfReader(str(pdf_path), strict=False)
    volume = people_cases[0]["volume"]

    all_starts = collect_all_case_start_pages(reader, volume, offset)
    reporter_by_pdf_page = page_to_reporter_map(reader, volume)
    first_pdf_for_reporter: dict[int, int] = {}
    for pdf_page, reporter_page in reporter_by_pdf_page.items():
        first_pdf_for_reporter.setdefault(reporter_page, pdf_page)

    output_dir = resolve_output_dir(volume_dir, output_dir_name)
    output_dir.mkdir(exist_ok=True)
    cleanup_generated_outputs(output_dir, volume)

    manifest = []
    for case in people_cases:
        reporter_page = int(case["reporter_page"])
        next_start = next((page for page in all_starts if page > reporter_page), None)
        pdf_start = first_pdf_for_reporter.get(reporter_page)
        if pdf_start is None:
            manifest.append(
                {
                    "caseId": case["case_id"],
                    "caseName": case["case_name"],
                    "citation": case["cite"],
                    "status": "skipped",
                    "reason": "No PDF page matched the reporter start page.",
                }
            )
            continue

        if next_start is None:
            pdf_end = len(reader.pages)
            reporter_end = reporter_by_pdf_page.get(pdf_end, reporter_page)
        else:
            next_pdf = first_pdf_for_reporter.get(next_start)
            if next_pdf is None:
                manifest.append(
                    {
                        "caseId": case["case_id"],
                        "caseName": case["case_name"],
                        "citation": case["cite"],
                        "status": "skipped",
                        "reason": f"No PDF page matched the next reporter start page {next_start}.",
                    }
                )
                continue
            pdf_end = next_pdf - 1
            reporter_end = next_start - 1

        combined_text = ""
        for page_no in range(pdf_start - 1, min(pdf_end, pdf_start + 2)):
            combined_text += (reader.pages[page_no].extract_text() or "") + "\n"

        if not is_probable_case_block(combined_text, str(case["case_name"])):
            manifest.append(
                {
                    "caseId": case["case_id"],
                    "caseName": case["case_name"],
                    "citation": case["cite"],
                    "reporterStartPage": reporter_page,
                    "reporterEndPage": reporter_end,
                    "pdfStartPage": pdf_start,
                    "pdfEndPage": pdf_end,
                    "status": "skipped",
                    "reason": "Matched pages did not contain a recognizable case caption plus summary/headnote block.",
                }
            )
            continue

        page_count = pdf_end - pdf_start + 1

        writer = PdfWriter()
        for page_no in range(pdf_start - 1, pdf_end):
            writer.add_page(reader.pages[page_no])

        filename = f"{volume}NY3d{reporter_page}.pdf"
        output_path = output_dir / filename
        with output_path.open("wb") as fh:
            writer.write(fh)

        manifest.append(
            {
                "caseId": case["case_id"],
                "caseName": case["case_name"],
                "citation": case["cite"],
                "reporterStartPage": reporter_page,
                "reporterEndPage": reporter_end,
                "pdfStartPage": pdf_start,
                "pdfEndPage": pdf_end,
                "pageCount": page_count,
                "outputFile": output_path.name,
                "status": "written",
            }
        )

    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("target", type=Path, help="Volume directory or VOL_INFO.md path")
    parser.add_argument(
        "--output-dir-name",
        default=".",
        help="Relative output directory inside the volume; default writes directly into the volume root",
    )
    args = parser.parse_args()

    manifest_path = extract_cases(args.target, args.output_dir_name)
    print(manifest_path)


if __name__ == "__main__":
    main()
