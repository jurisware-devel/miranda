# stanbook

`stanbook` is a Java command-line tool for converting New York Law Reporting Bureau opinion `.htm` files into Miranda JSON.

## Purpose

`stanbook` reads opinion HTML downloaded from the NY Law Reporting Bureau website, parses the document structure, and writes a sibling `.json` file that Miranda can load and render.

The tool is responsible for:

- loading `.htm` and `.html` opinion files
- extracting header metadata, appearances, opinion writings, content blocks, and footnotes
- preserving inline semantics and source-authored structure
- emitting Miranda-facing JSON next to the source file

The JSON contract is documented in [MIRANDA_JSON_SCHEMA.md](/Users/jonathan/Projects/miranda/tools/stanbook/MIRANDA_JSON_SCHEMA.md).

## Layout

- CLI entrypoint: [`StanbookCli.java`](/Users/jonathan/Projects/miranda/tools/stanbook/src/main/java/dev/stanbook/cli/StanbookCli.java)
- pipeline assembly: [`StanbookPipeline.java`](/Users/jonathan/Projects/miranda/tools/stanbook/src/main/java/dev/stanbook/pipeline/StanbookPipeline.java)
- JSON renderer: [`MirandaJsonRenderer.java`](/Users/jonathan/Projects/miranda/tools/stanbook/src/main/java/dev/stanbook/render/json/MirandaJsonRenderer.java)
- build file: [`pom.xml`](/Users/jonathan/Projects/miranda/tools/stanbook/pom.xml)

## Usage

Convert one opinion file:

```bash
./stanbook path/to/opinion.htm
```

Convert every opinion file under a directory tree:

```bash
./stanbook-dir path/to/html-root
```

Both commands run the Java CLI and write `.json` output beside each source `.htm` file.

## Development

Run the Java test suite:

```bash
mvn test
```
