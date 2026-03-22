#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path
from xml.etree import ElementTree

from pypdf import PdfReader, PdfWriter


CASE_LINE_RE = re.compile(
    r"- `(?P<cite>(?P<volume>\d+) NY3d (?P<page>\d+))` - (?P<case_name>.+?) \(`(?P<case_id>[^`]+)`\)"
)
OFFSET_RE = re.compile(
    r"- Volume (?P<volume>\d+), Page 1 begins on page (?P<offset>\d+) of `(?P<pdf>[^`]+)`\."
)
TOC_PAGE_RE = re.compile(r"[—-](?P<volume>\d+)\s+NY3d\s+(?P<page>\d+)")
OPINION_MARKER = "OPINION OF THE COURT"
OPINION_TOKENS = ["OPINION", "OF", "THE", "COURT"]
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
def normalize_assumptions_text(text: str) -> str:
    return text.replace("\ufeff", "")


def normalize_token(text: str) -> str:
    return re.sub(r"[^A-Z]", "", text.upper())


def parse_vol_info(path: Path) -> tuple[int, str, list[dict[str, object]]]:
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
                    "caseId": case_match.group("case_id"),
                    "caseName": case_match.group("case_name").strip(),
                    "citation": case_match.group("cite"),
                    "volume": int(case_match.group("volume")),
                    "reporterStartPage": int(case_match.group("page")),
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

    assumptions_path = target / "ASSUMPTIONS.md"
    if assumptions_path.exists():
        return target, assumptions_path

    raise ValueError(f"Could not find VOL_INFO.md in {target}")


def resolve_output_dir(volume_dir: Path, output_dir_name: str) -> Path:
    if output_dir_name in {"", "."}:
        return volume_dir
    return volume_dir / output_dir_name


def collect_all_case_start_pages(bound_reader: PdfReader, volume: int, heading_page: int) -> list[int]:
    reporter_pages = {1}

    for page_index in range(max(heading_page - 1, 0)):
        text = bound_reader.pages[page_index].extract_text() or ""
        for match in TOC_PAGE_RE.finditer(text):
            if int(match.group("volume")) == volume:
                reporter_pages.add(int(match.group("page")))

    return sorted(reporter_pages)


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
    if tokens and not any(token in search_window or token in search_window_compact for token in tokens[:3]):
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


def cleanup_generated_outputs(output_dir: Path, volume: int, manifest_name: str) -> None:
    pattern = re.compile(rf"{volume}NY3d\d+\.pdf$")
    for pdf_path in output_dir.glob(f"{volume}NY3d*.pdf"):
        if pattern.fullmatch(pdf_path.name):
            pdf_path.unlink(missing_ok=True)
    (output_dir / manifest_name).unlink(missing_ok=True)


def write_page_range(reader: PdfReader, output_path: Path, start_page: int, end_page: int) -> None:
    writer = PdfWriter()
    for page_number in range(start_page - 1, end_page):
        writer.add_page(reader.pages[page_number])
    with output_path.open("wb") as fh:
        writer.write(fh)


def first_opinion_page(reader: PdfReader) -> int | None:
    for index, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").upper()
        if OPINION_MARKER in text:
            return index
    return None


def trim_leading_pages(raw_pdf_path: Path, trimmed_pdf_path: Path) -> tuple[int, int]:
    reader = PdfReader(str(raw_pdf_path), strict=False)
    opinion_page = first_opinion_page(reader)
    if opinion_page is None:
        raise ValueError("No page contained 'OPINION OF THE COURT'.")

    writer = PdfWriter()
    for page_index in range(opinion_page - 1, len(reader.pages)):
        writer.add_page(reader.pages[page_index])

    with trimmed_pdf_path.open("wb") as fh:
        writer.write(fh)

    return opinion_page, opinion_page - 1


