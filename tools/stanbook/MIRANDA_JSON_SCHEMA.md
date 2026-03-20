# Miranda JSON Schema Draft

This document proposes the active Miranda-facing JSON shape for `stanbook`.

It remains a working draft, but it now reflects the primary product direction for the project. The goal is to define the target contract for:

- `stanbook` HTML lowering
- Java-side JSON serialization
- Miranda-side rendering with user preferences

## Design Goals

- Preserve reader-facing text exactly.
- Preserve source-authored inline formatting where possible.
- Preserve semantic structure needed for user-controlled rendering.
- Treat JSON as the product output.
- Support fast client-side preference changes without rerunning `stanbook`.

## Core Principle

`stanbook` should emit a structured semantic document from opinion HTML.

Miranda should render that structure according to user preferences.

That means preferences like these are applied in Miranda, not baked into the transformed text:

- show or hide official page markers
- show or hide appearances of counsel
- show or hide footnotes
- collapse or expand separate opinions
- show or hide disposition blocks

## Recommended Storage Model

- Source HTML stored in S3
- `stanbook` JSON stored in S3 for large payloads
- DynamoDB stores opinion metadata plus a pointer to the JSON artifact

If payload sizes stay small enough, the JSON could also be stored directly in DynamoDB, but S3 is the safer baseline.

## Contract Reminder

The active end-to-end contract is:

- ingest opinion HTML
- emit structured Miranda JSON
- let Miranda render the opinion presentation

`stanbook` should treat JSON as its only backend output deliverable.

## Top-Level Shape

The JSON document should likely look like this:

```json
{
  "version": "0.1",
  "documentType": "opinion",
  "source": {},
  "header": {},
  "appearances": [],
  "opinions": [],
  "footnotes": [],
  "disposition": null,
  "renderingHints": {},
  "debug": {}
}
```

## Proposed Schema

### Root

```json
{
  "version": "0.1",
  "documentType": "opinion",
  "source": {
    "kind": "lrb_html",
    "caseId": "2026_00963",
    "path": "coa/2026/2026_00963.htm",
    "publicationStatus": "slip_op_only"
  },
  "header": {
    "title": "People v Rios",
    "slipOpinion": "2026 NY Slip Op 00963",
    "officialCitation": null,
    "court": "Court of Appeals",
    "decisionDate": "2026-02-19"
  },
  "appearances": [],
  "opinions": [],
  "footnotes": [],
  "disposition": null,
  "renderingHints": {
    "hasOfficialPageMarkers": false,
    "hasAppearances": true,
    "hasFootnotes": false,
    "hasSeparateOpinions": true
  },
  "debug": {
    "diagnostics": []
  }
}
```

### Source

`source` describes provenance and ingest identity. It is not reader-facing.

```json
{
  "kind": "lrb_html",
  "caseId": "2026_00963",
  "path": "coa/2026/2026_00963.htm",
  "publicationStatus": "slip_op_only"
}
```

Suggested fields:

- `kind`
- `caseId`
- `path`
- `publicationStatus`
- optional `fetchedAt`
- optional `sourceUrl`
- optional `sha256`

### Header

`header` contains canonical opinion metadata for display and indexing.

```json
{
  "title": "People v Rios",
  "caption": [
    "The People of the State of New York, Respondent,",
    "v",
    "John Doe, Appellant."
  ],
  "slipOpinion": "2026 NY Slip Op 00963",
  "officialCitation": null,
  "court": "Court of Appeals",
  "decisionDate": "2026-02-19"
}
```

Possible later additions:

- `arguedDate`
- `correctedDate`
- `docketNumber`
- `panel`

`caption` is optional and preserves caption-party lines that appear separately from the canonical short title.

### Appearances

`appearances` holds counsel and appearance lines as visible text that may be hidden in the UI.

```json
[
  {
    "side": "appellant",
    "text": "Kathleen P. Reardon, for appellant.",
    "provenance": { "startLine": 31, "endLine": 31 }
  },
  {
    "side": "respondent",
    "text": "William G. Gabor, for respondent.",
    "provenance": { "startLine": 32, "endLine": 32 }
  }
]
```

