#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader, PdfWriter


CASES_HEADING = "CASES DECIDED IN THE COURT OF APPEALS OF THE STATE OF NEW YORK"
MEMORANDA_MARKER = "MEMORANDA OF DECISIONS"
MOTIONS_MARKER = "MOTIONS FOR LEAVE TO APPEAL"
BACK_MATTER_PREFIXES = (
    "MOTIONS FOR ",
    "APPEALS DISMISSED ",
    "CERTIFIED QUESTIONS ",
    "ATTORNEY DISCIPLINARY ",
    "STATE OF NEW YORK ",
    "NOTICE TO THE BAR ",
    "CORRECTION ",
    "INDEX ",
    "TABLE OF CASES ",
)


@dataclass
class VolumeSplit:
    volume: str
    pdf_path: Path
    total_pages: int
    decisions_start: int | None
    decisions_end: int | None
    memoranda_start: int | None
    memoranda_end: int | None


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\ufeff", " ")).strip()


def page_texts(pdf_path: Path) -> list[str]:
    reader = PdfReader(str(pdf_path), strict=False)
    return [normalize_text(page.extract_text() or "") for page in reader.pages]


def first_heading_page(pages: list[str], needle: str, *, after_page: int = 0) -> int | None:
    needle_upper = needle.upper()
    for index, text in enumerate(pages, start=1):
        if index <= after_page:
            continue
        if needle_upper in text.upper():
            return index
    return None


def top_snippet(text: str, size: int = 250) -> str:
    return text[:size]


def is_back_matter_page(text: str) -> bool:
    snippet = top_snippet(text)
    return any(snippet.startswith(prefix) for prefix in BACK_MATTER_PREFIXES)


def find_volume_split(volume_dir: Path) -> VolumeSplit:
    volume = volume_dir.name
    pdf_path = volume_dir / f"{volume}.pdf"
    pages = page_texts(pdf_path)

    decisions_start = first_heading_page(pages, CASES_HEADING, after_page=1)
    if decisions_start is None:
        raise ValueError(f"{volume}: could not find decisions heading")

    motions_after_decisions = first_heading_page(pages, MOTIONS_MARKER, after_page=decisions_start)
    memoranda_start = first_heading_page(pages, MEMORANDA_MARKER, after_page=decisions_start)

    decisions_next_markers = [page for page in (motions_after_decisions, memoranda_start) if page is not None]
    decisions_end = min(decisions_next_markers) - 1 if decisions_next_markers else len(pages)

    memoranda_end = None
    if memoranda_start is not None:
        for page_number in range(memoranda_start + 1, len(pages) + 1):
            if is_back_matter_page(pages[page_number - 1]):
                memoranda_end = page_number - 1
                break
        if memoranda_end is None:
            memoranda_end = len(pages)

    return VolumeSplit(
        volume=volume,
        pdf_path=pdf_path,
        total_pages=len(pages),
        decisions_start=decisions_start,
        decisions_end=decisions_end,
        memoranda_start=memoranda_start,
        memoranda_end=memoranda_end,
    )


def write_page_range(reader: PdfReader, output_path: Path, start_page: int, end_page: int) -> None:
    writer = PdfWriter()
    for page_number in range(start_page - 1, end_page):
        writer.add_page(reader.pages[page_number])
    with output_path.open("wb") as fh:
        writer.write(fh)


def process_volume(volume_dir: Path, *, dry_run: bool) -> dict[str, object]:
    split = find_volume_split(volume_dir)
    reader = PdfReader(str(split.pdf_path), strict=False)

    result: dict[str, object] = {
        "volume": split.volume,
        "sourcePdf": split.pdf_path.name,
        "totalPages": split.total_pages,
        "decisions": None,
        "memoranda": None,
    }

    if split.decisions_start is not None and split.decisions_end is not None and split.decisions_end >= split.decisions_start:
        decisions_name = f"{split.volume}_Decisions.pdf"
        result["decisions"] = {
            "startPage": split.decisions_start,
            "endPage": split.decisions_end,
            "pageCount": split.decisions_end - split.decisions_start + 1,
            "outputFile": decisions_name,
        }
        if not dry_run:
            write_page_range(reader, volume_dir / decisions_name, split.decisions_start, split.decisions_end)

    if split.memoranda_start is not None and split.memoranda_end is not None and split.memoranda_end >= split.memoranda_start:
        memoranda_name = f"{split.volume}_Memoranda.pdf"
        result["memoranda"] = {
            "startPage": split.memoranda_start,
            "endPage": split.memoranda_end,
            "pageCount": split.memoranda_end - split.memoranda_start + 1,
            "outputFile": memoranda_name,
        }
        if not dry_run:
            write_page_range(reader, volume_dir / memoranda_name, split.memoranda_start, split.memoranda_end)

    return result


def iter_volume_dirs(root: Path, selected_volumes: list[str] | None = None) -> list[Path]:
    wanted = set(selected_volumes or [])
    volume_dirs = [path for path in root.iterdir() if path.is_dir() and re.fullmatch(r"\d{1,2}NY3d", path.name)]
    if wanted:
        volume_dirs = [path for path in volume_dirs if path.name in wanted]
    return sorted(volume_dirs, key=lambda path: path.name)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("opinions/coa/ny3d"),
        help="Directory containing 1NY3d/10NY3d-style volume directories",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Detect ranges and print/write manifest only without creating PDFs",
    )
    parser.add_argument(
        "--volumes",
        nargs="+",
        help="Optional subset such as 1NY3d 20NY3d 43NY3d",
    )
    args = parser.parse_args()

    root = args.root.resolve()
    volumes = iter_volume_dirs(root, args.volumes)
    results: list[dict[str, object]] = []
    for volume_dir in volumes:
        try:
            results.append(process_volume(volume_dir, dry_run=args.dry_run))
        except Exception as exc:  # noqa: BLE001
            results.append(
                {
                    "volume": volume_dir.name,
                    "sourcePdf": f"{volume_dir.name}.pdf",
                    "error": str(exc),
                }
            )

    manifest_path = root / "bound_volume_section_manifest.json"
    manifest_path.write_text(json.dumps(results, indent=2), encoding="utf-8")

    for item in results:
        if "error" in item:
            print(f"{item['volume']}: ERROR {item['error']}")
            continue
        decisions = item["decisions"]
        memoranda = item["memoranda"]
        decisions_summary = (
            f"{decisions['startPage']}-{decisions['endPage']}" if decisions else "missing"
        )
        memoranda_summary = (
            f"{memoranda['startPage']}-{memoranda['endPage']}" if memoranda else "missing"
        )
        print(f"{item['volume']}: decisions {decisions_summary}; memoranda {memoranda_summary}")

    print(manifest_path)


if __name__ == "__main__":
    main()
