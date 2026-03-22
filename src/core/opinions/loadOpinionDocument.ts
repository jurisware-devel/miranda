import type { CaseItem } from "../types";
import {
  buildLocalOpinionJsonCandidatePaths,
  buildLocalOpinionPdfCandidatePaths,
  buildLocalOpinionDocumentCandidatePaths,
  buildOpinionJsonCandidateUrls,
  buildOpinionPdfCandidateUrls,
  buildOpinionDocumentCandidateUrls,
} from "../utils/caseUtils";
import type { OpinionDocument } from "./types";

type OpinionDocumentResult =
  | {
      kind: "document";
      document: OpinionDocument;
      sourceUrl: string;
    }
  | {
      kind: "markdown";
      markdown: string;
      sourceUrl: string;
    }
  | {
      kind: "text";
      text: string;
      sourceUrl: string;
    }
  | {
      kind: "pdf";
      pdfUrl: string;
    };

const LOCAL_OPINIONS_ROOT_PATH = new URL(
  /* @vite-ignore */ "../../../opinions/",
  import.meta.url,
).pathname;

const isOpinionDocument = (value: unknown): value is OpinionDocument => {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
};

const normalizeOpinionDocument = (document: OpinionDocument): OpinionDocument => {
  const headerAppearances = document.header?.appearances;
  const topLevelAppearances = document.appearances;
  const topLevelFallback = document.fallback;
  const legacySourceFallback =
    (document.source as { fallback?: OpinionDocument["fallback"] } | null | undefined)?.fallback ?? null;

  return {
    ...document,
    header: {
      ...(document.header ?? {}),
      appearances: Array.isArray(headerAppearances) ? headerAppearances : topLevelAppearances ?? null,
    },
    fallback: topLevelFallback ?? legacySourceFallback ?? null,
  };
};

const fetchOpinionDocumentFromUrl = async (url: string): Promise<OpinionDocumentResult> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(String(response.status));
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const isPdf = /\.pdf($|\?)/i.test(url) || contentType.includes("application/pdf");
  if (isPdf) {
    return { kind: "pdf", pdfUrl: url };
  }

  const isMarkdown = /\.md($|\?)/i.test(url) || contentType.includes("text/markdown");
  if (isMarkdown) {
    return {
      kind: "markdown",
      markdown: await response.text(),
      sourceUrl: url,
    };
  }

  const isText = /\.txt($|\?)/i.test(url) || contentType.includes("text/plain");
  if (isText) {
    return {
      kind: "text",
      text: await response.text(),
      sourceUrl: url,
    };
  }

  const payload = (await response.json()) as unknown;
  if (!isOpinionDocument(payload)) {
    throw new Error("invalid-json");
  }

  return { kind: "document", document: normalizeOpinionDocument(payload), sourceUrl: url };
};

const fetchOpinionJsonFromUrl = async (
  url: string,
): Promise<{ document: OpinionDocument; sourceUrl: string }> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(String(response.status));
  }

  const payload = (await response.json()) as unknown;
  if (!isOpinionDocument(payload)) {
    throw new Error("invalid-json");
  }

  return { document: normalizeOpinionDocument(payload), sourceUrl: url };
};

const fetchOpinionPdfFromUrl = async (url: string): Promise<string> => {
  const response = await fetch(url, { method: "HEAD" });
  if (!response.ok) {
    throw new Error(String(response.status));
  }
  return url;
};

const buildLocalCorpusUrl = (relativePath: string) => {
  const normalizedRoot = LOCAL_OPINIONS_ROOT_PATH.endsWith("/")
    ? LOCAL_OPINIONS_ROOT_PATH
    : `${LOCAL_OPINIONS_ROOT_PATH}/`;
  return `/@fs${normalizedRoot}${relativePath.replace(/^\/+/, "")}`;
};

