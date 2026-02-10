#!/usr/bin/env python3
"""Normalize opinionUrl to new flat S3 key layout.

Transforms:
  texts/coa/<year>/<year>_<id>.txt -> coa/<year>_<id>
  texts/coa/<year>/<year>_<id>.md  -> coa/<year>_<id>
  coa/<year>/<year>_<id>.txt       -> coa/<year>_<id>
  coa/<year>/<year>_<id>.md        -> coa/<year>_<id>

Leaves absolute http(s) URLs unchanged.
"""

import argparse
import re
import sys
import boto3
from boto3.dynamodb.conditions import Attr


def normalize(value: str) -> str:
    v = value.strip()
    if v.lower().startswith("http"):
        return v

    v = v.lstrip("/")
    v = re.sub(r"\.txt", "", v, flags=re.IGNORECASE)
    v = re.sub(r"\.md", "", v, flags=re.IGNORECASE)

    m = re.match(r"^texts/coa/(\d{4})/([^/]+)$", v)
    if m:
        return f"coa/{m.group(2)}"

    m = re.match(r"^coa/(\d{4})/([^/]+)$", v)
    if m:
        return f"coa/{m.group(2)}"

    return v


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--table", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    if args.dry_run == args.apply:
        print("Choose exactly one of --dry-run or --apply")
        return 2

    table = boto3.resource("dynamodb").Table(args.table)

    scan_kwargs = {
        "ProjectionExpression": "caseId, opinionUrl",
        "FilterExpression": Attr("opinionUrl").exists(),
    }

    updated = 0
    scanned = 0
    last_key = None

    while True:
        if last_key:
            scan_kwargs["ExclusiveStartKey"] = last_key
        resp = table.scan(**scan_kwargs)
        items = resp.get("Items", [])
        scanned += len(items)

        for item in items:
            case_id = item.get("caseId")
            opinion_url = item.get("opinionUrl") or ""
            new_url = normalize(opinion_url)

            if new_url == opinion_url:
                continue

            updated += 1
            if args.dry_run:
                print(f"DRY-RUN {case_id}: {opinion_url} -> {new_url}")
            else:
                table.update_item(
                    Key={"caseId": case_id},
                    UpdateExpression="SET opinionUrl = :val",
                    ExpressionAttributeValues={":val": new_url},
                )
                print(f"UPDATED {case_id}: {opinion_url} -> {new_url}")

        last_key = resp.get("LastEvaluatedKey")
        if not last_key:
            break

    print(f"Scanned {scanned} items. Updated {updated} items.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
