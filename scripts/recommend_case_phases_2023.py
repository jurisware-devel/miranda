#!/usr/bin/env python3
"""Recommend procedural phases for 2023 appellate cases using Bedrock KB.

This utility:
1. Reads the authoritative Phase taxonomy from the Miranda data API.
2. Reads 2023 cases from the Miranda data API.
3. Queries the Miranda Bedrock Knowledge Base for each case.
4. Validates the returned phase codes against the Phase taxonomy.
5. Writes recommendations to JSON for manual review.

It does not write to the CasePhase table.
"""

from __future__ import annotations

import json
import re
import sys
import time
import argparse
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest

AWS_REGION = "us-east-1"
KNOWLEDGE_BASE_ID = "CR5OACTJGR"
MODEL_ID = "anthropic.claude-3-5-haiku-20241022-v1:0"
INFERENCE_PROFILE_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
CASE_TABLE_NAME = "Case"
PHASE_TABLE_NAME = "Phase"

TARGET_YEAR = 2023
OUTPUT_PATH = Path("phase_recommendations_2023.json")
REQUEST_PAUSE_SECONDS = 0.35
AMPLIFY_OUTPUTS_PATH = Path(__file__).resolve().parent.parent / "amplify_outputs.json"


def build_model_arn(region: str, model_id: str) -> str:
    return f"arn:aws:bedrock:{region}::foundation-model/{model_id}"


def resolve_model_identifier(
    region: str,
    model_id: str,
    inference_profile_id: str,
    account_id: str | None = None,
) -> str:
    profile = inference_profile_id.strip()
    if not profile:
        return build_model_arn(region, model_id)
    if profile.startswith("arn:"):
        return profile
    if not account_id:
        raise RuntimeError(
            "An AWS account id is required to expand a non-ARN inference profile id."
        )
    return f"arn:aws:bedrock:{region}:{account_id}:inference-profile/{profile}"


LIST_PHASES_QUERY = """
query ListPhases($limit: Int, $nextToken: String) {
  listPhases(limit: $limit, nextToken: $nextToken) {
    items {
      phaseId
      label
      sort_order
    }
    nextToken
  }
}
"""

LIST_CASES_QUERY = """
query ListCases($limit: Int, $nextToken: String) {
  listCases(limit: $limit, nextToken: $nextToken) {
    items {
      caseId
      caseName
      citation
      decisionDate
    }
    nextToken
  }
}
"""


