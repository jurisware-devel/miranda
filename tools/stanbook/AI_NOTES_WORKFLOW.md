# AI Notes Workflow

This document describes how Codex should generate durable Court of Appeals
`.notes.json` files from source `.htm` opinions.

Use this workflow when asked to analyze a year, range, or set of COA opinion
HTML files and write sibling `.notes.json` files for them.

This workflow is intentionally different from Miranda JSON regeneration:

- Miranda JSON is regenerated freely.
- AI notes are intended to be durable.
- AI notes are grounded in the source `.htm` only.
- AI notes may later be amended through Codex when new quirks are discovered.

Read this file together with
[AI_NOTES_SCHEMA.md](/Users/jonathan/Projects/miranda/tools/stanbook/AI_NOTES_SCHEMA.md).

## Goal

Produce one structured `.notes.json` file per source opinion HTML file that:

- records opinion-specific structural meaning
- records source-specific quirks that matter to `stanbook`
- can be consumed later by `stanbook` as advisory metadata
- remains useful even after Miranda JSON is regenerated many times

These notes are not meant to mirror Miranda JSON and are not meant to be a
parser debug dump.

## Source Of Truth

For AI note generation, analyze the `.htm` file only.

Do not rely on:

- sibling `.json`
- previously generated Miranda JSON
- app rendering behavior

Existing `.notes.json` may be read only when the task is to update or amend a
previously created note. For first-pass generation, the HTML source is the
authoritative input.

## What The Notes Should Capture

The notes should focus on facts like:

- whether the decision is a majority, plurality, memorandum, per curiam, or
  otherwise unusual
- whether a majority writing exists
- what separate writings exist and how they relate to the result
- whether the case resolves multiple lower-court rulings, multiple appeals, or
  split results
- whether the source uses unusual counsel or citation structure
- whether the source contains quirks or malformations that `stanbook` should
  know about

Examples:

- "This is a plurality, so there is no majority writing."
- "This opinion addresses two lower court rulings and contains a writing that
  concurs in one result and dissents in another."
- "Appearances must be derived from points of counsel."
- "The official citation is embedded parenthetically in the slip-op line."
- "A malformed closing tag in the appearances section may truncate extraction."

## What The Notes Should Not Emphasize

Avoid turning the notes into a low-level HTML inventory. Do not prioritize:

- tag counts
- exhaustive DOM description
- parser-internal implementation details
- corpus-wide statistics

Low-level source observations are only useful when they explain a meaningful
opinion-specific quirk or a `stanbook` risk.

## Output Contract

Write one sibling `.notes.json` file next to each source opinion HTML file.

Examples:

- `opinions/coa/2004/2004_02259.htm`
- `opinions/coa/2004/2004_02259.notes.json`

The output must follow the contract in
[AI_NOTES_SCHEMA.md](/Users/jonathan/Projects/miranda/tools/stanbook/AI_NOTES_SCHEMA.md).

Key sections are:

- `provenance`
- `decisionStructure`
- `writings`
- `resultStructure`
- `sourceFeatures`
- `stanbookHints`
- `analysisNotes`

## Default Generation Process

When asked to generate notes for a set of COA opinions, Codex should:

1. Identify the target `.htm` files.
2. Read each HTML file directly.
3. Analyze the opinion structure carefully, with attention to:
   - decision form
   - authorship
   - concurrence/dissent relationships
   - split-result or multi-ruling structure
   - counsel and citation layout
   - source quirks relevant to `stanbook`
4. Produce a structured `.notes.json` file for each opinion.
5. Keep claims conservative. If a structural conclusion is uncertain, use:
   - `confidence`
   - `unclear`
   - a short `analysisNotes` explanation
6. Write the note beside the source `.htm`.

## Update Process

When asked to revise an existing `.notes.json`, Codex should:

1. Read the target `.htm`.
2. Read the existing `.notes.json`.
3. Update only the fields needed to capture the newly discovered fact or quirk.
4. Preserve the schema shape.
5. Update provenance metadata to reflect the new Codex-directed amendment.

This is the intended mechanism for opinion-specific maintenance over time.

Examples:

- adding a source typo that affects extraction
- clarifying that an opinion is a plurality with no majority writing
- recording that a writing concurs in part and dissents in part as to different
  results

## Stanbook Relationship

These notes are meant to be more permanent than regenerated Miranda JSON.

Stanbook may use them later as advisory metadata, especially in
`stanbookHints`, but the notes should not become a hidden replacement parser.

The right mental model is:

- `.htm` is the source
- `.notes.json` is durable opinion-specific guidance
- Miranda JSON is derived output

## Suggested User Prompts

Examples of good prompts for future Codex sessions:

- "Please look at
  /Users/jonathan/Projects/miranda/tools/stanbook/AI_NOTES_WORKFLOW.md and
  follow it to generate notes for the 2004 COA files."
- "Please follow
  /Users/jonathan/Projects/miranda/tools/stanbook/AI_NOTES_WORKFLOW.md and
  update the notes for 2014_01234 to reflect a typo in the HTML source."
- "Please use
  /Users/jonathan/Projects/miranda/tools/stanbook/AI_NOTES_WORKFLOW.md and
  [AI_NOTES_SCHEMA.md](/Users/jonathan/Projects/miranda/tools/stanbook/AI_NOTES_SCHEMA.md)
  to generate notes for the 2003 COA opinions."

## Practical Guidance For Codex

- Prefer careful file-by-file analysis over mass heuristic generation.
- Do not infer from existing Miranda JSON during first-pass note generation.
- Use structured fields first; use `analysisNotes` for concise explanations that
  do not fit cleanly elsewhere.
- If a case is unusually ambiguous, preserve the ambiguity rather than forcing a
  brittle conclusion.
- Keep the notes useful both to a human reader and to later `stanbook`
  consumption.
