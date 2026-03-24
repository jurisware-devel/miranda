import React, { useEffect, useMemo, useRef, useState } from "react";
import { Empty } from "antd";
import type {
  OpinionDocument,
  OpinionWriting as OpinionWritingType,
} from "../../../core/opinions/types";
import { formatOpinionSubtitle } from "../../../core/utils/caseUtils";
import FootnotesPanel from "./FootnotesPanel";
import InlineMarkdown from "./InlineMarkdown";
import OpinionAppearances from "./OpinionAppearances";
import OpinionHeader from "./OpinionHeader";
import OpinionWriting from "./OpinionWriting";
import { isRecognizedWritingQualifier } from "./opinionWritingQualifiers";

type OpinionDocumentViewProps = {
  document: OpinionDocument;
  opinionSourceUrl?: string;
  fallbackTitle?: string | null;
  fallbackSlipOpinion?: string | null;
  fallbackOfficialCitation?: string | null;
  fallbackCourt?: string | null;
  fallbackDecisionDate?: string | null;
};

type FallbackOpinionLine = {
  lineNumber?: number | null;
  text?: string | null;
};

const fallbackOpinionLines = (document: OpinionDocument): FallbackOpinionLine[] => {
  return document.fallback?.opinionLines ??
    ((document.source as { fallback?: { opinionLines?: FallbackOpinionLine[] | null } | null } | null)
      ?.fallback?.opinionLines ?? []);
};

const blockPlainText = (block?: OpinionWritingType["blocks"] extends infer Blocks
  ? Blocks extends (infer Block)[] | null | undefined
    ? Block
    : never
  : never): string => {
  if (!block || !("inlines" in block) || !block.inlines?.length) return "";
  return block.inlines
    .map((node) => {
      if (node.type === "text" || node.type === "page_marker") {
        return node.text ?? "";
      }
      if ("children" in node) {
        return (node.children ?? [])
          .map((child) => ("text" in child ? (child.text ?? "") : ""))
          .join("");
      }
      return "";
    })
    .join("")
    .trim();
};

const recoverBlockText = (
  block: NonNullable<OpinionWritingType["blocks"]>[number],
  fallbackLinesByNumber: Map<number, string>,
) => {
  const existingText = blockPlainText(block);
  if (existingText || !block.provenance?.startLine || block.provenance?.startLine !== block.provenance?.endLine) {
    return existingText;
  }
  return fallbackLinesByNumber.get(block.provenance.startLine) ?? "";
};

const trimLeadingColonFromNodes = (nodes: NonNullable<NonNullable<OpinionWritingType["blocks"]>[number]["inlines"]>) => {
  let trimmed = false;
  return nodes.map((node) => {
    if (trimmed) return node;
    if (node.type === "text") {
      const nextText = (node.text ?? "").replace(/^:\s*/, "");
      if (nextText !== (node.text ?? "")) {
        trimmed = true;
        return { ...node, text: nextText };
      }
      if ((node.text ?? "").length > 0) {
        trimmed = true;
      }
      return node;
    }
    if ("children" in node && node.children?.length) {
      const nextChildren = trimLeadingColonFromNodes(node.children);
      if (nextChildren !== node.children) {
        trimmed = true;
        return { ...node, children: nextChildren };
      }
    }
    return node;
  });
};

const trimLeadingColonFromFirstBlock = (writing: OpinionWritingType): OpinionWritingType => {
  const blocks = [...(writing.blocks ?? [])];
  const firstBlock = blocks[0];
  if (!firstBlock || !("inlines" in firstBlock) || !firstBlock.inlines?.length) {
    return writing;
  }
  blocks[0] = {
    ...firstBlock,
    inlines: trimLeadingColonFromNodes(firstBlock.inlines),
  };
  return {
    ...writing,
    blocks,
  };
};

const recoveredQualifierBlocks = (
  writing: OpinionWritingType,
  fallbackLinesByNumber: Map<number, string>,
) => {
  const blocks = writing.blocks ?? [];
  if (!blocks.length) return [];

  const recovered = blocks
    .map((block) => {
      const text = recoverBlockText(block, fallbackLinesByNumber).trim();
      if (!text) return null;
      return {
        type: "paragraph" as const,
        inlines: [{ type: "text" as const, text }],
        provenance: block.provenance,
      };
    })
    .filter((block) => block && isRecognizedWritingQualifier(block.inlines?.[0]?.text))
    .filter(Boolean);

  return recovered;
};

