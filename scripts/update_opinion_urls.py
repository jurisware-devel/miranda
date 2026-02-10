#!/usr/bin/env python3
"""Normalize Case.opinionUrl values to omit file extensions.

Usage:
  python3 scripts/update_opinion_urls.py --table <TABLE_NAME> --dry-run
  python3 scripts/update_opinion_urls.py --table <TABLE_NAME> --apply

Notes:
- Updates only opinionUrl values ending in .txt or .md (case-insensitive).
- Leaves absolute URLs unchanged.
"""

import argparse
import sys
import boto3
from boto3.dynamodb.conditions import Attr

def normalize_url(value: str) -> str:
    v = value.strip()
    if v.lower().startswith("http"):
        return v
    if v.lower().endswith(".txt"):
        return v[:-4]
    if v.lower().endswith(".md"):
        return v[:-3]
    return v


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--table", required=True, help="DynamoDB Case table name")
    parser.add_argument("--apply", action="store_true", help="Apply updates")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes")
    args = parser.parse_args()

    if args.apply and args.dry_run:
        print("Choose either --apply or --dry-run, not both.")
        return 2
    if not args.apply and not args.dry_run:
        print("Specify --dry-run to preview or --apply to update.")
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
            normalized = normalize_url(opinion_url)
            if normalized == opinion_url:
                continue

            updated += 1
            if args.dry_run:
                print(f"DRY-RUN {case_id}: {opinion_url} -> {normalized}")
                continue

            table.update_item(
                Key={"caseId": case_id},
                UpdateExpression="SET opinionUrl = :val",
                ExpressionAttributeValues={":val": normalized},
            )
            print(f"UPDATED {case_id}: {opinion_url} -> {normalized}")

        last_key = resp.get("LastEvaluatedKey")
        if not last_key:
            break

    print(f"Scanned {scanned} items. Updated {updated} items.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
