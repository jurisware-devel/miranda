# AGENTS.md

## COA Corpus JSON Regeneration

Regenerate the entire Court of Appeals JSON corpus by running Stanbook against the full `opinions/coa` tree.

From the repo root:

```bash
cd /Users/jonathan/Projects/miranda/tools/stanbook
./stanbook-dir /Users/jonathan/Projects/miranda/opinions/coa
```

What this does:
- walks every `.htm` file under `/Users/jonathan/Projects/miranda/opinions/coa`
- writes the sibling `.json` file next to each source HTML file

Expected success signal:

```text
stanbook-dir: wrote 1417 JSON file(s)
```

## COA Sync To S3

After regenerating the corpus, sync the local opinions directories to S3 and create a CloudFront invalidation.

From the repo root:

```bash
cd /Users/jonathan/Projects/miranda/opinions/scripts
./sync-to-s3.sh
```

What this does:
- syncs `scotus`, `coa`, `ad3`, and `albany` opinion assets to `s3://opinions.jurisware.com`
- uploads `.md`, `.json`, and `.pdf` files
- creates a CloudFront invalidation for `/coa/*` and `/*.md`

Expected success signal:

```text
Done.
```

## Recommended Verification

After a regen, spot-check the changed opinion JSON for the intended structural output. For example:

```bash
rg -n '"disposition"|"parts"|2026_00638' /Users/jonathan/Projects/miranda/opinions/coa/2026/2026_00638.json
```

For the `2026_00638` disposition split, the expected structure is:
- `action`: `Appeal dismissed without prejudice, in a memorandum.`
- `summary`: `Chief Judge Wilson and Judges Rivera, Garcia, Singas, Cannataro, Troutman and Halligan concur.`

## Common Pitfalls

- Run `stanbook-dir` from `/Users/jonathan/Projects/miranda/tools/stanbook`. The wrapper script changes into that directory and runs Maven there.
- `stanbook-dir` does not support `--help`. It expects exactly one argument: the directory tree containing the source opinion HTML.
- The correct full-corpus target is `/Users/jonathan/Projects/miranda/opinions/coa`, not the repo root and not `/Users/jonathan/Projects/miranda/tools/stanbook`.
- Run `sync-to-s3.sh` from `/Users/jonathan/Projects/miranda/opinions/scripts`, or invoke it by full path. There is no repo-root `sync-to-s3.sh`.
- `sync-to-s3.sh` uploads all opinion families it finds under `opinions/`, not just `coa`. That is expected behavior for this script.
- The S3 sync depends on working AWS credentials and permission to write to `s3://opinions.jurisware.com` and create a CloudFront invalidation.
- A successful CloudFront invalidation is usually returned with status `InProgress` first. That is normal and does not mean the script failed.

## Troubleshooting

- If `./stanbook-dir` prints `Not a directory`, check the argument path first.
- If Maven test or compile errors appear before regeneration, fix the Stanbook build before attempting a corpus-wide rewrite.
- If `sync-to-s3.sh` fails on `aws s3 sync` or `aws cloudfront create-invalidation`, verify AWS authentication, region/profile setup, and permissions.
- If you need to confirm that a specific case actually changed after regen, use `git diff -- /absolute/path/to/file.json`.
