import React from "react";
import type { OpinionBlockNode, OpinionUnknownBlock } from "../../../core/opinions/types";
import InlineContent from "./InlineContent";

type OpinionBlockProps = {
  block: OpinionBlockNode;
  opinionSourceUrl?: string;
  className?: string;
};

const OpinionBlock: React.FC<OpinionBlockProps> = ({ block, opinionSourceUrl, className }) => {
  const blockClassName = ["opinion-block", className].filter(Boolean).join(" ");
  switch (block.type) {
    case "paragraph":
      return (
        <p className={`${blockClassName} opinion-block--paragraph`}>
          <InlineContent nodes={block.inlines} opinionSourceUrl={opinionSourceUrl} />
        </p>
      );
    case "subheader":
      return (
        <h3 className={`${blockClassName} opinion-block--subheader`}>
          <InlineContent nodes={block.inlines} opinionSourceUrl={opinionSourceUrl} />
        </h3>
      );
    case "metadata":
      return (
        <p className={`${blockClassName} opinion-block--metadata`}>
          {block.label ? <span className="opinion-block__metadata-label">{block.label}</span> : null}
          {block.value ? <span>{block.value}</span> : null}
          {!block.value ? (
            <InlineContent nodes={block.inlines} opinionSourceUrl={opinionSourceUrl} />
          ) : null}
        </p>
      );
    case "quote":
      return (
        <blockquote className={`${blockClassName} opinion-block--quote`}>
          {block.inlines?.length ? (
            <p>
              <InlineContent nodes={block.inlines} opinionSourceUrl={opinionSourceUrl} />
            </p>
          ) : null}
          {block.blocks?.map((childBlock, index) => (
            <OpinionBlock
              key={`${childBlock.type}-${index}`}
              block={childBlock}
              opinionSourceUrl={opinionSourceUrl}
            />
          ))}
        </blockquote>
      );
    default: {
      const unknownBlock = block as OpinionUnknownBlock;
      return (
        <div className={`${blockClassName} opinion-block--unknown`} data-block-type={unknownBlock.type}>
          {unknownBlock.label ? <p className="opinion-block__unknown-label">{unknownBlock.label}</p> : null}
          {unknownBlock.inlines?.length ? (
            <p>
              <InlineContent nodes={unknownBlock.inlines} opinionSourceUrl={opinionSourceUrl} />
            </p>
          ) : null}
          {unknownBlock.value ? <p>{unknownBlock.value}</p> : null}
          {unknownBlock.blocks?.map((childBlock: OpinionBlockNode, index: number) => (
            <OpinionBlock
              key={`${childBlock.type}-${index}`}
              block={childBlock}
              opinionSourceUrl={opinionSourceUrl}
            />
          ))}
        </div>
      );
    }
  }
};

export default OpinionBlock;