`side` should remain nullable because the source will not always identify it reliably.

### Opinions

`opinions` is the heart of the schema. Each separate writing becomes an opinion entry.

```json
[
  {
    "kind": "majority",
    "author": "Troutman",
    "label": "TROUTMAN, J.",
    "joiners": ["Garcia", "Singas", "Cannataro", "Halligan"],
    "blocks": []
  },
  {
    "kind": "concurrence",
    "author": "Rivera",
    "label": "RIVERA, J. (concurring):",
    "joiners": ["Wilson"],
    "blocks": []
  }
]
```

Recommended fields:

- `kind`
- `author`
- `label`
- `joiners`
- `blocks`

Possible `kind` values:

- `majority`
- `per_curiam`
- `memorandum`
- `opinion_of_the_court`
- `concurrence`
- `concurrence_in_result`
- `dissent`
- `mixed`

`label` is especially important because it preserves reader-facing text exactly as displayed in the source opinion.

### Blocks

Each opinion contains ordered blocks.

```json
[
  {
    "type": "paragraph",
    "inlines": [
      { "type": "text", "text": "In " },
      {
        "type": "emphasis",
        "children": [
          { "type": "text", "text": "People v Lopez" }
        ]
      },
      { "type": "text", "text": " (71 NY2d 662 [1988]), we articulated..." }
    ],
    "provenance": { "startLine": 52, "endLine": 54 }
  },
  {
    "type": "subheader",
    "text": "I.",
    "provenance": { "startLine": 61, "endLine": 61 }
  },
  {
    "type": "quote",
    "inlines": [
      { "type": "text", "text": "\"[U]nder People v Lopez...\"" }
    ],
    "provenance": { "startLine": 73, "endLine": 74 }
  }
]
```

Recommended block types:

- `paragraph`
- `subheader`
- `quote`
- `metadata`
- `page_marker`

`page_marker` blocks are worth considering if Miranda will toggle official page markers independently of surrounding text.

### Inlines

Inline nodes preserve reader-facing text and inline structure.

```json
[
  { "type": "text", "text": "See " },
  {
    "type": "link",
    "href": "https://miranda.jurisware.com/case/2022_05916/",
    "children": [
      {
        "type": "emphasis",
        "children": [
          { "type": "text", "text": "People v Murray" }
        ]
      }
    ]
  },
  { "type": "text", "text": ", 39 NY3d 10, 16 [2022]." }
]
```

Recommended inline types:

- `text`
- `emphasis`
- `link`
- `footnote_reference`
- optional later: `small_caps`

Important rule:

- `text` must preserve visible content exactly
- `emphasis` and `link` may change markup representation but must not alter visible text

### Footnotes

Footnotes should remain separately addressable for UI collapse/expand behavior.

```json
[
  {
    "label": "1",
    "blocks": [
      {
        "type": "paragraph",
        "inlines": [
          { "type": "text", "text": "Example footnote text." }
        ],
        "provenance": { "startLine": 150, "endLine": 150 }
      }
    ]
  }
]
```

### Disposition

The closing disposition line should be preserved as visible text, but separated structurally.

```json
{
  "text": "Order affirmed. Opinion by Judge Troutman. Judges Garcia, Singas, Cannataro and Halligan concur. Judge Rivera concurs in result in an opinion, in which Chief Judge Wilson concurs.",
  "provenance": { "startLine": 131, "endLine": 131 }
}
```

This makes it easy for Miranda to show, hide, or visually separate disposition text without re-parsing strings.

### Rendering Hints

`renderingHints` should only contain convenience booleans. It should not duplicate semantic data already present elsewhere.

```json
{
  "hasOfficialPageMarkers": true,
  "hasAppearances": true,
  "hasFootnotes": true,
  "hasSeparateOpinions": true
}
```

### Debug

`debug` is optional, but useful during ingestion and rollout.

