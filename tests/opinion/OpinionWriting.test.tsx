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
