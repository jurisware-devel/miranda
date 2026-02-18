import type { CaseItem } from "./types";

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

  const sanitized = source
    .replace(/^s3:\/\/opinions\.jurisware\.com\//i, "")
    .replace(/^\//, "")
    .replace(/\.txt$/i, "")
    .replace(/\.md$/i, "");

  const parts = sanitized.split("/").filter(Boolean);
  let normalized = "";

  if (parts.length >= 3) {
    normalized = `${parts[0]}/${parts[1]}/${parts.slice(2).join("/")}`;
  } else {
    const court = normalizeCourtCode(caseItem?.court);
    const year = getOpinionYear(caseItem);
    const name = parts.length ? parts[parts.length - 1] : "";
    if (year && name) {
      normalized = `${court}/${year}/${name}`;
    } else {
      normalized = sanitized;
    }
  }

  const base =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_OPINIONS_BASE_URL
      ? String(import.meta.env.VITE_OPINIONS_BASE_URL).replace(/\/$/, "")
      : `https://${OPINIONS_BUCKET}`;
  return `${base}/${normalized}.md`;
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
