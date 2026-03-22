#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import subprocess
import tempfile
from pathlib import Path
from xml.etree import ElementTree

from pypdf import PdfReader, PdfWriter


def iter_pdfs(target: Path) -> list[Path]:
    if target.is_file():
        if target.suffix.lower() != ".pdf":
            raise ValueError(f"Expected a PDF file, got {target}")
        return [target]

    return sorted(
        path
        for path in target.iterdir()
        if path.is_file() and re.fullmatch(r"\d{1,2}NY3d\d+\.pdf", path.name)
    )


def bbox_pages(pdf_path: Path) -> tuple[list[dict[str, object]], float, float]:
    xml = subprocess.run(
        ["pdftotext", "-bbox-layout", str(pdf_path), "-"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    xml = re.sub(r"<!DOCTYPE[^>]*>", "", xml, count=1)
    root = ElementTree.fromstring(xml)

    pages: list[dict[str, object]] = []
    page_width = 0.0
    page_height = 0.0
    for element in root.iter():
        if not element.tag.endswith("page"):
            continue
        width = float(element.attrib["width"])
        height = float(element.attrib["height"])
        page_width = max(page_width, width)
        page_height = max(page_height, height)
        x_mins: list[float] = []
        x_maxs: list[float] = []
        for line in element.iter():
            if not line.tag.endswith("line"):
                continue
            words = [child.text or "" for child in line if child.tag.endswith("word")]
            if not words:
                continue
            x_mins.append(float(line.attrib["xMin"]))
            x_maxs.append(float(line.attrib["xMax"]))
        if x_mins and x_maxs:
            pages.append(
                {
                    "xMin": min(x_mins),
                    "xMax": max(x_maxs),
                    "width": width,
                    "height": height,
                }
            )
    if not pages:
        raise ValueError(f"No text bounds found in {pdf_path}")
    return pages, page_width, page_height


def detect_crop_bounds(pdf_path: Path, side_padding: float) -> tuple[float, float]:
    pages, page_width, _ = bbox_pages(pdf_path)
    global_left = min(float(page["xMin"]) for page in pages)
    global_right = max(float(page["xMax"]) for page in pages)
    crop_left = max(0.0, global_left - side_padding)
    crop_right = min(page_width, global_right + side_padding)
    if crop_right <= crop_left:
        raise ValueError(f"Invalid crop bounds for {pdf_path}")
    return crop_left, crop_right


def crop_pdf_side_margins(pdf_path: Path, output_path: Path, side_padding: float) -> dict[str, float]:
    crop_left, crop_right = detect_crop_bounds(pdf_path, side_padding)
    reader = PdfReader(str(pdf_path), strict=False)
    writer = PdfWriter()

    original_width = 0.0
    cropped_width = 0.0
    for page in reader.pages:
        current_left = float(page.mediabox.left)
        current_bottom = float(page.mediabox.bottom)
        current_right = float(page.mediabox.right)
        current_top = float(page.mediabox.top)
        original_width = max(original_width, current_right - current_left)

        new_left = max(current_left, crop_left)
        new_right = min(current_right, crop_right)
        if new_right <= new_left:
            raise ValueError(f"Crop would remove all page width in {pdf_path}")

        page.mediabox.lower_left = (new_left, current_bottom)
        page.mediabox.upper_right = (new_right, current_top)
        page.cropbox.lower_left = (new_left, current_bottom)
        page.cropbox.upper_right = (new_right, current_top)
        writer.add_page(page)
        cropped_width = max(cropped_width, new_right - new_left)

    with tempfile.TemporaryDirectory(dir=output_path.parent) as temp_dir:
        temp_path = Path(temp_dir) / f"{output_path.stem}.crop.tmp.pdf"
        with temp_path.open("wb") as fh:
            writer.write(fh)
        subprocess.run(
            ["gs", "-q", "-o", str(output_path), "-sDEVICE=pdfwrite", "-dUseCropBox", str(temp_path)],
            check=True,
        )

    return {
        "cropLeft": round(crop_left, 2),
        "cropRight": round(crop_right, 2),
        "originalWidth": round(original_width, 2),
        "croppedWidth": round(cropped_width, 2),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("target", type=Path, help="A single PDF or a volume directory containing XNY3dY PDFs")
    parser.add_argument(
        "--side-padding",
        type=float,
        default=18.0,
        help="Margin to preserve on each side of the text block, in points. 18 = 1/4 inch.",
    )
    parser.add_argument(
        "--suffix",
        default=".cropped",
        help="Suffix added before .pdf when not writing in place",
    )
    parser.add_argument(
        "--in-place",
        action="store_true",
        help="Rewrite each matched PDF in place after flattening the crop",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only report detected crop bounds without writing output PDFs",
    )
    args = parser.parse_args()

    pdf_paths = iter_pdfs(args.target.resolve())
    if not pdf_paths:
        raise ValueError(f"No XNY3dY PDFs found in {args.target}")

    for pdf_path in pdf_paths:
        crop_left, crop_right = detect_crop_bounds(pdf_path, args.side_padding)
        reader = PdfReader(str(pdf_path), strict=False)
        first_page = reader.pages[0]
        original_width = float(first_page.mediabox.right) - float(first_page.mediabox.left)
        cropped_width = crop_right - crop_left
        print(
            f"{pdf_path.name}: crop x={crop_left:.2f}..{crop_right:.2f} "
            f"width {original_width:.2f}->{cropped_width:.2f}"
        )

        if args.dry_run:
            continue

        output_path = pdf_path if args.in_place else pdf_path.with_name(f"{pdf_path.stem}{args.suffix}.pdf")
        result = crop_pdf_side_margins(pdf_path, output_path, args.side_padding)
        print(
            f"  wrote {output_path.name} "
            f"(left={result['cropLeft']:.2f}, right={result['cropRight']:.2f}, "
            f"width={result['originalWidth']:.2f}->{result['croppedWidth']:.2f})"
        )


if __name__ == "__main__":
    main()
