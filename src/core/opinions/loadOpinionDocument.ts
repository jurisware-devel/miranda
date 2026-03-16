import type { CaseItem } from "../types";
import {
  buildLocalOpinionDocumentCandidatePaths,
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
      kind: "pdf";
      pdfUrl: string;
    };

const LOCAL_OPINIONS_ROOT_PATH = new URL("../../../opinions/", import.meta.url).pathname;

const isOpinionDocument = (value: unknown): value is OpinionDocument => {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

  const isMarkdown =
    /\.md($|\?)/i.test(url) || contentType.includes("text/markdown") || contentType.includes("text/plain");
  if (isMarkdown) {
    return {
      kind: "markdown",
      markdown: await response.text(),
      sourceUrl: url,
    };
  }

  const payload = (await response.json()) as unknown;
  if (!isOpinionDocument(payload)) {
    throw new Error("invalid-json");
  }

  return { kind: "document", document: payload, sourceUrl: url };
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
