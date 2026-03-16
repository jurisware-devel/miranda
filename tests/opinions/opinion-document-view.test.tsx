import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OpinionDocumentView from "../../src/components/opinion/OpinionDocumentView";
import type { OpinionDocument } from "../../src/core/opinions/types";

const loadSample = (name: string) => {
  const filePath = path.resolve(process.cwd(), "samples", name);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as OpinionDocument;
};

test("OpinionDocumentView renders structured opinion content from sample JSON", () => {
  const sample = loadSample("2026_00963.json");
  const html = renderToStaticMarkup(
    <OpinionDocumentView
      document={sample}
      opinionSourceUrl="https://opinions.jurisware.com/coa/2026/2026_00963.json"
    />,
  );

  assert.match(html, /People v Rios/);
  assert.match(html, /Kathleen P\. Reardon, for appellant\./);
  assert.match(html, /<em>People v Lopez<\/em>/);
  assert.match(html, /href="https:\/\/opinions\.jurisware\.com\/coa\/2013\/2013_07651\.htm"/);
  assert.match(html, /TROUTMAN, J\./);
});

test("OpinionDocumentView renders footnote references and the footnotes panel from sample JSON", () => {
  const sample = loadSample("2008_09854.json");
  const html = renderToStaticMarkup(
    <OpinionDocumentView
      document={sample}
      opinionSourceUrl="https://opinions.jurisware.com/coa/2008/2008_09854.json"
    />,
  );

  assert.match(html, /href="#opinion-footnote-1"/);
  assert.match(html, /Show footnotes \(5\)/);
  assert.doesNotMatch(html, />majority</);
});

test("OpinionDocumentView does not repeat a writing title already present in the first block", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        label: "OPINION OF THE COURT",
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "OPINION OF THE COURT" }],
          },
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Body text." }],
          },
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  const matches = html.match(/OPINION OF THE COURT/g) ?? [];
  assert.equal(matches.length, 1);
});

test("OpinionDocumentView falls back to case metadata when the JSON header title is missing", () => {
  const sample: OpinionDocument = {
    header: {
      title: null,
      slipOpinion: null,
      officialCitation: null,
      court: null,
      decisionDate: null,
    },
    opinions: [
      {
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Body text." }],
          },
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(
    <OpinionDocumentView
      document={sample}
      fallbackTitle="People v Example"
      fallbackSlipOpinion="2025 NY Slip Op 05785"
      fallbackCourt="Court of Appeals"
      fallbackDecisionDate="2025-10-09"
    />,
  );

  assert.match(html, /People v Example/);
  assert.match(html, /2025 NY Slip Op 05785/);
  assert.match(html, /Court of Appeals/);
});
