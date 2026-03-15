import type { CaseItem, CourtItem } from "../types";

const OPINIONS_BUCKET = "opinions.jurisware.com";

const FALLBACK_COURT_LABELS: Record<string, { short: string; long: string }> = {
  coa: { short: "CoA", long: "NY Court of Appeals" },
  scotus: { short: "SCOTUS", long: "Supreme Court of the United States" },
  ad3: { short: "AD3", long: "Appellate Division, Third Department" },
  albany: { short: "Albany", long: "Albany County" },
};

const normalizeCourtCode = (value?: string | null) => {
  return (value ?? "coa").trim().toLowerCase() || "coa";
};

const resolveOpinionObjectPath = (opinionUrl?: string | null) => {
  const source = (opinionUrl ?? "").trim();
  if (!source) return "";
  if (/^https?:\/\//i.test(source)) {
    try {
      const parsed = new URL(source);
      return parsed.pathname
        .replace(/^\/+/, "")
        .replace(/\.json$/i, "")
        .replace(/\.md$/i, "")
        .replace(/\.pdf$/i, "");
    } catch {
      return "";
    }
  }

  return source
    .replace(/^s3:\/\/opinions\.jurisware\.com\//i, "")
    .replace(/^\//, "")
    .replace(/\.json$/i, "")
    .replace(/\.md$/i, "")
    .replace(/\.pdf$/i, "");
};

const buildCanonicalOpinionObjectPath = (opinionUrl?: string | null, caseItem?: CaseItem | null) => {
  const normalized = resolveOpinionObjectPath(opinionUrl)
    .replace(/\.(json|md|pdf)$/i, "")
    .replace(/^\/+/, "");
  if (!normalized) return "";

  const court = normalizeCourtCode(caseItem?.court);
  const withoutCourtPrefix = normalized.replace(new RegExp(`^${court}/`, "i"), "");
  return `${court}/${withoutCourtPrefix}`.replace(/\/{2,}/g, "/");
};

const buildOpinionCandidateUrlsForExtensions = (
  opinionUrl?: string | null,
  caseItem?: CaseItem | null,
  extensions?: string[],
) => {
  const base =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_OPINIONS_BASE_URL
      ? String(import.meta.env.VITE_OPINIONS_BASE_URL).replace(/\/$/, "")
      : `https://${OPINIONS_BUCKET}`;
  const path = buildCanonicalOpinionObjectPath(opinionUrl, caseItem);
  if (!path || !extensions?.length) return [];
  return extensions.map((extension) => `${base}/${path}.${extension}`);
};

export const buildOpinionUrl = (opinionUrl?: string | null, caseItem?: CaseItem | null) => {
  return buildOpinionCandidateUrlsForExtensions(opinionUrl, caseItem, ["md"])[0] ?? "";
};

export const buildOpinionStorageKey = (opinionUrl?: string | null, caseItem?: CaseItem | null) => {
  const path = buildCanonicalOpinionObjectPath(opinionUrl, caseItem);
  if (!path) return "";
  return `${path}.md`;
};

export const buildOpinionCandidateUrls = (
  opinionUrl?: string | null,
  caseItem?: CaseItem | null,
) => {
  return buildOpinionCandidateUrlsForExtensions(opinionUrl, caseItem, ["md", "pdf"]);
};

export const buildOpinionDocumentCandidateUrls = (
  opinionUrl?: string | null,
  caseItem?: CaseItem | null,
) => {
  return buildOpinionCandidateUrlsForExtensions(opinionUrl, caseItem, ["json", "md", "pdf"]);
};

export const extractOpinionStorageKeyFromUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const key = parsed.pathname.replace(/^\/+/, "");
    return key || "";
  } catch {
    return "";
  }
};

export const getCourtCode = (court?: string | null) => normalizeCourtCode(court);

export const mapCourtsById = (courts: CourtItem[]) => {
  return new Map(courts.map((court) => [normalizeCourtCode(court.id), court]));
};

export const getCourtBadgeLabel = (
  court?: string | null,
  courtsById?: Map<string, CourtItem>,
) => {
  const code = normalizeCourtCode(court);
  const record = courtsById?.get(code);
  if (record?.label_short?.trim()) return record.label_short.trim();
  return FALLBACK_COURT_LABELS[code]?.short ?? code.toUpperCase();
};

export const getCourtLongLabel = (
  court?: string | null,
  courtsById?: Map<string, CourtItem>,
) => {
  const code = normalizeCourtCode(court);
  const record = courtsById?.get(code);
  if (record?.label_long?.trim()) return record.label_long.trim();
  return FALLBACK_COURT_LABELS[code]?.long ?? code.toUpperCase();
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
