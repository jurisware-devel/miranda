import React from "react";
import { buildCanonicalCasePath, isValidCanonicalCaseId } from "../../../core/routing/canonicalCaseRouting";
import type { OpinionInlineNode } from "../../../core/opinions/types";

type InlineContentProps = {
  nodes?: OpinionInlineNode[] | null;
  opinionSourceUrl?: string;
};

export const extractCaseIdFromOpinionHref = (href: string) => {
  const trimmed = href.trim();
  if (!trimmed) return "";

  const withoutQueryOrHash = trimmed.replace(/[?#].*$/, "");
  const basename = withoutQueryOrHash.split("/").pop() ?? "";
  if (!/\.html?$/i.test(basename)) return "";
  const caseId = basename.replace(/\.html?$/i, "");
  return isValidCanonicalCaseId(caseId) ? caseId : "";
};

export const resolveOpinionHref = (href?: string | null, opinionSourceUrl?: string, pathname?: string) => {
  if (!href) return "";
  if (/^(#|https?:\/\/|mailto:)/i.test(href)) return href;

  const directCaseId = extractCaseIdFromOpinionHref(href);
  if (directCaseId) {
    return buildCanonicalCasePath(directCaseId);
  }

  if (!opinionSourceUrl) return href;

  try {
    const resolvedUrl = new URL(href, opinionSourceUrl);
    const resolvedCaseId = extractCaseIdFromOpinionHref(resolvedUrl.pathname);
    if (resolvedCaseId) {
      return buildCanonicalCasePath(resolvedCaseId);
    }
    return resolvedUrl.toString();
  } catch {
    return href;
  }
};

const isMirandaCaseHref = (href: string) => /^\/(?:case|admin\/case|sub\/case|pub\/case)\//.test(href);

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

const pageMarkerPageText = (node: Extract<OpinionInlineNode, { type: "page_marker" }>) => {
  const citation = node.citation?.trim();
  const citationMatch = citation?.match(/\bat\s+(\d+)\s*$/i);
  if (citationMatch) return citationMatch[1];

  const rawText = node.text?.trim();
  const rawMatch = rawText?.match(/\bat\s+(\d+)\s*\}$/i);
  if (rawMatch) return rawMatch[1];

  return rawText ?? citation ?? "";
};

const InlineContent: React.FC<InlineContentProps> = ({ nodes, opinionSourceUrl }) => {
  if (!nodes?.length) return null;
  const currentPathname =
    typeof window !== "undefined" && window.location?.pathname ? window.location.pathname : "/";

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
            const href = resolveOpinionHref(node.href, opinionSourceUrl, currentPathname);
            if (!href) {
              return (
                <React.Fragment key={key}>
                  <InlineContent nodes={node.children} opinionSourceUrl={opinionSourceUrl} />
                </React.Fragment>
              );
            }

            if (isMirandaCaseHref(href)) {
              return (
                <a key={key} href={href}>
                  <InlineContent nodes={node.children} opinionSourceUrl={opinionSourceUrl} />
                </a>
              );
            }

            return (
              <a key={key} href={href} target="_blank" rel="noreferrer">
                <InlineContent nodes={node.children} opinionSourceUrl={opinionSourceUrl} />
              </a>
            );
          }
          case "footnote_reference": {
            const label = node.label?.trim() || "?";
            const targetId = node.target?.trim() || `opinion-footnote-${label}`;
            return (
              <sup key={key} className="opinion-inline__footnote-ref">
                <a href={`#${targetId}`}>{renderFootnoteLabel(node)}</a>
              </sup>
            );
          }
          case "page_marker": {
            const pageMarkerNode = node as Extract<OpinionInlineNode, { type: "page_marker" }>;
            const markerText = pageMarkerNode.text?.trim() || pageMarkerNode.citation?.trim() || "";
            const pageText = pageMarkerPageText(pageMarkerNode);
            return (
              <span
                key={key}
                className="opinion-inline__page-marker"
                title={markerText}
                aria-label={markerText}
              >
                {pageText}
              </span>
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
