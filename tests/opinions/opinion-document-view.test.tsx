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
  assert.match(html, /href="\/case\/2013_07651"/);
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

  assert.match(html, /OPINION OF THE COURT/);
  assert.match(html, /Body text\./);
});

test("OpinionDocumentView does not synthesize a per curiam heading from author metadata", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        kind: "opinion_of_the_court",
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

  assert.match(html, /Body text\./);
  assert.doesNotMatch(html, />Opinion of the Court</);
  assert.doesNotMatch(html, />majority</);
});

test("OpinionDocumentView does not synthesize authored headings for separate writings", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        kind: "concurrence",
        author: "Feinman",
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Concurrence text." }],
          },
        ],
      },
      {
        kind: "dissent",
        author: "Wilson",
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

  assert.doesNotMatch(html, /Feinman, J\. \(concurring\)\./);
  assert.doesNotMatch(html, /Wilson, J\. \(dissenting\)\./);
  assert.match(html, /Concurrence text\./);
  assert.match(html, /Dissent text\./);
});

test("OpinionDocumentView does not synthesize authored Opinion of the Court headings", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        kind: "opinion_of_the_court",
        author: "Halligan",
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Plurality text." }],
          },
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.doesNotMatch(html, /Opinion of the Court by Halligan, J\./);
  assert.match(html, /Plurality text\./);
});

test("OpinionDocumentView does not duplicate a separate-writing heading already present in the first block", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        kind: "dissent",
        author: "Rivera",
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Rivera, J. (dissenting)." }],
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
  const matches = html.match(/Rivera, J\. \(dissenting\)\./g) ?? [];

  assert.equal(matches.length, 1);
});

test("OpinionDocumentView does not synthesize an Opinion of the Court heading for anonymous effective writings", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        kind: "opinion_of_the_court",
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

  assert.doesNotMatch(html, />Opinion of the Court</);
  assert.match(html, /Body text\./);
});

test("OpinionDocumentView does not duplicate a literal Opinion of the Court heading already present in the first block", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        kind: "opinion_of_the_court",
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Opinion of the Court" }],
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
  const matches = html.match(/Opinion of the Court/g) ?? [];

  assert.equal(matches.length, 1);
});

test("OpinionDocumentView styles recognized writing qualifiers like Appearances of Counsel headings", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        kind: "opinion_of_the_court",
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Per Curiam." }],
          },
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Body text." }],
          },
        ],
      },
      {
        kind: "dissent",
        author: "Rivera",
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Rivera, J. (dissenting)." }],
          },
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, /class="opinion-block opinion-block--qualifier opinion-block--paragraph">Per Curiam\.<\/p>/);
  assert.match(html, /class="opinion-block opinion-block--qualifier opinion-block--paragraph">Rivera, J\. \(dissenting\)\.<\/p>/);
});

test("OpinionDocumentView renders markdown italics in disposition text", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        kind: "opinion_of_the_court",
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Majority text." }],
          },
        ],
      },
      {
        kind: "dissent",
        blocks: [
          {
            type: "paragraph",
            inlines: [{ type: "text", text: "Dissent text." }],
          },
        ],
      },
    ],
    disposition: {
      text: "*People v Suarez*, 13 AD3d 320, reversed.",
      parts: [{ type: "action", text: "*People v Suarez*, 13 AD3d 320, reversed." }],
    },
  };

  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, /<em>People v Suarez<\/em>, 13 AD3d 320, reversed\./);
  assert.doesNotMatch(html, /\*People v Suarez\*/);
});

test("OpinionDocumentView folds malformed mixed continuations into the preceding opinion", () => {
  const sample = loadSample("2026_01588.json");
  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, /waived the right to the effective assistance of counsel/);
  assert.doesNotMatch(html, />Univ of Chicago L Rev 263/);
});

test("OpinionDocumentView recovers a source-authored dissent heading when Stanbook separates the metadata line from the writing", () => {
  const sample = loadSample("2026_01446.json");
  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, /class="opinion-block opinion-block--qualifier opinion-block--paragraph">CANNATARO, J\.:\s*<\/p>/);
  assert.match(html, /RIVERA, J\. \(dissenting\):/);
  assert.match(html, /class="opinion-block opinion-block--qualifier opinion-block--paragraph">RIVERA, J\. \(dissenting\):<\/p>/);
  assert.match(html, />\s*The prosecution charged defendant with aggravated harassment 14 months after/);
});

