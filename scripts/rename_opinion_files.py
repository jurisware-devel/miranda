#!/usr/bin/env python3
"""Rename S3 opinion files from .txt to .md for a given year.

Usage:
  python3 scripts/rename_opinion_files.py --year 2025 --dry-run
  python3 scripts/rename_opinion_files.py --year 2025 --apply

Defaults:
  bucket = opinions.jurisware.com
  prefix = texts/coa/<year>/
"""

import argparse
import json
import subprocess
import sys


def list_txt_keys(bucket: str, prefix: str) -> list[str]:
    resp = subprocess.check_output([
        "aws","s3api","list-objects-v2",
        "--bucket",bucket,
        "--prefix",prefix,
        "--query","Contents[?ends_with(Key, `.txt`)].Key",
        "--output","json"
    ])
    return json.loads(resp)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", required=True, help="Year folder, e.g. 2025")
    parser.add_argument("--bucket", default="opinions.jurisware.com")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    if args.dry_run == args.apply:
        print("Choose exactly one of --dry-run or --apply")
        return 2

    prefix = f"texts/coa/{args.year}/"
    keys = list_txt_keys(args.bucket, prefix)

    if not keys:
        print(f"No .txt files found under s3://{args.bucket}/{prefix}")
        return 0

    for key in keys:
        new_key = key[:-4] + ".md"
        if args.dry_run:
            print(f"DRY-RUN: copy s3://{args.bucket}/{key} -> s3://{args.bucket}/{new_key}")
            print(f"DRY-RUN: delete s3://{args.bucket}/{key}")
            continue

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
        print(f"RENAMED {key} -> {new_key}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
