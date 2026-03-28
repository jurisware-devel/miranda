import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLocalOpinionHtmlCandidatePaths,
  buildLocalOpinionDocumentCandidatePaths,
  buildLocalOpinionJsonCandidatePaths,
  buildLocalOpinionPdfCandidatePaths,
  buildOpinionHtmlCandidateUrls,
  buildOpinionDocumentCandidateUrls,
  buildOpinionJsonCandidateUrls,
  buildOpinionPdfCandidateUrls,
  extractOfficialReporterCitation,
  formatCaseCitationLine,
  isCasePublished,
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
    "https://opinions.jurisware.com/coa/2012/2012_07858.txt",
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
    "https://opinions.jurisware.com/coa/2026/2026_00963.txt",
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
    "coa/2026/2026_00963.txt",
  ]);
});

test("buildOpinionJsonCandidateUrls targets the Miranda JSON artifact only", () => {
  const caseItem = {
    caseId: "2026_00963",
    court: "coa",
    decisionDate: "2026-02-25",
    opinionUrl: "2026/2026_00963",
  } as CaseItem;

  const urls = buildOpinionJsonCandidateUrls(caseItem.opinionUrl, caseItem);

  assert.deepEqual(urls, [
    "https://opinions.jurisware.com/coa/2026/2026_00963.json",
  ]);
});

test("buildLocalOpinionJsonCandidatePaths targets the local Miranda JSON artifact only", () => {
  const caseItem = {
    caseId: "2026_00963",
    court: "coa",
    decisionDate: "2026-02-25",
    opinionUrl: "2026/2026_00963",
  } as CaseItem;

  const paths = buildLocalOpinionJsonCandidatePaths(caseItem.opinionUrl, caseItem);

  assert.deepEqual(paths, [
    "coa/2026/2026_00963.json",
  ]);
});

test("buildOpinionPdfCandidateUrls targets published CoA PDFs by compact NY3d citation filename", () => {
  const caseItem = {
    caseId: "2026_00963",
    court: "coa",
    decisionDate: "2026-02-25",
    ny3dCite: "42 NY3d 973",
    opinionUrl: "2026/2026_00963",
  } as CaseItem;

  const urls = buildOpinionPdfCandidateUrls(caseItem.opinionUrl, caseItem);

  assert.deepEqual(urls, [
    "https://opinions.jurisware.com/coa/ny3d/42NY3d/42NY3d973.pdf",
  ]);
});

test("buildLocalOpinionPdfCandidatePaths targets published CoA PDFs by compact NY3d citation filename", () => {
  const caseItem = {
    caseId: "2026_00963",
    court: "coa",
    decisionDate: "2026-02-25",
    ny3dCite: "42 NY3d 973",
    opinionUrl: "2026/2026_00963",
  } as CaseItem;

  const paths = buildLocalOpinionPdfCandidatePaths(caseItem.opinionUrl, caseItem);

  assert.deepEqual(paths, [
    "coa/ny3d/42NY3d/42NY3d973.pdf",
  ]);
});

test("buildOpinionPdfCandidateUrls returns no candidates when there is no NY3d citation", () => {
  const caseItem = {
    caseId: "2026_00963",
    court: "coa",
    caseName: "People v. Dufresne",
    decisionDate: "2026-02-25",
    opinionUrl: "2026/2026_00963",
  } as CaseItem;

  const urls = buildOpinionPdfCandidateUrls(caseItem.opinionUrl, caseItem);

  assert.deepEqual(urls, []);
});

test("extractOfficialReporterCitation isolates the official cite from mixed slip-op text", () => {
  assert.equal(
    extractOfficialReporterCitation("2025 NY Slip Op 02100 (44 NY3d 1)"),
    "44 NY3d 1",
  );
});

test("formatCaseCitationLine shows only the decision year for published decisions", () => {
  const caseItem = {
    caseId: "2026_00963",
    court: "coa",
    publicationStatus: "published",
    decisionDate: "2026-02-25",
    ny3dCite: "42 NY3d 973",
  } as CaseItem;

  assert.equal(formatCaseCitationLine(caseItem), "42 NY3d 973 (2026)");
});

test("formatCaseCitationLine infers published status from an official reporter citation", () => {
  const caseItem = {
    caseId: "2025_06534",
    court: "coa",
    decisionDate: "2025-11-25",
    ny3dCite: "44 NY3d 302",
    slipOp: "2025 NY Slip Op 06534",
  } as CaseItem;

  assert.equal(formatCaseCitationLine(caseItem), "44 NY3d 302 (2025)");
});

test("isCasePublished treats CoA publication as the presence of a NY3d citation", () => {
  const publishedCase = {
    caseId: "2025_06534",
    court: "coa",
    decisionDate: "2025-11-25",
    ny3dCite: "44 NY3d 302",
    slipOp: "2025 NY Slip Op 06534",
    publicationStatus: "slip_opinion",
  } as CaseItem;
  const unpublishedCase = {
    caseId: "2026_01588",
    court: "coa",
    decisionDate: "2026-03-26",
    slipOp: "2026 NY Slip Op 01588",
    publicationStatus: "published",
  } as CaseItem;

  assert.equal(isCasePublished(publishedCase), true);
  assert.equal(isCasePublished(unpublishedCase), false);
});

test("formatCaseCitationLine keeps the full recent date for unpublished decisions", () => {
  const caseItem = {
    caseId: "2026_00963",
    court: "coa",
    publicationStatus: "slip_opinion",
    decisionDate: "2026-02-25",
    slipOp: "2026 NY Slip Op 00963",
  } as CaseItem;

  assert.equal(
    formatCaseCitationLine(caseItem, new Date("2026-03-26T12:00:00Z")),
    "2026 NY Slip Op 00963 (Feb 24, 2026)",
  );
});

test("buildOpinionHtmlCandidateUrls points at sibling Stanbook source HTML", () => {
  const caseItem = {
    caseId: "2026_00963",
    court: "coa",
    decisionDate: "2026-02-25",
    opinionUrl: "2026/2026_00963",
  } as CaseItem;

  const urls = buildOpinionHtmlCandidateUrls(caseItem.opinionUrl, caseItem);

  assert.deepEqual(urls, [
    "https://opinions.jurisware.com/coa/2026/2026_00963.htm",
  ]);
});

test("buildLocalOpinionHtmlCandidatePaths points at sibling source HTML in the merged corpus", () => {
  const caseItem = {
    caseId: "2026_00963",
    court: "coa",
    decisionDate: "2026-02-25",
    opinionUrl: "2026/2026_00963",
  } as CaseItem;

  const paths = buildLocalOpinionHtmlCandidatePaths(caseItem.opinionUrl, caseItem);

  assert.deepEqual(paths, [
    "coa/2026/2026_00963.htm",
  ]);
});