test("OpinionDocumentView renders fallback memorandum body when no structured opinion blocks are present", () => {
  const sample = loadSample("2026_01445.json");
  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, />MEMORANDUM:?<\/p>/);
  assert.match(html, /Defendant has not demonstrated a lack of strategic or other legitimate explanation/);
  assert.doesNotMatch(html, /Opinion content is not available\./);
  assert.match(html, /opinion-writing__content opinion-writing__content--inline/);
});

test("OpinionHeader does not render header.appearances as a generic header detail row", () => {
  const sample: OpinionDocument = {
    header: {
      title: "Example Case",
      slipOpinion: "2026 NY Slip Op 00015",
      court: "Court of Appeals",
      decisionDate: "2026-03-20",
      appearances: [{ side: "appellant", text: "Jane Doe, for appellant." }],
    },
  };

  const html = renderToStaticMarkup(<OpinionHeader document={sample} variant="details" />);

  assert.doesNotMatch(html, /Jane Doe, for appellant\./);
  assert.match(html, /Court of Appeals/);
});

test("OpinionDocumentView reads fallback writings from top-level fallback.opinionLines", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    fallback: {
      opinionLines: [
        { lineNumber: 1, text: "MEMORANDUM" },
        { lineNumber: 2, text: "Body text from fallback." },
      ],
    },
  };

  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, />MEMORANDUM<\/p>/);
  assert.match(html, /Body text from fallback\./);
  assert.doesNotMatch(html, /Opinion content is not available\./);
});

test("OpinionDocumentView renders a lone Opinion of the Court as flowing body text", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        kind: "opinion_of_the_court",
        author: "Jones",
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

  assert.match(html, /Body text\./);
  assert.match(html, /Order affirmed\./);
  assert.match(html, /opinion-writing__content opinion-writing__content--inline/);
  assert.match(html, /class="opinion-document__disposition"/);
  assert.ok(html.indexOf("Body text.") < html.indexOf("Order affirmed."));
});

test("OpinionDocumentView renders a lone structured memorandum as flowing body text", () => {
  const sample = loadSample("2026_01445.json");
  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, />MEMORANDUM:?<\/p>/);
  assert.match(html, /opinion-writing__content opinion-writing__content--inline/);
});

test("OpinionDocumentView renders page markers as page badges with original marker tooltip", () => {
  const sample: OpinionDocument = {
    header: { title: "Example Case" },
    opinions: [
      {
        kind: "opinion_of_the_court",
        blocks: [
          {
            type: "paragraph",
            inlines: [
              { type: "text", text: "Body text with marker " },
              { type: "page_marker", text: "{**1 NY3d at 2}", citation: "1 NY3d at 2" },
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

  assert.match(html, /class="opinion-inline__page-marker"/);
  assert.match(html, /title="\{\*\*1 NY3d at 2\}"/);
  assert.match(html, /aria-label="\{\*\*1 NY3d at 2\}"/);
  assert.match(html, />2<\/span>/);
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

test("OpinionDocumentView renders a published citation subtitle beneath the title", () => {
  const sample: OpinionDocument = {
    source: {
      publicationStatus: "published",
    },
    header: {
      title: "People v Example",
      officialCitation: "35 NY3d 123",
      decisionDate: "2026-03-20",
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

  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, /People v Example/);
  assert.match(html, />35 NY3d 123 \(2026\)<\/p>/);
});

test("OpinionDocumentView renders a slip opinion subtitle for non-published opinions", () => {
  const sample: OpinionDocument = {
    source: {
      publicationStatus: "slip_op_only",
    },
    header: {
      title: "People v Example",
      slipOpinion: "2026 NY Slip Op 01590",
      officialCitation: "35 NY3d 123",
      decisionDate: "2026-03-20",
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

  const html = renderToStaticMarkup(<OpinionDocumentView document={sample} />);

  assert.match(html, />2026 NY Slip Op 01590<\/p>/);
  assert.doesNotMatch(html, />35 NY3d 123 \(2026\)<\/p>/);
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

test("OpinionHeader repairs a caption that ends at a bare v using the fallback title", () => {
  const sample: OpinionDocument = {
    header: {
      title: null,
      caption: [
        "The People of the State of New York ex rel. Chance McCurdy, Appellant,",
        "v",
      ],
      slipOpinion: "2020 NY Slip Op 06933",
      court: "Court of Appeals",
      decisionDate: "2020-11-23",
    },
  };

  const html = renderToStaticMarkup(
    <OpinionHeader
      document={sample}
      variant="details"
      fallbackTitle="People ex rel. McCurdy v Warden, Westchester County Corr. Facility"
    />,
  );

  assert.match(html, /The People of the State of New York ex rel\. Chance McCurdy, Appellant,/);
  assert.match(html, />v</);
  assert.match(html, /Warden, Westchester County Corr\. Facility/);
});
