import React from "react";
import type {
  OpinionBlockNode,
  OpinionInlineNode,
  OpinionWriting as OpinionWritingType,
} from "../../../core/opinions/types";
import OpinionBlock from "./OpinionBlock";

type OpinionWritingProps = {
  writing: OpinionWritingType;
  index: number;
  opinionSourceUrl?: string;
};

const flattenInlineText = (nodes?: OpinionInlineNode[] | null): string => {
  if (!nodes?.length) return "";

  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return node.text;
        case "emphasis":
        case "link":
          return flattenInlineText(node.children);
        case "footnote_reference":
          return node.label ? `[${node.label}]` : "";
        default:
          return "children" in node ? flattenInlineText(node.children) : "";
      }
    })
    .join("");
};

const flattenBlockText = (block?: OpinionBlockNode | null): string => {
  if (!block) return "";

  switch (block.type) {
    case "paragraph":
    case "subheader":
    case "metadata":
      return flattenInlineText(block.inlines);
    case "quote":
      return [
        flattenInlineText(block.inlines),
        ...(block.blocks?.map((childBlock) => flattenBlockText(childBlock)) ?? []),
      ]
        .filter(Boolean)
        .join(" ");
    default: {
      const unknownBlock = block as OpinionBlockNode & {
        inlines?: OpinionInlineNode[] | null;
        blocks?: OpinionBlockNode[] | null;
        value?: string | null;
      };
      return [
        flattenInlineText(unknownBlock.inlines),
        unknownBlock.value ?? "",
        ...(unknownBlock.blocks?.map((childBlock) => flattenBlockText(childBlock)) ?? []),
      ]
        .filter(Boolean)
        .join(" ");
    }
  }
};

const normalizeComparisonText = (value?: string | null): string => {
  return (value ?? "")
    .replace(/\{\*\*[^}]+\}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

const OpinionWriting: React.FC<OpinionWritingProps> = ({ writing, index, opinionSourceUrl }) => {
  const firstBlockText = flattenBlockText(writing.blocks?.[0]);
  const title =
    writing.label?.trim() ||
    writing.author?.trim() ||
    (writing.kind?.trim() && writing.kind.trim().toLowerCase() !== "majority"
      ? writing.kind.trim()
      : "");
  const shouldRenderTitle =
    Boolean(title) &&
    normalizeComparisonText(title) !== normalizeComparisonText(firstBlockText);

  return (
    <section className="opinion-writing" aria-labelledby={`opinion-writing-${index}`}>
      {shouldRenderTitle ? (
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