const shouldAbsorbQualifierIntoNextWriting = (
  current: OpinionWritingType,
  next: OpinionWritingType | undefined,
  fallbackLinesByNumber: Map<number, string>,
) => {
  if (!next || (current.kind?.trim().toLowerCase() ?? "") !== "unknown") {
    return false;
  }
  return recoveredQualifierBlocks(current, fallbackLinesByNumber).length > 0;
};

const normalizeWritings = (document: OpinionDocument, writings: OpinionWritingType[]) => {
  const fallbackLinesByNumber = new Map(
    fallbackOpinionLines(document)
      .filter((line): line is Required<Pick<FallbackOpinionLine, "lineNumber" | "text">> =>
        typeof line?.lineNumber === "number" && typeof line?.text === "string")
      .map((line) => [line.lineNumber, line.text.trim()]),
  );

  return writings.reduce<OpinionWritingType[]>((accumulator, writing, index) => {
    const kind = writing.kind?.trim().toLowerCase() ?? "";
    const previous = accumulator[accumulator.length - 1];
    const next = writings[index + 1];

    // Stanbook occasionally emits a trailing "mixed" writing that is really a continuation
    // of the preceding opinion body. Fold it back in so the body stays contiguous.
    if (kind === "mixed" && previous) {
      accumulator[accumulator.length - 1] = {
        ...previous,
        blocks: [...(previous.blocks ?? []), ...(writing.blocks ?? [])],
      };
      return accumulator;
    }

    if (shouldAbsorbQualifierIntoNextWriting(writing, next, fallbackLinesByNumber)) {
      const qualifierBlocks = recoveredQualifierBlocks(writing, fallbackLinesByNumber);
      const nextWriting = trimLeadingColonFromFirstBlock(next!);
      writings[index + 1] = {
        ...nextWriting,
        blocks: [...qualifierBlocks, ...(nextWriting.blocks ?? [])],
      };
      return accumulator;
    }

    accumulator.push(writing);
    return accumulator;
  }, []);
};

const opinionAppearances = (document: OpinionDocument) => {
  return document.header?.appearances ?? document.appearances ?? [];
};

