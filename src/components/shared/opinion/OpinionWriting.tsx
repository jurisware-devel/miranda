import React from "react";
import type {
  OpinionBlockNode,
  OpinionInlineNode,
  OpinionWriting as OpinionWritingType,
} from "../../../core/opinions/types";
import OpinionBlock from "./OpinionBlock";

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

const headingSuffixForKind = (kind?: string | null): string | null => {
  switch (kind?.trim().toLowerCase()) {
    case "concurrence":
      return "concurring";
    case "concurrence_in_part":
      return "concurring in part";
    case "concurrence_in_result":
      return "concurring in result";
    case "dissent":
      return "dissenting";
    case "dissent_in_part":
      return "dissenting in part";
    case "mixed":
      return null;
    default:
      return null;
  }
};

const synthesizedHeading = (writing: OpinionWritingType): string | null => {
  const author = writing.author?.trim();
  const suffix = headingSuffixForKind(writing.kind);
  if (!author || !suffix) {
    return null;
  }
  return `${author}, J. (${suffix}).`;
};

const OpinionWriting: React.FC<OpinionWritingProps> = ({
  writing,
  opinionSourceUrl,
}) => {
  const heading = synthesizedHeading(writing);
  const firstBlock = writing.blocks?.[0];
  const firstBlockText = blockText(firstBlock);
  const showHeading = Boolean(
    heading &&
      (!firstBlockText || !firstBlockText.toLowerCase().startsWith(heading.toLowerCase())),
  );

  return (
    <section className="opinion-writing">
      <div className="opinion-writing__content opinion-writing__content--inline">
        {showHeading ? (
          <p className="opinion-block opinion-block--paragraph">{heading}</p>
        ) : null}
        {(writing.blocks ?? []).map((block, blockIndex) => (
          <OpinionBlock
            key={`${block.type}-${blockIndex}`}
            block={block}
            opinionSourceUrl={opinionSourceUrl}
          />
        ))}
      </div>
    </section>
  );
};

export default OpinionWriting;
