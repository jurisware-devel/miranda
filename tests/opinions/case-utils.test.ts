import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLocalOpinionDocumentCandidatePaths,
  buildOpinionDocumentCandidateUrls,
} from "../../src/core/utils/caseUtils";
import type { CaseItem } from "../../src/core/types";

test("buildOpinionDocumentCandidateUrls prefers Stanbook JSON in the existing opinion path pattern", () => {
  const caseItem = {
    caseId: "2026_00963",
    court: "coa",
    decisionDate: "2026-02-25",
    opinionUrl: "2012/2012_07858",
  } as CaseItem;

  const urls = buildOpinionDocumentCandidateUrls(caseItem.opinionUrl, caseItem);

  assert.deepEqual(urls, [
    "https://opinions.jurisware.com/coa/2012/2012_07858.json",
    "https://opinions.jurisware.com/coa/2012/2012_07858.md",
    "https://opinions.jurisware.com/coa/2012/2012_07858.pdf",
  ]);
});

test("buildOpinionDocumentCandidateUrls avoids duplicating the court prefix when opinionUrl already includes it", () => {
  const caseItem = {
    caseId: "2026_00963",
    court: "coa",
    decisionDate: "2026-02-25",
    opinionUrl: "coa/2026/2026_00963",
  } as CaseItem;

  const urls = buildOpinionDocumentCandidateUrls(caseItem.opinionUrl, caseItem);

  assert.deepEqual(urls, [
    "https://opinions.jurisware.com/coa/2026/2026_00963.json",
    "https://opinions.jurisware.com/coa/2026/2026_00963.md",
    "https://opinions.jurisware.com/coa/2026/2026_00963.pdf",
  ]);
});

test("buildLocalOpinionDocumentCandidatePaths matches the merged opinions layout", () => {
  const caseItem = {
    caseId: "2026_00963",
    court: "coa",
    decisionDate: "2026-02-25",
    opinionUrl: "2026/2026_00963",
  } as CaseItem;

  const paths = buildLocalOpinionDocumentCandidatePaths(caseItem.opinionUrl, caseItem);

  assert.deepEqual(paths, [
    "coa/2026/2026_00963.json",
    "coa/2026/2026_00963.md",
    "coa/2026/2026_00963.pdf",
  ]);
});
