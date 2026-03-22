# AI Notes Schema Draft

This document proposes the durable `.notes.json` contract for Court of Appeals opinion HTML.

These notes are:

- generated from `.htm` only
- intended to be more durable than regenerated Miranda JSON
- designed to be maintainable over time through Codex-directed updates
- consumable by `stanbook` as advisory source metadata

The notes are not a debug dump and are not meant to mirror Miranda JSON.

Their purpose is to record opinion-specific structural facts and source quirks that matter for understanding the opinion and for helping `stanbook` produce correct JSON.

## Design Goals

- Record opinion-specific meaning, not just parser observations.
- Make unusual-but-correct output explainable.
- Support later Codex/user-directed curation without requiring full regeneration.
- Let `stanbook` consume specific hints without turning notes into a hidden second parser.
- Keep source analysis grounded in `.htm`, never derived from `.json`.

## Core Principle

`.notes.json` should answer:

- What kind of decision is this?
- What is unusual about its writing structure?
- What source quirks matter for JSON generation?
- What should `stanbook` know when transforming this specific opinion?

## Recommended Top-Level Shape

```json
{
  "notesVersion": "1.0",
  "caseId": "2025_02100",
  "sourcePath": "coa/2025/2025_02100.htm",
  "provenance": {},
  "decisionStructure": {},
  "writings": [],
  "resultStructure": {},
  "sourceFeatures": {},
  "stanbookHints": {},
  "analysisNotes": []
}
```

## Proposed Schema

### Root

```json
{
  "notesVersion": "1.0",
  "caseId": "2025_02100",
  "sourcePath": "coa/2025/2025_02100.htm",
  "provenance": {
    "creationMode": "ai_initial",
    "reviewStatus": "ai_generated",
    "lastUpdatedAt": "2026-03-22T00:00:00Z"
  },
  "decisionStructure": {},
  "writings": [],
  "resultStructure": {},
  "sourceFeatures": {},
  "stanbookHints": {},
  "analysisNotes": []
}
```

### Provenance

`provenance` explains how the note was created and how trustworthy or curated it is.

```json
{
  "creationMode": "ai_initial",
  "reviewStatus": "ai_generated",
  "lastUpdatedAt": "2026-03-22T00:00:00Z",
  "updatedBy": "codex",
  "confidence": "medium"
}
```

Suggested fields:

- `creationMode`
  - `ai_initial`
  - `codex_updated`
  - `user_directed_update`
- `reviewStatus`
  - `ai_generated`
  - `codex_reviewed`
  - `codex_amended`
  - `user_confirmed`
- `lastUpdatedAt`
- `updatedBy`
- `confidence`
  - `high`
  - `medium`
  - `low`

## Decision Structure

This section captures the high-level nature of the decision.

```json
{
  "decisionForm": "plurality",
  "hasMajority": false,
  "mainWritingKind": "plurality",
  "mainWritingAuthor": "Rivera",
  "isMemorandum": false,
  "isPerCuriam": false,
  "isOpinionOfTheCourt": true,
  "notes": "Plurality disposition with no majority writing."
}
```

Suggested `decisionForm` values:

- `majority`
- `plurality`
- `memorandum`
- `per_curiam`
- `opinion_of_the_court`
- `single_anonymous_writing`
- `mixed`
- `unclear`

Suggested fields:

- `decisionForm`
- `hasMajority`
- `mainWritingKind`
- `mainWritingAuthor`
- `isMemorandum`
- `isPerCuriam`
- `isOpinionOfTheCourt`
- `notes`

## Writings

`writings` records the opinion-by-opinion structure in a way that is meaningful to humans and usable by `stanbook`.

```json
[
  {
    "order": 1,
    "author": "Rivera",
    "kind": "plurality",
    "label": "OPINION OF THE COURT",
    "hasJoiners": true,
    "joiners": ["Wilson", "Halligan"],
    "scope": "addresses first issue and part of second issue",
    "relationshipToResult": "sets lead rationale but not a majority rationale",
    "confidence": "high"
  },
  {
    "order": 2,
    "author": "Garcia",
    "kind": "concurrence_in_part_and_dissent_in_part",
    "scope": "concurs in one result, dissents from another",
    "relationshipToResult": "mixed",
    "confidence": "medium"
  }
]
```

Suggested `kind` values:

- `majority`
- `plurality`
- `opinion_of_the_court`
- `memorandum`
- `per_curiam`
- `concurrence`
- `concurrence_in_result`
- `concurrence_in_part`
- `dissent`
- `dissent_in_part`
- `concurrence_in_part_and_dissent_in_part`
- `mixed`
- `unclear`

Suggested fields:

- `order`
- `author`
- `kind`
- `label`
- `hasJoiners`
- `joiners`
- `scope`
- `relationshipToResult`
- `confidence`

## Result Structure

