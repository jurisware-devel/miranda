import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OpinionHeader from "../../src/components/shared/opinion/OpinionHeader";
import OpinionDocumentView from "../../src/components/shared/opinion/OpinionDocumentView";
import type { OpinionDocument } from "../../src/core/opinions/types";

const loadSample = (name: string) => {
  const year = name.slice(0, 4);
  const filePath = path.resolve(process.cwd(), "opinions", "coa", year, name);
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
  assert.doesNotMatch(html, /Kathleen P\. Reardon, for appellant\./);
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
  assert.match(html, />Footnotes</);
  assert.match(html, />Show</);
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

  assert.doesNotMatch(html, /class="opinion-writing__summary"/);
  assert.match(html, /OPINION OF THE COURT/);
});

test("OpinionDocumentView labels a per curiam majority from author metadata", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        kind: "majority",
        author: "Per Curiam",
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Body text." }],
          },
        ],
      },
      {
        kind: "dissent",
        author: "Smith",
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Dissent." }],
          },
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, />Per Curiam</);
  assert.doesNotMatch(html, />majority</);
});

test("OpinionDocumentView does not label a generic anonymous majority as Per Curiam", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        kind: "majority",
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Body text." }],
          },
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.doesNotMatch(html, />Per Curiam</);
  assert.match(html, /Body text\./);
});

test("OpinionDocumentView trims a trailing colon from collapsible writing labels", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        kind: "majority",
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Majority text." }],
          },
        ],
      },
      {
        kind: "dissent",
        label: "SINGAS, J. (dissenting):",
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Dissent text." }],
          },
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, />SINGAS, J\. \(dissenting\)<\/span>/);
  assert.doesNotMatch(html, />SINGAS, J\. \(dissenting\):<\/span>/);
});

test("OpinionDocumentView folds malformed mixed continuations into the preceding opinion", () => {
  const sample = loadSample("2026_01588.json");
  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, />WILSON, Chief Judge \(dissenting\)</);
  assert.doesNotMatch(html, />Univ of Chicago L Rev 263/);
});

test("OpinionDocumentView renders fallback memorandum body when no structured opinion blocks are present", () => {
  const sample = loadSample("2026_01445.json");
  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, />MEMORANDUM<\/span>/);
  assert.doesNotMatch(html, />MEMORANDUM:<\/p>/);
  assert.match(html, /Defendant has not demonstrated a lack of strategic or other legitimate explanation/);
  assert.doesNotMatch(html, /Opinion content is not available\./);
  assert.doesNotMatch(html, /class="opinion-writing__summary"/);
  assert.match(html, /opinion-writing__content opinion-writing__content--inline/);
});

test("OpinionDocumentView renders a lone majority opinion without a collapsible panel", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        kind: "majority",
        author: "Jones",
        label: "JONES, J.:",
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Body text." }],
          },
        ],
      },
    ],
    disposition: {
      text: "Order affirmed.",
      parts: [{ type: "action", text: "Order affirmed." }],
    },
  };

  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, />JONES, J\.<\/span>/);
  assert.match(html, /Body text\./);
  assert.match(html, /Order affirmed\./);
  assert.doesNotMatch(html, /class="opinion-writing__summary"/);
  assert.match(html, /opinion-writing__content opinion-writing__content--inline/);
  assert.match(html, /opinion-document__disposition opinion-document__disposition--after-inline-writing/);
  assert.ok(html.indexOf("Body text.") < html.indexOf("Order affirmed."));
});

test("OpinionDocumentView renders a lone structured memorandum without a collapsible panel", () => {
  const sample = loadSample("2026_01445.json");
  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, />MEMORANDUM<\/span>/);
  assert.doesNotMatch(html, />MEMORANDUM:<\/p>/);
  assert.doesNotMatch(html, /class="opinion-writing__summary"/);
  assert.match(html, /opinion-writing__content opinion-writing__content--inline/);
});

test("OpinionDocumentView does not render the old page-marker placeholder", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        kind: "majority",
        blocks: [
          {
            type: "paragraph",
            inlines: [
              { type: "text", text: "Body text with marker " },
              { type: "page_marker", text: "{**1 NY3d at 2}" },
            ],
          },
        ],
      },
    ],
    renderingHints: {
      hasOfficialPageMarkers: true,
    },
  };

  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, /\{\*\*1 NY3d at 2\}/);
  assert.doesNotMatch(html, /page-marker nodes are not yet rendered/);
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
  assert.doesNotMatch(html, /2025 NY Slip Op 05785/);
  assert.doesNotMatch(html, /Court of Appeals/);
});

test("OpinionHeader links Court of Appeals header citations to the Law Reporting Bureau html page", () => {
  const sample: OpinionDocument = {
    source: {
      caseId: "2026_00963",
    },
    header: {
      title: "People v Example",
      slipOpinion: "2026 NY Slip Op 00963",
      officialCitation: "35 NY3d 123",
      court: "Court of Appeals",
      decisionDate: "2026-03-20",
    },
  };

  const html = renderToStaticMarkup(<OpinionHeader document={sample} variant="details" />);

  assert.match(html, /href="https:\/\/nycourts\.gov\/reporter\/3dseries\/2026\/2026_00963\.htm"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noreferrer"/);
  assert.match(html, />35 NY3d 123<\/a>/);
  assert.doesNotMatch(html, /2026 NY Slip Op 00963/);
  assert.doesNotMatch(html, /Official Citation/);
});

test("OpinionHeader keeps the slip opinion citation when no official citation is available", () => {
  const sample: OpinionDocument = {
    source: {
      caseId: "2026_00963",
    },
    header: {
      title: "People v Example",
      slipOpinion: "2026 NY Slip Op 00963",
      officialCitation: "",
      court: "Court of Appeals",
      decisionDate: "2026-03-20",
    },
  };

  const html = renderToStaticMarkup(<OpinionHeader document={sample} variant="details" />);

  assert.match(html, />2026 NY Slip Op 00963<\/a>/);
});

test("OpinionHeader keeps the slip opinion citation when the fallback official citation duplicates it", () => {
  const sample: OpinionDocument = {
    source: {
      caseId: "2026_01590",
    },
    header: {
      title: "People v Example",
      slipOpinion: "2026 NY Slip Op 01590",
      officialCitation: null,
      court: "Court of Appeals",
      decisionDate: "2026-03-19",
    },
  };

  const html = renderToStaticMarkup(
    <OpinionHeader
      document={sample}
      variant="details"
      fallbackOfficialCitation="2026 NY Slip Op 01590"
    />,
  );

  assert.match(html, />2026 NY Slip Op 01590<\/a>/);
  assert.match(html, /target="_blank"/);
  assert.doesNotMatch(html, /Official Citation/);
});

test("OpinionHeader renders caption party lines as multiline header material", () => {
  const sample: OpinionDocument = {
    header: {
      title: "People v Example",
      caption: [
        "The People of the State of New York, Respondent,",
        "v",
        "John Doe, Appellant.",
      ],
      slipOpinion: "2026 NY Slip Op 00963",
      court: "Court of Appeals",
      decisionDate: "2026-03-20",
    },
  };

  const html = renderToStaticMarkup(<OpinionHeader document={sample} variant="details" />);

  assert.match(html, /The People of the State of New York, Respondent,/);
  assert.match(html, />v</);
  assert.match(html, /John Doe, Appellant\./);
  assert.doesNotMatch(html, /The People of the State of New York, Respondent,\s*,\s*v/);
});
