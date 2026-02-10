import type { CaseItem } from "./types";

export const REVIEW_MARKER = "_REVIEW_";

export const buildOpinionUrl = (opinionUrl?: string) => {
  if (!opinionUrl) return "";
  if (opinionUrl.startsWith("http")) return opinionUrl;
  const trimmed = opinionUrl.replace(/^\//, "");
  let normalized = trimmed.replace(/\.txt/gi, "");
  normalized = normalized.replace(/\.md$/i, "");
  const base =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_OPINIONS_BASE_URL
      ? String(import.meta.env.VITE_OPINIONS_BASE_URL).replace(/\/$/, "")
      : "https://opinions.jurisware.com";
  return `${base}/${normalized}.md`;
};

export const normalizeDate = (value?: string | null) => value ?? "";

export const normalizeNullableField = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const formatCaseDateLabel = (
  decisionDate?: string | null,
  now: Date = new Date(),
) => {
  if (!decisionDate) return "";
  const parsed = new Date(decisionDate);
  if (Number.isNaN(parsed.valueOf())) return "";
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(now.getFullYear() - 2);
  if (parsed < twoYearsAgo) {
    return parsed.getFullYear().toString();
  }
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatCaseCitationLine = (item: CaseItem, now?: Date) => {
  const citation =
    item.ny3dCite?.trim() || item.slipOp?.trim() || item.citation?.trim() || "";
  const dateLabel = formatCaseDateLabel(item.decisionDate, now);
  if (citation && dateLabel) return `${citation} (${dateLabel})`;
  if (citation) return citation;
  if (dateLabel) return `(${dateLabel})`;
  return "";
};

export const formatCaseCaption = (item: CaseItem, now?: Date) => {
  const name = item.caseName?.trim() || "";
  const citationLine = formatCaseCitationLine(item, now);
  if (name && citationLine) return `${name}, ${citationLine}`;
  return name || citationLine;
};