```json
{
  "diagnostics": [
    {
      "severity": "warning",
      "code": "html_variant_unrecognized",
      "message": "Used conservative lowering path for authorless HTML body.",
      "lineNumber": 42
    }
  ]
}
```

This section could be stripped for production if desired.

## Worked Example

Below is a plausible partial payload for `2026_00963`.

```json
{
  "version": "0.1",
  "documentType": "opinion",
  "source": {
    "kind": "lrb_html",
    "caseId": "2026_00963",
    "path": "coa/2026/2026_00963.htm",
    "publicationStatus": "slip_op_only"
  },
  "header": {
    "title": "People v Rios",
    "slipOpinion": "2026 NY Slip Op 00963",
    "officialCitation": null,
    "court": "Court of Appeals",
    "decisionDate": "2026-02-19"
  },
  "appearances": [
    {
      "side": "appellant",
      "text": "Kathleen P. Reardon, for appellant.",
      "provenance": { "startLine": 31, "endLine": 31 }
    }
  ],
  "opinions": [
    {
      "kind": "majority",
      "author": "Troutman",
      "label": "TROUTMAN, J.",
      "joiners": ["Garcia", "Singas", "Cannataro", "Halligan"],
      "blocks": [
        {
          "type": "paragraph",
          "inlines": [
            { "type": "text", "text": "In " },
            {
              "type": "emphasis",
              "children": [
                { "type": "text", "text": "People v Lopez" }
              ]
            },
            { "type": "text", "text": " (71 NY2d 662 [1988]), we articulated a narrow exception..." }
          ],
          "provenance": { "startLine": 52, "endLine": 54 }
        }
      ]
    },
    {
      "kind": "concurrence",
      "author": "Rivera",
      "label": "RIVERA, J. (concurring):",
      "joiners": ["Wilson"],
      "blocks": [
        {
          "type": "paragraph",
          "text": "In People v Beasley, this Court adopted a clear rule...",
          "provenance": { "startLine": 82, "endLine": 84 }
        }
      ]
    }
  ],
  "footnotes": [],
  "disposition": {
    "text": "Order affirmed. Opinion by Judge Troutman. Judges Garcia, Singas, Cannataro and Halligan concur. Judge Rivera concurs in result in an opinion, in which Chief Judge Wilson concurs.",
    "parts": [
      {
        "type": "action",
        "text": "Order affirmed."
      },
      {
        "type": "summary",
        "text": "Opinion by Judge Troutman. Judges Garcia, Singas, Cannataro and Halligan concur. Judge Rivera concurs in result in an opinion, in which Chief Judge Wilson concurs."
      }
    ],
    "provenance": { "startLine": 131, "endLine": 131 }
  },
  "renderingHints": {
    "hasOfficialPageMarkers": false,
    "hasAppearances": true,
    "hasFootnotes": false,
    "hasSeparateOpinions": true
  },
  "debug": {
    "diagnostics": []
  }
}
```

## Relationship To Current Java IR

This proposed JSON aligns closely with the current Java structures:

- `SourceDocument` maps into `source` plus optional debug provenance
- `Header` maps into `header` and `appearances`
- `OpinionBody` maps into `opinions`
- `OpinionComponent` maps into either opinion `label` or opinion `blocks`
- `FootnoteSection` maps into `footnotes`
- `ReflowedDocument` carries intermediate structure that can be serialized into Miranda JSON

The biggest missing piece today is that the current lowered IR still needs to become more Miranda-oriented and metadata-complete.

Specifically, we will likely want:

- dedicated appearance/counsel extraction
- explicit disposition extraction
- explicit separate-opinion grouping object rather than inference at render time
- possibly first-class page-marker nodes

## Recommended Next Steps

1. Freeze a minimal v0 JSON schema for one opinion page.
2. Decide which fields are canonical versus optional.
3. Serialize one real sample opinion to JSON for review in Miranda.
4. Add a tiny React prototype that renders the JSON with:
   - page-marker toggle
   - appearance toggle
   - footnote collapse
   - separate-opinion collapse

That will tell us very quickly whether the schema shape is right.
