#!/usr/bin/env python3
"""Move opinion .md files from texts/coa/<year>/<year>_<id>.md to coa/<year>_<id>.md.

Usage:
  python3 scripts/move_opinions_flat.py --dry-run
  python3 scripts/move_opinions_flat.py --apply

Defaults:
  bucket = opinions.jurisware.com
  source prefix = texts/coa/
  destination prefix = coa/

Notes:
- Only moves .md files matching texts/coa/<year>/<filename>.md
- Skips non-md and nested paths.
"""

import argparse
import json
import subprocess
import sys


def list_md_keys(bucket: str, prefix: str) -> list[str]:
    resp = subprocess.check_output([
        "aws","s3api","list-objects-v2",
        "--bucket",bucket,
        "--prefix",prefix,
        "--query","Contents[?ends_with(Key, `.md`)].Key",
        "--output","json"
    ])
    return json.loads(resp)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bucket", default="opinions.jurisware.com")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    if args.dry_run == args.apply:
        print("Choose exactly one of --dry-run or --apply")
        return 2

    src_prefix = "texts/coa/"
    dst_prefix = "coa/"

    keys = list_md_keys(args.bucket, src_prefix)
    if not keys:
        print(f"No .md files found under s3://{args.bucket}/{src_prefix}")
        return 0

    moved = 0
    skipped = 0

    for key in keys:
        # Expect: texts/coa/<year>/<filename>.md
        remainder = key[len(src_prefix):]
        if "/" not in remainder:
            skipped += 1
            continue
        year, filename = remainder.split("/", 1)
        if not year.isdigit() or len(year) != 4:
            skipped += 1
            continue
        if "/" in filename:
            skipped += 1
            continue
        if not filename.endswith(".md"):
            skipped += 1
            continue

        new_key = f"{dst_prefix}{filename}"

        if args.dry_run:
            print(f"DRY-RUN: copy s3://{args.bucket}/{key} -> s3://{args.bucket}/{new_key}")
            print(f"DRY-RUN: delete s3://{args.bucket}/{key}")
        else:
            subprocess.check_call([
                "aws","s3api","copy-object",
                "--bucket",args.bucket,
                "--copy-source",f"{args.bucket}/{key}",
                "--key",new_key
            ])
            subprocess.check_call([
                "aws","s3api","delete-object",
                "--bucket",args.bucket,
                "--key",key
            ])
            print(f"MOVED {key} -> {new_key}")

        moved += 1

    print(f"Processed {len(keys)} keys. Moved {moved}. Skipped {skipped}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
