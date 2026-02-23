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

const resolveOpinionObjectPath = (opinionUrl?: string | null) => {
  const source = (opinionUrl ?? "").trim();
  if (!source) return "";
  if (/^https?:\/\//i.test(source)) {
    try {
      const parsed = new URL(source);
      return parsed.pathname
        .replace(/^\/+/, "")
        .replace(/\.txt$/i, "")
        .replace(/\.md$/i, "")
        .replace(/\.pdf$/i, "");
    } catch {
      return "";
    }
  }

  return source
    .replace(/^s3:\/\/opinions\.jurisware\.com\//i, "")
    .replace(/^\//, "")
    .replace(/\.txt$/i, "")
    .replace(/\.md$/i, "")
    .replace(/\.pdf$/i, "");
};

export const buildOpinionUrl = (opinionUrl?: string | null, _caseItem?: CaseItem | null) => {
  const source = (opinionUrl ?? "").trim();
  if (!source) return "";
  if (/^https?:\/\//i.test(source)) return source;

  const sourceExtension = source.match(/\.(md|pdf|txt)$/i)?.[1]?.toLowerCase() ?? "";
  const normalized = resolveOpinionObjectPath(source);
  if (!normalized) return "";

  const base =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_OPINIONS_BASE_URL
      ? String(import.meta.env.VITE_OPINIONS_BASE_URL).replace(/\/$/, "")
      : `https://${OPINIONS_BUCKET}`;
  if (sourceExtension === "pdf") return `${base}/${normalized}.pdf`;
  if (sourceExtension === "md" || sourceExtension === "txt") return `${base}/${normalized}.md`;
  return `${base}/${normalized}`;
};

export const buildOpinionStorageKey = (opinionUrl?: string | null, _caseItem?: CaseItem | null) => {
  const source = (opinionUrl ?? "").trim();
  if (!source) return "";
  const sourceExtension = source.match(/\.(md|pdf|txt)(?:$|[?#])/i)?.[1]?.toLowerCase() ?? "";
  const normalized = resolveOpinionObjectPath(source);
  if (!normalized) return "";
  const withoutExtension = normalized.replace(/\.(md|pdf|txt)$/i, "");
  if (sourceExtension === "pdf") return `${withoutExtension}.pdf`;
  return `${withoutExtension}.md`;
};

export const buildOpinionCandidateUrls = (
  opinionUrl?: string | null,
  caseItem?: CaseItem | null,
) => {
  const source = (opinionUrl ?? "").trim();
  if (!source) return [];
  const explicitHttpUrl = /^https?:\/\//i.test(source) ? source : "";
  if (explicitHttpUrl && !/opinions\.jurisware\.com/i.test(source)) return [explicitHttpUrl];

  const sourceExtension = source.match(/\.(md|pdf|txt)$/i)?.[1]?.toLowerCase() ?? "";
  const normalized = resolveOpinionObjectPath(source);
  if (!normalized) return [];
  const base =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_OPINIONS_BASE_URL
      ? String(import.meta.env.VITE_OPINIONS_BASE_URL).replace(/\/$/, "")
      : `https://${OPINIONS_BUCKET}`;
  const path = normalized.replace(/\.(md|pdf|txt)$/i, "").replace(/^\/+/, "");
  const hasTextsPrefix = /^texts\//i.test(path);
  const withoutTexts = path.replace(/^texts\//i, "");
  const segments = withoutTexts.split("/").filter(Boolean);
  const year = getOpinionYear(caseItem);
  const derivedPaths = new Set<string>([path, withoutTexts]);

  if (!hasTextsPrefix) derivedPaths.add(`texts/${withoutTexts}`);

  if (segments.length === 2 && /^\d{4}[_-]/.test(segments[1])) {
    derivedPaths.add(`${segments[0]}/${segments[1].slice(0, 4)}/${segments[1]}`);
    derivedPaths.add(`texts/${segments[0]}/${segments[1].slice(0, 4)}/${segments[1]}`);
  }

  if (segments.length >= 3 && /^\d{4}$/.test(segments[1])) {
    const flat = `${segments[0]}/${segments.slice(2).join("/")}`;
    derivedPaths.add(flat);
    derivedPaths.add(`texts/${flat}`);
  }

  // Legacy shape like "2026/2026_00963" (year + filename, no court prefix).
  // Derive court-prefixed candidates from case metadata.
  if (segments.length === 2 && /^\d{4}$/.test(segments[0])) {
    const court = normalizeCourtCode(caseItem?.court);
    derivedPaths.add(`${court}/${segments[0]}/${segments[1]}`);
    derivedPaths.add(`${court}/${segments[1]}`);
    derivedPaths.add(`texts/${court}/${segments[0]}/${segments[1]}`);
    derivedPaths.add(`texts/${court}/${segments[1]}`);
  }

  if (segments.length === 1 && year) {
    const court = normalizeCourtCode(caseItem?.court);
    derivedPaths.add(`${court}/${year}/${segments[0]}`);
    derivedPaths.add(`${court}/${segments[0]}`);
    derivedPaths.add(`texts/${court}/${year}/${segments[0]}`);
    derivedPaths.add(`texts/${court}/${segments[0]}`);
  }

  const paths = Array.from(derivedPaths).filter(Boolean);

  const urls =
    sourceExtension === "pdf"
      ? paths.map((candidatePath) => `${base}/${candidatePath}.pdf`)
      : sourceExtension === "md" || sourceExtension === "txt"
        ? paths.flatMap((candidatePath) => [
            `${base}/${candidatePath}.md`,
            `${base}/${candidatePath}.txt`,
          ])
        : paths.flatMap((candidatePath) => [
            `${base}/${candidatePath}.md`,
            `${base}/${candidatePath}.txt`,
            `${base}/${candidatePath}.pdf`,
            `${base}/${candidatePath}`,
          ]);

  return Array.from(new Set(explicitHttpUrl ? [explicitHttpUrl, ...urls] : urls));
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
