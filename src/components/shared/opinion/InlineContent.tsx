import React from "react";
import type { OpinionInlineNode } from "../../../core/opinions/types";

type InlineContentProps = {
  nodes?: OpinionInlineNode[] | null;
  opinionSourceUrl?: string;
};

const resolveOpinionHref = (href?: string | null, opinionSourceUrl?: string) => {
  if (!href) return "";
  if (/^(#|https?:\/\/|mailto:)/i.test(href)) return href;
  if (!opinionSourceUrl) return href;

  try {
    return new URL(href, opinionSourceUrl).toString();
  } catch {
    return href;
  }
};

const renderFootnoteLabel = (node: OpinionInlineNode) => {
  if (node.type !== "footnote_reference") return null;
  if (node.children?.length) {
    return <InlineContent nodes={node.children} />;
  }
  return node.label ? `[${node.label}]` : "[*]";
};

const hasInlineChildren = (
  node: OpinionInlineNode,
): node is Extract<OpinionInlineNode, { children?: OpinionInlineNode[] | null }> => {
  return "children" in node;
};

const hasInlineText = (node: OpinionInlineNode): node is Extract<OpinionInlineNode, { text?: string | null }> => {
  return "text" in node;
};

const InlineContent: React.FC<InlineContentProps> = ({ nodes, opinionSourceUrl }) => {
  if (!nodes?.length) return null;

  return (
    <>
      {nodes.map((node, index) => {
        const key = `${node.type}-${index}`;

        switch (node.type) {
          case "text":
            return <React.Fragment key={key}>{node.text}</React.Fragment>;
          case "emphasis":
            return (
              <em key={key}>
                <InlineContent nodes={node.children} opinionSourceUrl={opinionSourceUrl} />
              </em>
            );
          case "link": {
            const href = resolveOpinionHref(node.href, opinionSourceUrl);
            if (!href) {
              return (
                <React.Fragment key={key}>
                  <InlineContent nodes={node.children} opinionSourceUrl={opinionSourceUrl} />
                </React.Fragment>
              );
            }

            return (
              <a key={key} href={href} target="_blank" rel="noreferrer">
                <InlineContent nodes={node.children} opinionSourceUrl={opinionSourceUrl} />
              </a>
            );
          }
          case "footnote_reference": {
            const label = node.label?.trim() || String(index + 1);
            const targetId = node.target?.trim() || `opinion-footnote-${label}`;
            return (
              <sup key={key} className="opinion-inline__footnote-ref">
                <a href={`#${targetId}`}>{renderFootnoteLabel(node)}</a>
              </sup>
            );
          }
          default:
            if (hasInlineChildren(node) && node.children?.length) {
              return (
                <React.Fragment key={key}>
                  <InlineContent nodes={node.children} opinionSourceUrl={opinionSourceUrl} />
                </React.Fragment>
              );
            }
            return <React.Fragment key={key}>{hasInlineText(node) ? node.text ?? "" : ""}</React.Fragment>;
        }
      })}
    </>
  );
};

export default InlineContent;