class AppSyncClient:
    def __init__(self, endpoint: str, region: str, session: boto3.session.Session):
        self.endpoint = endpoint
        self.region = region
        self.session = session

    def graphql(self, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        payload = json.dumps({"query": query, "variables": variables}).encode("utf-8")
        credentials = self.session.get_credentials()
        if credentials is None:
            raise RuntimeError("No AWS credentials available for signing the AppSync request.")

        frozen_credentials = credentials.get_frozen_credentials()
        aws_request = AWSRequest(
            method="POST",
            url=self.endpoint,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        SigV4Auth(frozen_credentials, "appsync", self.region).add_auth(aws_request)
        signed_headers = dict(aws_request.headers.items())

        request = Request(self.endpoint, data=payload, headers=signed_headers, method="POST")
        with urlopen(request) as response:  # noqa: S310
            raw_body = response.read().decode("utf-8")

        body = json.loads(raw_body)
        errors = body.get("errors") or []
        if errors:
            raise RuntimeError("; ".join(str(error.get("message") or error) for error in errors))
        return body.get("data") or {}


def load_amplify_outputs() -> dict[str, Any]:
    if not AMPLIFY_OUTPUTS_PATH.exists():
        raise FileNotFoundError(f"Missing amplify outputs file: {AMPLIFY_OUTPUTS_PATH}")
    return json.loads(AMPLIFY_OUTPUTS_PATH.read_text(encoding="utf-8"))


def list_all_items(appsync_client: AppSyncClient, query: str, root_field: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    next_token = None

    while True:
        data = appsync_client.graphql(query, {"limit": 1000, "nextToken": next_token})
        payload = data.get(root_field)
        if not isinstance(payload, dict):
            raise RuntimeError(f"Missing {root_field} payload in AppSync response")

        for item in payload.get("items") or []:
            if isinstance(item, dict):
                items.append(item)

        next_token = payload.get("nextToken")
        if not next_token:
            return items


def load_phases(appsync_client: AppSyncClient) -> tuple[list[dict[str, str]], set[str], str]:
    raw_items = list_all_items(appsync_client, LIST_PHASES_QUERY, "listPhases")

    phases = [
        {
            "phaseId": str(item["phaseId"]).strip(),
            "label": str(item.get("label") or "").strip(),
            "sort_order": item.get("sort_order"),
        }
        for item in raw_items
        if item.get("phaseId")
    ]

    phases.sort(key=lambda item: (item.get("sort_order") is None, item.get("sort_order") or 0, item["phaseId"]))

    valid_codes = {item["phaseId"] for item in phases}
    prompt_block = "\n".join(f'{item["phaseId"]} — {item["label"] or item["phaseId"]}' for item in phases)

    return phases, valid_codes, prompt_block


def derive_case_year(case: dict[str, Any]) -> int | None:
    value = case.get("year")
    if isinstance(value, int):
        return value
    if isinstance(value, str) and re.fullmatch(r"\d{4}", value.strip()):
        return int(value.strip())

    decision_date = str(case.get("decisionDate") or "").strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", decision_date):
        return int(decision_date[:4])

    case_id = str(case.get("caseId") or "").strip()
    match = re.match(r"^(\d{4})[_-]", case_id)
    if match:
        return int(match.group(1))

    return None


def load_cases(appsync_client: AppSyncClient) -> list[dict[str, Any]]:
    raw_items = list_all_items(appsync_client, LIST_CASES_QUERY, "listCases")

    cases = []
    for item in raw_items:
        year = derive_case_year(item)
        if year != TARGET_YEAR:
            continue
        case_id = str(item.get("caseId") or "").strip()
        if not case_id:
            continue
        cases.append(
            {
                "caseId": case_id,
                "caseName": str(item.get("caseName") or case_id).strip(),
                "citation": str(item.get("citation") or "").strip(),
                "decisionDate": str(item.get("decisionDate") or "").strip(),
                "year": year,
            }
        )

    cases.sort(key=lambda item: item["caseId"])
    return cases


def build_prompt(case: dict[str, Any], phase_prompt_block: str) -> str:
    citation = case["citation"] or "citation unavailable"
    decision_date = case["decisionDate"] or "decision date unavailable"
    return f"""Retrieve {case["caseName"]} ({citation} [{decision_date}]).

In this case, which of the following phases of the criminal action were claimed to be sources of error? Check all that apply.

Be alert for more than one distinct claimed error arising from more than one procedural phase. If the opinion supports multiple error-producing phases, include all of them.

Choose only from the following phases:

{phase_prompt_block}

Return strictly valid JSON in the following format:

{{
  "phases": ["PHASE_CODE", "PHASE_CODE"],
  "confidence": 0.0
}}

Requirements:
- Return only phaseCode values from the list above, never labels.
- Include every procedural phase supported by the case where an alleged appellate error arose.
- Do not summarize the case.
- Do not explain legal doctrine.
- Return JSON only, with no markdown fences or extra commentary."""


def extract_json_object(text: str) -> dict[str, Any]:
    candidate = text.strip()
    if candidate.startswith("```"):
        candidate = re.sub(r"^```(?:json)?\s*", "", candidate)
        candidate = re.sub(r"\s*```$", "", candidate)

    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", candidate, re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in model response")

    parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("Model response JSON was not an object")
    return parsed


def fallback_extract_from_text(text: str, valid_codes: set[str]) -> tuple[list[str], float]:
    found_codes: list[str] = []
    for match in re.findall(r"\b[A-Z][A-Z0-9_]+\b", text):
        if match in valid_codes and match not in found_codes:
            found_codes.append(match)

    confidence = 0.0
    confidence_match = re.search(
        r'confidence["\s:=-]*([01](?:\.\d+)?)',
        text,
        re.IGNORECASE,
    )
    if confidence_match:
        try:
            confidence = float(confidence_match.group(1))
        except ValueError:
            confidence = 0.0

    confidence = max(0.0, min(1.0, confidence))
    return found_codes, confidence


def normalize_response(parsed: dict[str, Any], valid_codes: set[str]) -> tuple[list[str], float]:
    raw_phases = parsed.get("phases")
    if not isinstance(raw_phases, list):
        raw_phases = []

    phases: list[str] = []
    for value in raw_phases:
        code = str(value).strip()
        if code in valid_codes and code not in phases:
            phases.append(code)

    raw_confidence = parsed.get("confidence", 0.0)
    try:
        confidence = float(raw_confidence)
    except (TypeError, ValueError):
        confidence = 0.0

    confidence = max(0.0, min(1.0, confidence))
    return phases, confidence


def recommend_phases(
    bedrock_client,
    case: dict[str, Any],
    phase_prompt_block: str,
    valid_codes: set[str],
    model_identifier: str,
) -> tuple[list[str], float, str]:
    prompt = build_prompt(case, phase_prompt_block)
    response = bedrock_client.retrieve_and_generate(
        input={"text": prompt},
        retrieveAndGenerateConfiguration={
            "type": "KNOWLEDGE_BASE",
            "knowledgeBaseConfiguration": {
                "knowledgeBaseId": KNOWLEDGE_BASE_ID,
                "modelArn": model_identifier,
            },
        },
    )

    output_text = (
        response.get("output", {}).get("text")
        or ""
    ).strip()
    try:
        parsed = extract_json_object(output_text)
        phases, confidence = normalize_response(parsed, valid_codes)
    except ValueError:
        phases, confidence = fallback_extract_from_text(output_text, valid_codes)
    return phases, confidence, output_text


def fetch_raw_recommendation(
    bedrock_client,
    case: dict[str, Any],
    phase_prompt_block: str,
    model_identifier: str,
) -> tuple[str, str]:
    prompt = build_prompt(case, phase_prompt_block)
    response = bedrock_client.retrieve_and_generate(
        input={"text": prompt},
        retrieveAndGenerateConfiguration={
            "type": "KNOWLEDGE_BASE",
            "knowledgeBaseConfiguration": {
                "knowledgeBaseId": KNOWLEDGE_BASE_ID,
                "modelArn": model_identifier,
            },
        },
    )
    output_text = (response.get("output", {}).get("text") or "").strip()
    return prompt, output_text


def write_results(results: list[dict[str, Any]]) -> None:
    OUTPUT_PATH.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Analyze one case and print the raw Bedrock response without parsing or writing output.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    session = boto3.session.Session(region_name=AWS_REGION)
    bedrock = boto3.client("bedrock-agent-runtime", region_name=AWS_REGION)
    sts = session.client("sts", region_name=AWS_REGION)
    outputs = load_amplify_outputs()
    data_config = outputs.get("data") or {}
    appsync_url = data_config.get("url")
    appsync_region = data_config.get("aws_region") or AWS_REGION
    if not appsync_url:
        raise RuntimeError("Missing data.url in amplify_outputs.json")
    appsync_client = AppSyncClient(appsync_url, appsync_region, session)
    account_id = sts.get_caller_identity()["Account"]
    model_identifier = resolve_model_identifier(
        AWS_REGION,
        MODEL_ID,
        INFERENCE_PROFILE_ID,
        account_id=account_id,
    )

    print(f"Loading phases from {PHASE_TABLE_NAME} via AppSync...")
    phases, valid_codes, phase_prompt_block = load_phases(appsync_client)
    print(f"Loaded {len(phases)} phases.")

    print(f"Loading {TARGET_YEAR} cases from {CASE_TABLE_NAME} via AppSync...")
    cases = load_cases(appsync_client)
    print(f"Loaded {len(cases)} candidate cases for {TARGET_YEAR}.")
    print(f"Using Bedrock model identifier: {model_identifier}")

    if args.dry_run:
        if not cases:
            print("No cases found for dry-run.")
            return 0
        case = cases[0]
        print(f"Dry run case: {case['caseId']} - {case['caseName']}")
        prompt, raw_response = fetch_raw_recommendation(
            bedrock,
            case,
            phase_prompt_block,
            model_identifier,
        )
        print("Prompt sent to Bedrock:")
        print(prompt)
        print()
        print("Raw Bedrock response:")
        print(raw_response)
        return 0

    results: list[dict[str, Any]] = []
    failures = 0

    for index, case in enumerate(cases, start=1):
        print(f"[{index}/{len(cases)}] {case['caseId']} - {case['caseName']}")
        try:
            recommended_phases, confidence, _raw_response = recommend_phases(
                bedrock,
                case,
                phase_prompt_block,
                valid_codes,
                model_identifier,
            )
            results.append(
                {
                    "caseId": case["caseId"],
                    "caseName": case["caseName"],
                    "citation": case["citation"],
                    "recommendedPhases": recommended_phases,
                    "confidence": confidence,
                }
            )
            print(
                f"  -> phases={recommended_phases or []} confidence={confidence:.2f}"
            )
        except Exception as exc:  # noqa: BLE001
            failures += 1
            results.append(
                {
                    "caseId": case["caseId"],
                    "caseName": case["caseName"],
                    "citation": case["citation"],
                    "recommendedPhases": [],
                    "confidence": 0.0,
                    "error": str(exc),
                }
            )
            print(f"  !! failed: {exc}", file=sys.stderr)

        write_results(results)
        time.sleep(REQUEST_PAUSE_SECONDS)

    write_results(results)
    print(f"Wrote {len(results)} results to {OUTPUT_PATH}")
    if failures:
        print(f"Completed with {failures} failed case(s).", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
