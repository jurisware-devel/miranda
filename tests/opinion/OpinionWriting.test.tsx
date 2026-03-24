import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OpinionWriting from "../../src/components/shared/opinion/OpinionWriting.tsx";
import { isRecognizedWritingQualifier } from "../../src/components/shared/opinion/opinionWritingQualifiers.ts";
import type { OpinionWriting as OpinionWritingType } from "../../src/core/opinions/types.ts";

test("recognizes OPINION OF THE COURT when a page marker appears first on the same line", () => {
  assert.equal(isRecognizedWritingQualifier("{**44 NY3d at 1039} OPINION OF THE COURT"), true);
});

test("recognizes authored majority labels ending with a colon", () => {
  assert.equal(isRecognizedWritingQualifier("CANNATARO, J.:"), true);
});

test("renders qualifier typography for OPINION OF THE COURT when preceded by a page marker", () => {
  const writing: OpinionWritingType = {
    kind: "opinion_of_the_court",
    author: null,
    blocks: [
      {
        type: "paragraph",
        inlines: [
          {
            type: "page_marker",
            text: "{**44 NY3d at 1039}",
            citation: "44 NY3d at 1039",
          },
          {
            type: "text",
            text: " OPINION OF THE COURT",
          },
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(<OpinionWriting writing={writing} />);
  assert.match(html, /opinion-block--qualifier/);
  assert.match(html, /OPINION OF THE COURT/);
});

test("renders qualifier typography for authored majority labels", () => {
  const writing: OpinionWritingType = {
    kind: "opinion_of_the_court",
    author: "Cannataro",
    blocks: [
      {
        type: "paragraph",
        inlines: [{ type: "text", text: "CANNATARO, J.:" }],
      },
      {
        type: "paragraph",
        inlines: [{ type: "text", text: "Majority text." }],
      },
    ],
  };

  const html = renderToStaticMarkup(<OpinionWriting writing={writing} />);
  assert.match(html, /class="opinion-block opinion-block--qualifier opinion-block--paragraph">CANNATARO, J\.:<\/p>/);
  assert.match(html, /Majority text\./);
});