This section captures whether the case resolves one result or multiple distinct results.

```json
{
  "hasMultipleResults": true,
  "hasMultipleLowerCourtRulings": true,
  "resultUnits": [
    {
      "label": "first lower court ruling",
      "disposition": "affirmed"
    },
    {
      "label": "second lower court ruling",
      "disposition": "reversed"
    }
  ],
  "mixedResultDisposition": true,
  "confidence": "medium"
}
```

Suggested fields:

- `hasMultipleResults`
- `hasMultipleLowerCourtRulings`
- `resultUnits`
- `mixedResultDisposition`
- `confidence`

This is the section meant to capture facts like:

- "This opinion addresses two lower court rulings in different cases"
- "Judge X concurs in one result and dissents in another"

## Source Features

This section records opinion-specific source traits that matter to humans and to `stanbook`.

```json
{
  "citationShape": {
    "slipOpinionLineIncludesOfficialCitation": true,
    "officialCitationInParentheses": true
  },
  "counselShape": {
    "usesAppearancesOfCounsel": false,
    "usesPointsOfCounsel": true,
    "appearancesMustBeDerivedFromPointsOfCounsel": true
  },
  "headerQuirks": [
    "author line present in header table",
    "official citation embedded in slip-op line"
  ],
  "sourceQuirks": [
    "malformed closing tag in appearances container"
  ]
}
```

Suggested fields:

- `citationShape`
- `counselShape`
- `headerQuirks`
- `sourceQuirks`

## Stanbook Hints

This is the most important section for machine consumption.

It should contain explicit, structured hints that `stanbook` can understand.

```json
{
  "treatAsPlurality": true,
  "noMajorityWriting": true,
  "multipleOrdersResolved": true,
  "deriveAppearancesFrom": "points_of_counsel",
  "officialCitationSource": "parenthetical_header_citation",
  "sourceTypos": [
    {
      "location": "appearances_of_counsel",
      "issue": "stray closing tag",
      "effect": "header counsel extraction may truncate first appearance"
    }
  ],
  "parserCautions": [
    "do not expect a majority writing",
    "do not infer missing majority from plurality layout"
  ]
}
```

Suggested fields:

- `treatAsPlurality`
- `noMajorityWriting`
- `multipleOrdersResolved`
- `deriveAppearancesFrom`
  - `header_lines`
  - `points_of_counsel`
  - `notes_curated`
- `officialCitationSource`
  - `plain_header_line`
  - `parenthetical_header_citation`
  - `bracketed_header_citation`
- `sourceTypos`
- `parserCautions`

## Analysis Notes

This section is for concise human-facing explanatory notes that do not fit neatly into a single structured field.

```json
[
  {
    "type": "structure",
    "text": "This is a plurality decision; there is no majority rationale."
  },
  {
    "type": "result",
    "text": "One separate writing concurs as to one ruling and dissents as to another."
  },
  {
    "type": "source",
    "text": "The appearances section contains malformed markup that may truncate header extraction."
  }
]
```

Suggested `type` values:

- `structure`
- `result`
- `source`
- `counsel`
- `citation`
- `stanbook`

## Guidance For The AI Pass

The HTML-only AI pass should:

- read the `.htm` only
- avoid relying on existing Miranda JSON
- make conservative inferences
- use `confidence` fields when interpretation is uncertain
- prefer "unclear" to overclaiming

The AI pass should focus on:

- plurality vs majority vs memorandum vs per curiam
- whether there is a majority writing
- whether there are separate writings and how they relate to the result
- whether multiple lower-court rulings or result units are present
- source quirks that could confuse `stanbook`
- explicit hints that can safely guide JSON generation

## Guidance For Later Codex Updates

Later updates should:

- preserve the existing schema
- update only the fields needed for the new discovered fact
- prefer `stanbookHints` for operational guidance
- prefer `analysisNotes` for explanatory human-facing observations
- update provenance fields when making a substantive change

## Practical Example

For a case like `2004_02259`, a future durable note might say:

```json
{
  "decisionStructure": {
    "decisionForm": "memorandum",
    "hasMajority": true,
    "isMemorandum": true
  },
  "sourceFeatures": {
    "counselShape": {
      "usesAppearancesOfCounsel": true
    },
    "sourceQuirks": [
      "malformed appearances container closing tag"
    ]
  },
  "stanbookHints": {
    "deriveAppearancesFrom": "header_lines",
    "sourceTypos": [
      {
        "location": "appearances_of_counsel",
        "issue": "stray </appcouns> closing tag",
        "effect": "first appearance line may be truncated by normal extraction"
      }
    ]
  },
  "analysisNotes": [
    {
      "type": "source",
      "text": "The source contains a malformed appearances container, but the raw counsel lines are still recoverable."
    }
  ]
}
```

For a true plurality or split-result case, the note should emphasize the structural fact first, not the parser quirk.
