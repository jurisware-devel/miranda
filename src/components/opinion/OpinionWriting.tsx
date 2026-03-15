import React from "react";
import type { OpinionWriting as OpinionWritingType } from "../../core/opinions/types";
import OpinionBlock from "./OpinionBlock";

type OpinionWritingProps = {
  writing: OpinionWritingType;
  index: number;
  opinionSourceUrl?: string;
};

const OpinionWriting: React.FC<OpinionWritingProps> = ({ writing, index, opinionSourceUrl }) => {
  const title = writing.label?.trim() || writing.author?.trim() || writing.kind?.trim() || "";

  return (
    <section className="opinion-writing" aria-labelledby={`opinion-writing-${index}`}>
      {title ? (
        <h2 id={`opinion-writing-${index}`} className="opinion-section__title">
          {title}
        </h2>
      ) : null}
      {writing.blocks?.map((block, blockIndex) => (
        <OpinionBlock
          key={`${block.type}-${blockIndex}`}
          block={block}
          opinionSourceUrl={opinionSourceUrl}
        />
      ))}
    </section>
  );
};

export default OpinionWriting;
