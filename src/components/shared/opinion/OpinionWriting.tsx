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

const normalizeHeadingText = (text?: string | null): string => {
  return (text ?? "")
    .replace(/\{\*\*[^}]+\}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "")
    .toLowerCase();
};

const formatAuthorLine = (author?: string | null): string => {
  const normalized = (author ?? "").trim();
  if (!normalized || normalized.toLowerCase() === "per curiam") return "";
  if (/,/.test(normalized)) return normalized;
  return `${normalized}, J.`;
};

const OpinionWriting: React.FC<OpinionWritingProps> = ({
  writing,
  opinionSourceUrl,
}) => {
  const blocks = writing.blocks ?? [];
  const firstBlock = blocks[0];
  const secondBlock = blocks[1];
  const firstBlockText = blockText(firstBlock);
  const secondBlockText = blockText(secondBlock);
  const authorLine = formatAuthorLine(writing.author);
  const showInlineAuthorLine = Boolean(
    authorLine &&
      isRecognizedWritingQualifier(firstBlockText) &&
      !normalizeHeadingText(firstBlockText).includes(normalizeHeadingText(authorLine)) &&
      !normalizeHeadingText(secondBlockText).startsWith(normalizeHeadingText(authorLine)),
  );

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
            {blockIndex === 0 && showInlineAuthorLine ? (
              <p className="opinion-block opinion-block--paragraph opinion-block--qualifier">
                {authorLine}
              </p>
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
};

export default OpinionWriting;