def bbox_layout(pdf_path: Path) -> tuple[float, float, list[dict[str, object]]]:
    xml = subprocess.run(
        ["pdftotext", "-bbox-layout", "-f", "1", "-l", "1", str(pdf_path), "-"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    xml = re.sub(r"<!DOCTYPE[^>]*>", "", xml, count=1)
    root = ElementTree.fromstring(xml)
    page = None
    for element in root.iter():
        if element.tag.endswith("page"):
            page = element
            break
    if page is None:
        raise ValueError("Could not parse pdftotext bbox output.")

    width = float(page.attrib["width"])
    height = float(page.attrib["height"])
    lines: list[dict[str, object]] = []
    for element in root.iter():
        if not element.tag.endswith("line"):
            continue
        words = []
        for child in element:
            if child.tag.endswith("word"):
                words.append(child.text or "")
        if not words:
            continue
        lines.append(
            {
                "xMin": float(element.attrib["xMin"]),
                "yMin": float(element.attrib["yMin"]),
                "xMax": float(element.attrib["xMax"]),
                "yMax": float(element.attrib["yMax"]),
                "words": words,
            }
        )
    return width, height, lines


def opinion_crop_top(pdf_path: Path, top_padding: float) -> tuple[float, float, float]:
    width, height, lines = bbox_layout(pdf_path)
    target = "".join(normalize_token(token) for token in OPINION_TOKENS)

    for line in lines:
        line_text = "".join(normalize_token(word) for word in line["words"])
        if target in line_text:
            y_min = float(line["yMin"])
            crop_top = max(0.0, y_min - top_padding)
            return width, height, crop_top

    raise ValueError("Could not locate 'OPINION OF THE COURT' in bbox output.")


def crop_and_flatten_first_page(trimmed_pdf_path: Path, output_pdf_path: Path, top_padding: float) -> float:
    width, height, crop_top = opinion_crop_top(trimmed_pdf_path, top_padding)
    if crop_top <= 0:
        output_pdf_path.write_bytes(trimmed_pdf_path.read_bytes())
        return 0.0

    cropped_temp_path = output_pdf_path.with_name(f"{output_pdf_path.stem}.crop.tmp.pdf")
    reader = PdfReader(str(trimmed_pdf_path), strict=False)
    writer = PdfWriter()

    first_page = reader.pages[0]
    new_top = height - crop_top
    first_page.mediabox.upper_right = (width, new_top)
    first_page.cropbox.lower_left = (0, 0)
    first_page.cropbox.upper_right = (width, new_top)
    writer.add_page(first_page)
    for page in reader.pages[1:]:
        writer.add_page(page)

    with cropped_temp_path.open("wb") as fh:
        writer.write(fh)

    try:
        subprocess.run(
            ["gs", "-q", "-o", str(output_pdf_path), "-sDEVICE=pdfwrite", "-dUseCropBox", str(cropped_temp_path)],
            check=True,
        )
    finally:
        cropped_temp_path.unlink(missing_ok=True)

    return crop_top


def extract_cases(
    target: Path,
    output_dir_name: str,
    manifest_name: str,
    top_padding: float,
    clean_output_dir: bool,
) -> Path:
    volume_dir, vol_info_path = resolve_volume_paths(target)
    page1_offset, source_pdf_name, cases = parse_vol_info(vol_info_path)
    volume = int(cases[0]["volume"])
    volume_name = f"{volume}NY3d"

    bound_pdf_path = volume_dir / source_pdf_name
    decisions_pdf_path = volume_dir / f"{volume_name}_Decisions.pdf"
    if not decisions_pdf_path.exists():
        raise FileNotFoundError(f"Missing decisions PDF: {decisions_pdf_path}")

    bound_reader = PdfReader(str(bound_pdf_path), strict=False)
    decisions_reader = PdfReader(str(decisions_pdf_path), strict=False)
    all_starts = collect_all_case_start_pages(bound_reader, volume, page1_offset)
    decisions_page_count = len(decisions_reader.pages)

    output_dir = resolve_output_dir(volume_dir, output_dir_name)
    output_dir.mkdir(parents=True, exist_ok=True)
    if clean_output_dir:
        cleanup_generated_outputs(output_dir, volume, manifest_name)

    manifest: list[dict[str, object]] = []
    for case in cases:
        reporter_page = int(case["reporterStartPage"])
        next_start = next((page for page in all_starts if page > reporter_page), None)

        if reporter_page > decisions_page_count:
            manifest.append(
                {
                    **case,
                    "status": "skipped",
                    "reason": f"Reporter page {reporter_page} falls outside {decisions_pdf_path.name}.",
                }
            )
            continue

        pdf_start = reporter_page
        if next_start is None or next_start > decisions_page_count:
            pdf_end = decisions_page_count
            reporter_end = decisions_page_count
        else:
            pdf_end = next_start - 1
            reporter_end = next_start - 1

        combined_text = ""
        for page_no in range(pdf_start - 1, min(pdf_end, pdf_start + 2)):
            combined_text += (decisions_reader.pages[page_no].extract_text() or "") + "\n"

        if not is_probable_case_block(combined_text, str(case["caseName"])):
            manifest.append(
                {
                    **case,
                    "reporterEndPage": reporter_end,
                    "pdfStartPage": pdf_start,
                    "pdfEndPage": pdf_end,
                    "status": "skipped",
                    "reason": "Matched pages did not contain a recognizable case caption plus summary/headnote block.",
                }
            )
            continue

        output_path = output_dir / f"{volume}NY3d{reporter_page}.pdf"
        raw_page_count = pdf_end - pdf_start + 1

        with tempfile.TemporaryDirectory(dir=output_dir) as temp_dir:
            temp_dir_path = Path(temp_dir)
            raw_pdf_path = temp_dir_path / f"{output_path.stem}.raw.pdf"
            trimmed_pdf_path = temp_dir_path / f"{output_path.stem}.trimmed.pdf"

            write_page_range(decisions_reader, raw_pdf_path, pdf_start, pdf_end)
            opinion_page, trimmed_leading_pages = trim_leading_pages(raw_pdf_path, trimmed_pdf_path)
            crop_top = crop_and_flatten_first_page(trimmed_pdf_path, output_path, top_padding)

        final_reader = PdfReader(str(output_path), strict=False)
        manifest.append(
            {
                **case,
                "sourcePdf": decisions_pdf_path.name,
                "reporterEndPage": reporter_end,
                "pdfStartPage": pdf_start,
                "pdfEndPage": pdf_end,
                "rawPageCount": raw_page_count,
                "trimmedLeadingPages": trimmed_leading_pages,
                "firstOpinionPageInRawRange": opinion_page,
                "cropTopPoints": round(crop_top, 2),
                "pageCount": len(final_reader.pages),
                "outputFile": output_path.name,
                "status": "written",
            }
        )

    manifest_path = output_dir / manifest_name
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
    parser.add_argument(
        "--manifest-name",
        default="decisions_manifest.json",
        help="Manifest filename to write inside the output directory",
    )
    parser.add_argument(
        "--top-padding",
        type=float,
        default=6.0,
        help="Whitespace to preserve above 'OPINION OF THE COURT' on the cropped first page, in points",
    )
    parser.add_argument(
        "--no-clean-output-dir",
        action="store_true",
        help="Do not remove previously generated XNY3dY PDFs in the output directory before writing new ones",
    )
    args = parser.parse_args()

    manifest_path = extract_cases(
        target=args.target.resolve(),
        output_dir_name=args.output_dir_name,
        manifest_name=args.manifest_name,
        top_padding=args.top_padding,
        clean_output_dir=not args.no_clean_output_dir,
    )
    print(manifest_path)


if __name__ == "__main__":
    main()
