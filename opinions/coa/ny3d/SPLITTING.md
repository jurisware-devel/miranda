# NY3d Splitting Notes

This note captures the current workflow for splitting individual criminal decisions out of a bound NY3d volume PDF.

## Core Model

- Start from the volume's `VOL_INFO.md`.
- Use the recorded `Page 1` offset as an initial calibration aid.
- Build a target criminal-case manifest from the Amplify `Case` table's `X NY3d Y` citations.
- Do not assume every `People v ...` citation in the case list is a standalone opinion boundary in the PDF.
- Treat the manifest as the source of truth for any generated per-case PDFs.

## Inputs Per Volume

- A bound volume PDF such as `43NY3d.pdf`.
- A volume-local [VOL_INFO.md](/Users/jonathan/Projects/miranda/opinions/coa/ny3d/43NY3d/VOL_INFO.md)-style file that records where reporter page 1 begins and lists candidate citations.
- A volume-local [manifest.json](/Users/jonathan/Projects/miranda/opinions/coa/ny3d/43NY3d/manifest.json)-style file with one entry per candidate case.

The manifest should record:

- `caseId`
- `caseName`
- `citation`
- `reporterStartPage`
- `reporterEndPage`
- `pdfStartPage`
- `pdfEndPage`
- `pageCount`
- `outputFile`
- `status` (`written` or `skipped`)
- `reason`, if skipped

## What Worked

- The heading page

  `CASES DECIDED`
  `IN THE`
  `COURT OF APPEALS`
  `OF THE`
  `STATE OF NEW YORK`

  is a reliable anchor for locating where reporter pagination begins in a volume.

- Raw offset math can be useful as a first calibration pass, but reading printed reporter page numbers from the PDF is more reliable.
- Reporter page numbers can appear in multiple forms, including:

  - `PEOPLE v MCDONALD [1 NY3d 109] 109`
  - `1 NEW YORK REPORTS, 3d SERIES126`
  - `533MEMORANDA`

- A manifest-backed split is much safer than ad hoc extraction because it allows reconstruction from the source volume if a derived PDF needs to be regenerated.

## Important Structural Observation

- Volumes are not uniform throughout.
- The main opinions section and the memoranda section behave differently.
- Once a volume enters `MEMORANDA`, page numbering is still recoverable, but case starts are more likely to occur mid-page.
- This means page ranges are still useful, but page boundaries alone are not enough for a perfectly clean first page.

## Full Workflow For Any Volume

1. Use `VOL_INFO.md` to build the candidate criminal case list.
2. Build a reporter-page-to-PDF-page map by reading printed reporter page numbers directly from the volume PDF.
3. Infer or verify each case's `pdfStartPage` and `pdfEndPage`, then write those ranges into `manifest.json`.
4. Emit skipped manifest entries instead of forcing bad PDFs when a candidate citation cannot be matched cleanly.
5. Generate each individual decision PDF from the bound volume using the manifest page range.
6. For each generated PDF, scan forward until the first page containing `OPINION OF THE COURT`.
7. Delete all full pages before that page.
8. On the new first page, locate the `OPINION` line and crop away everything above it.
9. Flatten the crop into a fresh PDF so the cropped-away material is actually removed, not just hidden by a crop box.

## Cropping Details

- Page deletion alone is not enough for many memorandum-era cases because `OPINION OF THE COURT` often begins partway down the first kept page.
- A viewer-only crop box is not enough if the goal is to truly remove the hidden material.
- The working approach is:

  - crop page 1 to the `OPINION OF THE COURT` line
  - rewrite the PDF through Ghostscript with `-dUseCropBox`

- In practice, this means:

  - extract the case PDF from the source volume
  - remove all full pages before the first opinion page
  - crop the top of the new first page
  - flatten that crop with Ghostscript

## Volume 43 Lessons Learned

- The Volume 43 workflow confirmed that the manifest-plus-source-volume pair should be treated as the canonical source of truth.
- If a derived case PDF has been cropped incorrectly, the safest recovery path is to reconstruct it from the bound volume using the manifest page range, then re-run the trim and crop steps from scratch.
- Do not keep re-cropping already-derived PDFs. It is too easy to compound a bad crop or misread the coordinate direction.
- The crop must be computed on the first remaining page after deleting leading pages, not on the original bound-volume page numbering and not on a stale intermediate derivative.
- Ghostscript with `pdfwrite` and `-dUseCropBox` successfully flattened the first-page crop in Volume 43, so the hidden material was actually removed from the rewritten PDF.
- `pdftotext` is useful for locating `OPINION OF THE COURT`, but its reading order is not a perfect proxy for viewer-visible layout after rewriting. For Volume 43, visual spot checks were still necessary on representative outputs.
- A good verification pattern is:

  - confirm the rewritten first page has the expected smaller page height
  - confirm extracted text on page 1 includes `OPINION OF THE COURT`
  - visually inspect a few rendered first pages from different parts of the volume

- Volume 43 also showed that not every derivative file in a working directory is necessarily represented in the manifest. Redacted or alternate variants should be tracked explicitly if they need to survive regeneration, because a manifest-based rebuild will only recreate the files listed in the manifest.

## What Failed

- Not every `People v ...` citation in `VOL_INFO.md` maps cleanly to a full caption page.
- Some late-volume criminal citations are only visible inside back-matter tables or applications sections.
- Some candidate citations cannot be split cleanly from page boundaries alone.
- Some derivative PDFs may be missing from the working directory later, so it is important that the manifest and the bound volume remain available for reconstruction.

## Practical Conclusion

- The safest workflow is:

  - manifest-driven split first
  - manifest review second
  - first-opinion-page trim third
  - first-page crop and Ghostscript flatten fourth

- That workflow is good enough to produce dedicated criminal decision PDFs whose visible first page begins at `OPINION OF THE COURT`, even when the original case began mid-page inside the bound volume.

## Related Artifacts

- Volume 1 assumptions: [1NY3d/VOL_INFO.md](/Users/jonathan/Projects/miranda/opinions/coa/ny3d/1NY3d/VOL_INFO.md)
- Volume 43 assumptions: [43NY3d/VOL_INFO.md](/Users/jonathan/Projects/miranda/opinions/coa/ny3d/43NY3d/VOL_INFO.md)
- Volume 43 manifest: [43NY3d/manifest.json](/Users/jonathan/Projects/miranda/opinions/coa/ny3d/43NY3d/manifest.json)
- Volume 1 prototype outputs: [1NY3d/criminal_cases_v3](/Users/jonathan/Projects/miranda/opinions/coa/ny3d/1NY3d/criminal_cases_v3)
- Prototype splitter: [scripts/split-ny3d-people-volume.py](/Users/jonathan/Projects/miranda/scripts/split-ny3d-people-volume.py)
