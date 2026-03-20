export type OpinionInlineNode =
  | OpinionTextNode
  | OpinionEmphasisNode
  | OpinionLinkNode
  | OpinionFootnoteReferenceNode
  | OpinionPageMarkerNode
  | OpinionUnknownInlineNode;

export type OpinionBlockNode =
  | OpinionParagraphBlock
  | OpinionSubheaderBlock
  | OpinionMetadataBlock
  | OpinionQuoteBlock
  | OpinionUnknownBlock;

export type OpinionTextNode = {
  type: "text";
  text: string;
};

export type OpinionEmphasisNode = {
  type: "emphasis";
  children?: OpinionInlineNode[] | null;
};

export type OpinionLinkNode = {
  type: "link";
  href?: string | null;
  children?: OpinionInlineNode[] | null;
};

export type OpinionFootnoteReferenceNode = {
  type: "footnote_reference";
  label?: string | null;
  target?: string | null;
  children?: OpinionInlineNode[] | null;
};

export type OpinionPageMarkerNode = {
  type: "page_marker";
  text?: string | null;
  citation?: string | null;
};

export type OpinionUnknownInlineNode = {
  type: string;
  text?: string | null;
  children?: OpinionInlineNode[] | null;
  href?: string | null;
  label?: string | null;
  target?: string | null;
  citation?: string | null;
  [key: string]: unknown;
};

export type OpinionParagraphBlock = {
  type: "paragraph";
  inlines?: OpinionInlineNode[] | null;
  provenance?: OpinionProvenance | null;
};

export type OpinionSubheaderBlock = {
  type: "subheader";
  inlines?: OpinionInlineNode[] | null;
  provenance?: OpinionProvenance | null;
};

export type OpinionMetadataBlock = {
  type: "metadata";
  label?: string | null;
  value?: string | null;
  inlines?: OpinionInlineNode[] | null;
  provenance?: OpinionProvenance | null;
};

export type OpinionQuoteBlock = {
  type: "quote";
  inlines?: OpinionInlineNode[] | null;
  blocks?: OpinionBlockNode[] | null;
  provenance?: OpinionProvenance | null;
};

export type OpinionUnknownBlock = {
  type: string;
  label?: string | null;
  value?: string | null;
  inlines?: OpinionInlineNode[] | null;
  blocks?: OpinionBlockNode[] | null;
  provenance?: OpinionProvenance | null;
  [key: string]: unknown;
};

export type OpinionProvenance = {
  startLine?: number | null;
  endLine?: number | null;
};

export type OpinionAppearance = {
  side?: string | null;
  text?: string | null;
  provenance?: OpinionProvenance | null;
};

export type OpinionWriting = {
  kind?: string | null;
  author?: string | null;
  authorStatus?: "named" | "anonymous" | "unknown" | null;
  label?: string | null;
  joiners?: string[] | null;
  blocks?: OpinionBlockNode[] | null;
};

export type OpinionFootnote = {
  label?: string | null;
  blocks?: OpinionBlockNode[] | null;
};

export type OpinionDispositionPart = {
  type?: string | null;
  text?: string | null;
};

export type OpinionDocument = {
  version?: string | null;
  documentType?: string | null;
  source?: {
    kind?: string | null;
    caseId?: string | null;
    path?: string | null;
    publicationStatus?: string | null;
    [key: string]: unknown;
  } | null;
  header?: {
    title?: string | null;
    caption?: string[] | null;
    slipOpinion?: string | null;
    officialCitation?: string | null;
    court?: string | null;
    decisionDate?: string | null;
    [key: string]: unknown;
  } | null;
  appearances?: OpinionAppearance[] | null;
  opinions?: OpinionWriting[] | null;
  footnotes?: OpinionFootnote[] | null;
  disposition?:
    | string
    | {
        text?: string | null;
        parts?: OpinionDispositionPart[] | null;
        provenance?: OpinionProvenance | null;
        [key: string]: unknown;
      }
    | null;
  renderingHints?: {
    hasOfficialPageMarkers?: boolean | null;
    hasAppearances?: boolean | null;
    hasFootnotes?: boolean | null;
    hasSeparateOpinions?: boolean | null;
    [key: string]: unknown;
  } | null;
  debug?: {
    diagnostics?: unknown[] | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};
