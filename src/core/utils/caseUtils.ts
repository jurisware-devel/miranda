import type { CaseItem } from "../types";

const OPINIONS_BUCKET = "opinions.jurisware.com";

const normalizeCourtCode = (value?: string | null) => {
  return (value ?? "coa").trim().toLowerCase() || "coa";
};

const getOpinionYear = (caseItem?: CaseItem | null) => {
  const fromDecisionDate = caseItem?.decisionDate?.slice(0, 4);
  if (fromDecisionDate && /^\d{4}$/.test(fromDecisionDate)) return fromDecisionDate;
  const fromCaseId = caseItem?.caseId?.match(/^(\d{4})[_-]/)?.[1];
  if (fromCaseId) return fromCaseId;
  return "";
};

export const buildOpinionUrl = (opinionUrl?: string | null, caseItem?: CaseItem | null) => {
  const source = (opinionUrl ?? "").trim();
  if (!source) return "";
  if (/^https?:\/\//i.test(source)) return source;

  const sourceExtension = source.match(/\.(md|pdf|txt)$/i)?.[1]?.toLowerCase() ?? "";
  const sanitized = source
    .replace(/^s3:\/\/opinions\.jurisware\.com\//i, "")
    .replace(/^\//, "")
    .replace(/\.txt$/i, "")
    .replace(/\.md$/i, "")
    .replace(/\.pdf$/i, "");
  const court = normalizeCourtCode(caseItem?.court);
  const withoutCourtPrefix = sanitized.replace(new RegExp(`^${court}/`, "i"), "");
  const parts = withoutCourtPrefix.split("/").filter(Boolean);
  const year = getOpinionYear(caseItem);
  const name = parts.length ? parts[parts.length - 1] : "";
  const opinionPath =
    parts.length >= 2
      ? withoutCourtPrefix
      : year && name
        ? `${year}/${name}`
        : withoutCourtPrefix;
  const normalized = `${court}/${opinionPath}`;

  const base =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_OPINIONS_BASE_URL
      ? String(import.meta.env.VITE_OPINIONS_BASE_URL).replace(/\/$/, "")
      : `https://${OPINIONS_BUCKET}`;
  if (sourceExtension === "pdf") return `${base}/${normalized}.pdf`;
  if (sourceExtension === "md" || sourceExtension === "txt") return `${base}/${normalized}.md`;
  return `${base}/${normalized}`;
};

export const getCourtCode = (court?: string | null) => normalizeCourtCode(court);

export const getCourtBadgeLabel = (court?: string | null) => {
  const code = normalizeCourtCode(court);
  const known: Record<string, string> = {
    coa: "CoA",
    scotus: "SCOTUS",
    ad3d: "AD3d",
    albany: "Albany",
  };
  return known[code] ?? code.toUpperCase();
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