const fallbackWritingsFromSource = (document: OpinionDocument): OpinionWritingType[] => {
  const rawLines = fallbackOpinionLines(document)
    .map((line) => line?.text?.trim() ?? "")
    .filter(Boolean);
  if (!rawLines.length) return [];

  const labelIndex = rawLines.findIndex((line) => /^(?:MEMORANDUM|[A-Z .,'()-]+J\.)[:.]?$/i.test(line));
  if (labelIndex < 0) return [];

  const bodyLines = rawLines.slice(labelIndex).filter((line) => {
    if (/^Decided\b/i.test(line)) return false;
    if (/^Order .*concur\./i.test(line)) return false;
    return true;
  });
  if (!bodyLines.length) return [];

  return [
    {
      kind: "opinion_of_the_court",
      blocks: bodyLines.map((line) => ({
        type: "paragraph" as const,
        inlines: [{ type: "text" as const, text: line }],
      })),
    },
  ];
};

const OpinionDocumentView: React.FC<OpinionDocumentViewProps> = ({
  document,
  opinionSourceUrl,
  fallbackTitle,
  fallbackSlipOpinion,
  fallbackOfficialCitation,
  fallbackCourt,
  fallbackDecisionDate,
}) => {
  const [showHeader, setShowHeader] = useState(false);
  const [showFootnotes, setShowFootnotes] = useState(false);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const writings = useMemo(
    () => {
      const normalized = normalizeWritings(document, document.opinions?.filter(Boolean) ?? []);
      return normalized.length ? normalized : fallbackWritingsFromSource(document);
    },
    [document],
  );
  const hasFootnotes = Boolean(document.footnotes?.length);
  const appearances = opinionAppearances(document);
  const hasAppearances = Boolean(appearances.some((appearance) => appearance?.text?.trim()));
  const title = document.header?.title ?? fallbackTitle ?? "";
  const publishedSubtitle = formatOpinionSubtitle({
    publicationStatus: document.source?.publicationStatus,
    officialCitation: document.header?.officialCitation ?? fallbackOfficialCitation,
    slipOpinion: document.header?.slipOpinion ?? fallbackSlipOpinion,
    decisionDate: document.header?.decisionDate ?? fallbackDecisionDate,
  });
  const dispositionParts =
    typeof document.disposition === "string"
      ? [{ type: "action", text: document.disposition.trim() }]
      : (document.disposition?.parts
          ?.map((part) => ({
            type: part?.type?.trim() ?? "",
            text: part?.text?.trim() ?? "",
          }))
          .filter((part) => part.text) ?? []);
  const dispositionText =
    dispositionParts.length > 0
      ? ""
      : typeof document.disposition === "string"
        ? document.disposition.trim()
        : document.disposition?.text?.trim() ?? "";
  const bodyLabelId = useMemo(
    () => `opinion-body-${document.source?.caseId ?? "document"}`,
    [document.source?.caseId],
  );

  useEffect(() => {
    setShowFootnotes(false);
  }, [document.source?.caseId]);

  const handleHeaderToggle = () => {
    setShowHeader((value) => !value);
    bodyScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <div className="case-detail__opinion-content opinion-document">
      <section className="opinion-document__title-shell" aria-labelledby="opinion-title-heading">
        <div className="opinion-document__title-bar">
          <div className="opinion-title-section">
            {title ? <h1 id="opinion-title-heading" className="case-detail__pdf-title">{title}</h1> : null}
          </div>
          <div className="opinion-document__title-actions">
            <button
              type="button"
              className="opinion-document__toggle"
              onClick={handleHeaderToggle}
            >
              {showHeader ? "Hide" : "Header"}
            </button>
          </div>
        </div>
        {publishedSubtitle ? (
          <div className="opinion-document__subtitle-row">
            <div className="opinion-document__subtitle-content">
              <p className="case-detail__pdf-subtitle">{publishedSubtitle}</p>
            </div>
          </div>
        ) : null}
      </section>

      <div className="opinion-document__main">
        <section className="opinion-document__body-shell" aria-labelledby={bodyLabelId}>
          <h2 id={bodyLabelId} className="sr-only">
            Body
          </h2>
          <div ref={bodyScrollRef} className="opinion-document__body-scroll">
            {showHeader ? (
              <div className="opinion-document__header-body opinion-document__header-body--inline" aria-label="Header">
                <OpinionHeader
                  document={document}
                  variant="details"
                  fallbackTitle={fallbackTitle}
                  fallbackSlipOpinion={fallbackSlipOpinion}
                  fallbackOfficialCitation={fallbackOfficialCitation}
                  fallbackCourt={fallbackCourt}
                  fallbackDecisionDate={fallbackDecisionDate}
                />
                {hasAppearances ? (
                  <OpinionAppearances appearances={appearances} />
                ) : null}
              </div>
            ) : null}
            {writings.length ? (
              writings.map((writing, index) => (
                <OpinionWriting
                  key={`${writing.author ?? writing.kind ?? "writing"}-${index}`}
                  writing={writing}
                  opinionSourceUrl={opinionSourceUrl}
                />
              ))
            ) : (
              <Empty description="Opinion content is not available." />
            )}
            {dispositionParts.length > 0 ? (
              <section
                className="opinion-document__disposition"
                aria-label="Disposition"
              >
                {dispositionParts.map((part, index) => (
                  <p
                    key={`${part.type || "part"}-${index}`}
                    className="opinion-document__disposition-text"
                  >
                    <InlineMarkdown>{part.text}</InlineMarkdown>
                  </p>
                ))}
              </section>
            ) : dispositionText ? (
              <section
                className="opinion-document__disposition"
                aria-label="Disposition"
              >
                <p className="opinion-document__disposition-text">
                  <InlineMarkdown>{dispositionText}</InlineMarkdown>
                </p>
              </section>
            ) : null}
          </div>
        </section>
      </div>

      {hasFootnotes ? (
        <section className="opinion-document__footnotes-shell" aria-labelledby="opinion-footnotes-shell-heading">
          <div className="opinion-document__section-bar">
            <h2 id="opinion-footnotes-shell-heading" className="opinion-document__section-heading">
              Footnotes
            </h2>
            <button
              type="button"
              className="opinion-document__toggle"
              onClick={() => setShowFootnotes((value) => !value)}
            >
              {showFootnotes ? "Hide" : "Show"}
            </button>
          </div>
          {showFootnotes ? (
            <FootnotesPanel
              footnotes={document.footnotes}
              opinionSourceUrl={opinionSourceUrl}
              showTitle={false}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
};

export default OpinionDocumentView;
