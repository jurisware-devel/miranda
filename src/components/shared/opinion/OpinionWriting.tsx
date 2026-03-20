import React, { useState } from "react";
import type { OpinionWriting as OpinionWritingType } from "../../../core/opinions/types";
import OpinionBlock from "./OpinionBlock";

type OpinionWritingProps = {
  writing: OpinionWritingType;
  index: number;
  opinionSourceUrl?: string;
};

const OpinionWriting: React.FC<OpinionWritingProps> = ({ writing, index, opinionSourceUrl }) => {
  const kind = writing.kind?.trim().toLowerCase() ?? "";
  const [isExpanded, setIsExpanded] = useState(kind === "majority");
  const title =
    writing.label?.trim() ||
    writing.author?.trim() ||
    writing.kind?.trim() ||
    "Opinion";
  const panelTitle = title;

  return (
    <section className="opinion-writing opinion-writing--collapsible" aria-labelledby={`opinion-writing-${index}`}>
      <button
        id={`opinion-writing-${index}`}
        type="button"
        className="opinion-writing__summary"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((value) => !value)}
      >
        <span className="opinion-writing__summary-text">{panelTitle}</span>
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