const loadLocalCorpusDocument = async (
  opinionUrl?: string | null,
  caseItem?: CaseItem | null,
): Promise<OpinionDocumentResult | null> => {
  if (!import.meta.env.DEV) return null;

  const candidatePaths = buildLocalOpinionDocumentCandidatePaths(opinionUrl, caseItem);
  for (const candidatePath of candidatePaths) {
    try {
      return await fetchOpinionDocumentFromUrl(buildLocalCorpusUrl(candidatePath));
    } catch {
      continue;
    }
  }

  return null;
};

const loadLocalCorpusJsonDocument = async (
  opinionUrl?: string | null,
  caseItem?: CaseItem | null,
): Promise<{ document: OpinionDocument; sourceUrl: string } | null> => {
  if (!import.meta.env.DEV) return null;

  const candidatePaths = buildLocalOpinionJsonCandidatePaths(opinionUrl, caseItem);
  for (const candidatePath of candidatePaths) {
    try {
      return await fetchOpinionJsonFromUrl(buildLocalCorpusUrl(candidatePath));
    } catch {
      continue;
    }
  }

  return null;
};

const loadLocalCorpusPdfUrl = async (
  opinionUrl?: string | null,
  caseItem?: CaseItem | null,
): Promise<string | null> => {
  if (!import.meta.env.DEV) return null;

  const candidatePaths = buildLocalOpinionPdfCandidatePaths(opinionUrl, caseItem);
  for (const candidatePath of candidatePaths) {
    try {
      return await fetchOpinionPdfFromUrl(buildLocalCorpusUrl(candidatePath));
    } catch {
      continue;
    }
  }

  return null;
};

export const loadOpinionJsonDocument = async (
  caseItem?: CaseItem | null,
): Promise<{ document: OpinionDocument; sourceUrl: string }> => {
  const localCorpusResult = await loadLocalCorpusJsonDocument(caseItem?.opinionUrl, caseItem);
  if (localCorpusResult) return localCorpusResult;

  const candidateUrls = buildOpinionJsonCandidateUrls(caseItem?.opinionUrl, caseItem);
  let lastError = "";

  for (const candidateUrl of candidateUrls) {
    try {
      return await fetchOpinionJsonFromUrl(candidateUrl);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  if (!candidateUrls.length) {
    throw new Error("No Miranda JSON URL is available for this case.");
  }

  throw new Error(`Failed to load Miranda JSON${lastError ? ` (${lastError})` : ""}`);
};

export const loadOpinionPdfUrl = async (caseItem?: CaseItem | null): Promise<string> => {
  const localCorpusResult = await loadLocalCorpusPdfUrl(caseItem?.opinionUrl, caseItem);
  if (localCorpusResult) return localCorpusResult;

  const candidateUrls = buildOpinionPdfCandidateUrls(caseItem?.opinionUrl, caseItem);
  let lastError = "";

  for (const candidateUrl of candidateUrls) {
    try {
      return await fetchOpinionPdfFromUrl(candidateUrl);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  if (!candidateUrls.length) {
    throw new Error("No opinion PDF URL is available for this case.");
  }

  throw new Error(`Failed to load opinion PDF${lastError ? ` (${lastError})` : ""}`);
};

export const loadOpinionDocument = async (
  _caseId: string,
  caseItem?: CaseItem | null,
): Promise<OpinionDocumentResult> => {
  const localCorpusResult = await loadLocalCorpusDocument(caseItem?.opinionUrl, caseItem);
  if (localCorpusResult) return localCorpusResult;

  const candidateUrls = buildOpinionDocumentCandidateUrls(caseItem?.opinionUrl, caseItem);
  let lastError = "";

  for (const candidateUrl of candidateUrls) {
    try {
      return await fetchOpinionDocumentFromUrl(candidateUrl);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  if (!candidateUrls.length) {
    throw new Error("No opinion document URL is available for this case.");
  }

  throw new Error(`Failed to load opinion document${lastError ? ` (${lastError})` : ""}`);
};

export type { OpinionDocumentResult };
