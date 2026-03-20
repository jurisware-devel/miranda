import React, { useState } from "react";
import type { OpinionWriting as OpinionWritingType } from "../../../core/opinions/types";
import OpinionBlock from "./OpinionBlock";

const trimDisplayLabel = (value: string) => value.replace(/:\s*$/, "");
const defaultDisplayTitle = (kind: string, hasNamedAuthor: boolean) => {
  if (kind === "majority" && !hasNamedAuthor) return "Per Curiam";
  if (kind === "memorandum") return "MEMORANDUM";
  if (kind === "opinion_of_the_court") return "OPINION OF THE COURT";
  if (kind === "per_curiam") return "Per Curiam";
  return "";
};
const firstBlockRepeatsTitle = (writing: OpinionWritingType, panelTitle: string) => {
  const firstBlock = writing.blocks?.[0];
  if (!firstBlock || firstBlock.type !== "paragraph" || !firstBlock.inlines?.length) {
    return false;
  }
  const firstText = firstBlock.inlines
    .map((node) => ("text" in node && typeof node.text === "string" ? node.text : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return firstText.localeCompare(panelTitle.trim(), undefined, { sensitivity: "base" }) === 0;
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
  const hasNamedAuthor = Boolean(writing.author?.trim());
  const [isExpanded, setIsExpanded] = useState(!collapsible || kind === "majority");
  const title =
    writing.label?.trim() ||
    writing.author?.trim() ||
    defaultDisplayTitle(kind, hasNamedAuthor) ||
    writing.kind?.trim() ||
    "Opinion";
  const panelTitle = trimDisplayLabel(title);
  const panelToneClassName = getPanelToneClassName(kind);
  const labelToneClassName = getLabelToneClassName(kind);
  const shouldRenderInlineLabel = panelTitle.length > 0 && !firstBlockRepeatsTitle(writing, panelTitle);

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
                {panelTitle}
              </span>
            </div>
          ) : null}
          {writing.blocks?.map((block, blockIndex) => (
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
          {panelTitle}
        </span>
        <span className="opinion-writing__summary-toggle">{isExpanded ? "Hide" : "Show"}</span>
      </button>
      {isExpanded ? (
        <div className="opinion-writing__content">
          {writing.blocks?.map((block, blockIndex) => (
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
