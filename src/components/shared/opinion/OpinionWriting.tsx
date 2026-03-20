import React, { useState } from "react";
import type { OpinionWriting as OpinionWritingType } from "../../../core/opinions/types";
import InlineMarkdown from "./InlineMarkdown";
import OpinionBlock from "./OpinionBlock";

const normalizeBannerText = (value: string) => value.replace(/[.:\s]+$/g, "").replace(/\s+/g, " ").trim();
const normalizePanelTitle = (value: string) => value.replace(/:\s*$/g, "").trim();
const defaultDisplayTitle = (kind: string) => {
  if (kind === "memorandum") return "MEMORANDUM";
  if (kind === "opinion_of_the_court") return "OPINION OF THE COURT";
  if (kind === "per_curiam") return "Per Curiam";
  return "";
};
const synthesizedDisplayTitle = (writing: OpinionWritingType, kind: string) => {
  if (writing.label?.trim()) return normalizePanelTitle(writing.label.trim());
  if (writing.author?.trim()) return writing.author.trim();
  if (
    writing.authorStatus === "anonymous" &&
    (kind === "majority" || kind === "opinion_of_the_court")
  ) {
    return "Per Curiam";
  }
  return defaultDisplayTitle(kind);
};
const getLeadingBannerTitle = (writing: OpinionWritingType) => {
  const firstBlock = writing.blocks?.[0];
  if (!firstBlock || firstBlock.type !== "paragraph" || !firstBlock.inlines?.length) {
    return null;
  }
  const firstText = firstBlock.inlines
    .map((node) => ("text" in node && typeof node.text === "string" ? node.text : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = normalizeBannerText(firstText);
  if (!normalized) return null;
  if (normalized.localeCompare("MEMORANDUM", undefined, { sensitivity: "base" }) === 0) {
    return "MEMORANDUM";
  }
  if (normalized.localeCompare("OPINION OF THE COURT", undefined, { sensitivity: "base" }) === 0) {
    return "OPINION OF THE COURT";
  }
  if (normalized.localeCompare("Per Curiam", undefined, { sensitivity: "base" }) === 0) {
    return "Per Curiam";
  }
  return null;
};
const firstBlockRepeatsTitle = (writing: OpinionWritingType, panelTitle: string) => {
  const firstBlock = writing.blocks?.[0];
  if (!firstBlock || firstBlock.type !== "paragraph" || !firstBlock.inlines?.length) {
    return false;
  }
  const firstText = firstBlock.inlines
    .map((node) => ("text" in node && typeof node.text === "string" ? node.text : ""))
    .join("")
    .replace(/\s+/g, " ");
  return normalizeBannerText(firstText).localeCompare(normalizeBannerText(panelTitle), undefined, { sensitivity: "base" }) === 0;
};
const getPanelToneClassName = (kind: string) => {
  if (kind === "majority") return "opinion-writing--majority";
  if (kind === "concurrence" || kind === "concurrence_in_result" || kind === "concurring") {
    return "opinion-writing--concurrence";
  }
  if (kind === "dissent" || kind === "dissenting") return "opinion-writing--dissent";
  return "";
};
const getLabelToneClassName = (kind: string) => {
  if (kind === "majority") return "opinion-writing__summary-text--majority";
  if (kind === "dissent" || kind === "dissenting") return "opinion-writing__summary-text--dissent";
  if (kind === "concurrence" || kind === "concurrence_in_result" || kind === "concurring") {
    return "opinion-writing__summary-text--concurrence";
  }
  return "";
};

type OpinionWritingProps = {
  writing: OpinionWritingType;
  index: number;
  opinionSourceUrl?: string;
  collapsible?: boolean;
};

const OpinionWriting: React.FC<OpinionWritingProps> = ({
  writing,
  index,
  opinionSourceUrl,
  collapsible = true,
}) => {
  const kind = writing.kind?.trim().toLowerCase() ?? "";
  const leadingBannerTitle = getLeadingBannerTitle(writing);
  const [isExpanded, setIsExpanded] = useState(!collapsible || kind === "majority");
  const title =
    synthesizedDisplayTitle(writing, kind) ||
    leadingBannerTitle ||
    (collapsible ? "Opinion" : "");
  const panelTitle = title;
  const panelToneClassName = getPanelToneClassName(kind);
  const labelToneClassName = getLabelToneClassName(kind);
  const skipsLeadingBannerBlock = panelTitle.length > 0 && firstBlockRepeatsTitle(writing, panelTitle);
  const visibleBlocks = skipsLeadingBannerBlock ? (writing.blocks?.slice(1) ?? []) : (writing.blocks ?? []);
  const shouldRenderInlineLabel = panelTitle.length > 0 && (!firstBlockRepeatsTitle(writing, panelTitle) || skipsLeadingBannerBlock);

  if (!collapsible) {
    return (
      <section className="opinion-writing opinion-writing--inline" aria-label={panelTitle}>
        <div className="opinion-writing__content opinion-writing__content--inline">
          {shouldRenderInlineLabel ? (
            <div className="opinion-writing__inline-label">
              <span
                className={`opinion-writing__summary-text${
                  labelToneClassName ? ` ${labelToneClassName}` : ""
                }`}
              >
                <InlineMarkdown>{panelTitle}</InlineMarkdown>
              </span>
            </div>
          ) : null}
          {visibleBlocks.map((block, blockIndex) => (
            <OpinionBlock
              key={`${block.type}-${blockIndex}`}
              block={block}
              opinionSourceUrl={opinionSourceUrl}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`opinion-writing opinion-writing--collapsible${
        panelToneClassName ? ` ${panelToneClassName}` : ""
      }`}
      aria-labelledby={`opinion-writing-${index}`}
    >
      <button
        id={`opinion-writing-${index}`}
        type="button"
        className="opinion-writing__summary"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((value) => !value)}
      >
        <span
          className={`opinion-writing__summary-text${
            labelToneClassName ? ` ${labelToneClassName}` : ""
          }`}
        >
          <InlineMarkdown>{panelTitle}</InlineMarkdown>
        </span>
        <span className="opinion-writing__summary-toggle">{isExpanded ? "Hide" : "Show"}</span>
      </button>
      {isExpanded ? (
        <div className="opinion-writing__content">
          {visibleBlocks.map((block, blockIndex) => (
            <OpinionBlock
              key={`${block.type}-${blockIndex}`}
              block={block}
              opinionSourceUrl={opinionSourceUrl}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default OpinionWriting;
