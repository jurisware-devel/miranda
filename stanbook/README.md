# stanbook

`stanbook` is a Java command-line tool that converts `.htm` opinion files downloaded from the New York Law Reporting Bureau website into structured `.json` files for the Miranda web app.

## Active Contract

`stanbook` now has a single product path:

- input: Law Reporting Bureau style opinion HTML
- input source: `.htm` files downloaded from the New York Law Reporting Bureau site
- pipeline: parse and lower the source into typed document structure
- output: Miranda-facing `.json` files
- renderer responsibility: Miranda, not `stanbook`

The project is no longer centered on:

- Markdown as the primary output
- inference-heavy formatting reconstruction
- Python as the active implementation language

Those earlier directions remain useful as historical context, but they are not the active contract for the project.

The active ingest contract is HTML-only. The Java pipeline expects NY Law Reporting Bureau opinion sources in `.htm` or `.html` form and writes corresponding `.json` output; it does not include a plain-text fallback parser.

## Current Scope

The current Java pipeline is responsible for:

- loading downloaded opinion `.htm` files and normalizing source quirks
- extracting header metadata, appearances, opinion structure, footnotes, and inline semantics
- preserving source-authored meaning and formatting cues in structured form
- emitting `.json` files that Miranda can render according to user preferences

The pipeline should avoid making presentation decisions that belong in the frontend.

## Output Target

The primary deliverable is a structured JSON document shaped for Miranda. At a high level, that JSON includes:

- source provenance
- canonical header metadata
- appearances
- separate opinion writings and ordered content blocks
- footnotes
- rendering hints
- debug diagnostics

See [MIRANDA_JSON_SCHEMA.md](/Users/jonathan/Projects/miranda/stanbook/MIRANDA_JSON_SCHEMA.md) for the current schema draft.

## Implementation Status

The active implementation is Java and lives under [`src/main/java`](/Users/jonathan/Projects/miranda/stanbook/src/main/java).

Current notable pieces include:

- CLI entrypoint: [`StanbookCli.java`](/Users/jonathan/Projects/miranda/stanbook/src/main/java/dev/stanbook/cli/StanbookCli.java)
- pipeline assembly: [`StanbookPipeline.java`](/Users/jonathan/Projects/miranda/stanbook/src/main/java/dev/stanbook/pipeline/StanbookPipeline.java)
- Miranda JSON renderer: [`MirandaJsonRenderer.java`](/Users/jonathan/Projects/miranda/stanbook/src/main/java/dev/stanbook/render/json/MirandaJsonRenderer.java)

Legacy Python code remains in the repo as reference material only. It is not the active path for new product work.

## Usage

Convert one downloaded opinion `.htm` file to Miranda JSON:

```bash
./stanbook path/to/opinion.htm
```

Convert every downloaded `.htm` file under a directory tree to sibling `.json` files:

```bash
./stanbook-dir path/to/html-root
```

## Near-Term Direction

The next phases of work should focus on:

- hardening the Miranda JSON contract
- expanding HTML-first regression coverage over the sample corpus
- extracting more opinion metadata directly from source HTML
- removing ambiguity between active Java code and legacy Python reference material
