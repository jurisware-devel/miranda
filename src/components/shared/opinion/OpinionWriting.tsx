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

const normalizeHeadingText = (text?: string | null): string => {
  return (text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "")
    .toLowerCase();
};

const isRecognizedWritingQualifier = (text?: string | null): boolean => {
  const normalized = normalizeHeadingText(text);
  if (!normalized) return false;
  if (
    normalized === "opinion of the court" ||
    normalized.startsWith("opinion of the court by ") ||
    normalized === "per curiam" ||
    normalized === "memorandum" ||
    normalized === "concurring" ||
    normalized === "dissenting"
  ) {
    return true;
  }
  if (/^memorandum \((?:concurring|dissenting)(?: in part| in result)?\)$/.test(normalized)) {
    return true;
  }
  return /^(?:chief judge .+|.+, j)\. \((?:concurring|dissenting)(?: in part| in result| in .+)?\)$/.test(normalized);
};

const isEffectiveWritingKind = (kind?: string | null): boolean => {
  switch (kind?.trim().toLowerCase()) {
    case "majority":
    case "plurality":
    case "opinion_of_the_court":
      return true;
    default:
      return false;
  }
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
    case "plurality":
      return "plurality";
    case "mixed":
      return null;
    default:
      return null;
  }
};

const synthesizedHeading = (writing: OpinionWritingType): string | null => {
  const author = writing.author?.trim();
  if (isEffectiveWritingKind(writing.kind)) {
    if (!author || author.toLowerCase() === "per curiam") {
      return "Opinion of the Court";
    }
    return `Opinion of the Court by ${author}, J.`;
  }
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
          <p
            className={[
              "opinion-block",
              "opinion-block--paragraph",
              isRecognizedWritingQualifier(heading) ? "opinion-block--qualifier" : "",
            ].filter(Boolean).join(" ")}
          >
            {heading}
          </p>
        ) : null}
        {(writing.blocks ?? []).map((block, blockIndex) => (
          <OpinionBlock
            key={`${block.type}-${blockIndex}`}
            block={block}
            opinionSourceUrl={opinionSourceUrl}
            className={isRecognizedWritingQualifier(blockText(block)) ? "opinion-block--qualifier" : undefined}
          />
        ))}
      </div>
    </section>
  );
};

export default OpinionWriting;
