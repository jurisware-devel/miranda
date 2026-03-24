import React from "react";
import type {
  OpinionBlockNode,
  OpinionInlineNode,
  OpinionWriting as OpinionWritingType,
} from "../../../core/opinions/types";
import OpinionBlock from "./OpinionBlock";
import { isRecognizedWritingQualifier } from "./opinionWritingQualifiers";

type OpinionWritingProps = {
  writing: OpinionWritingType;
  opinionSourceUrl?: string;
};

const inlineText = (nodes?: OpinionInlineNode[] | null): string => {
  return (nodes ?? [])
    .map((node) => {
      if (node.type === "text" || node.type === "page_marker") {
        return node.text ?? "";
      }
      if ("children" in node) {
        return inlineText(node.children);
      }
      return "";
    })
    .join("");
};

const blockText = (block?: OpinionBlockNode | null): string => {
  if (!block) return "";
  if ("inlines" in block) {
    return inlineText(block.inlines).trim();
  }
  return "";
};

const OpinionWriting: React.FC<OpinionWritingProps> = ({
  writing,
  opinionSourceUrl,
}) => {
  const blocks = writing.blocks ?? [];

  return (
    <section className="opinion-writing">
      <div className="opinion-writing__content opinion-writing__content--inline">
        {blocks.map((block, blockIndex) => (
          <React.Fragment key={`${block.type}-${blockIndex}`}>
            <OpinionBlock
              block={block}
              opinionSourceUrl={opinionSourceUrl}
              className={isRecognizedWritingQualifier(blockText(block)) ? "opinion-block--qualifier" : undefined}
            />
          </React.Fragment>
        ))}
      </div>
    </section>
  );
};

export default OpinionWriting;
