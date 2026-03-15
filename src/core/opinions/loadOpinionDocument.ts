import type { CaseItem } from "../types";
import { buildOpinionDocumentCandidateUrls } from "../utils/caseUtils";
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

const SAMPLE_DOCUMENT_URLS: Record<string, string> = {
  "2026_00963": new URL("../../../samples/2026_00963.json", import.meta.url).href,
  "2008_09854": new URL("../../../samples/2008_09854.json", import.meta.url).href,
};

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

const loadLocalSampleDocument = async (caseId?: string | null): Promise<OpinionDocumentResult | null> => {
  if (!import.meta.env.DEV || !caseId) return null;
  const sampleUrl = SAMPLE_DOCUMENT_URLS[caseId];
  if (!sampleUrl) return null;

  try {
    return await fetchOpinionDocumentFromUrl(sampleUrl);
  } catch {
    return null;
  }
};

export const loadOpinionDocument = async (
  caseId: string,
  caseItem?: CaseItem | null,
): Promise<OpinionDocumentResult> => {
  const candidateUrls = buildOpinionDocumentCandidateUrls(caseItem?.opinionUrl, caseItem);
  let lastError = "";

  for (const candidateUrl of candidateUrls) {
    try {
      return await fetchOpinionDocumentFromUrl(candidateUrl);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  const sampleResult = await loadLocalSampleDocument(caseId);
  if (sampleResult) return sampleResult;

  if (!candidateUrls.length) {
    throw new Error("No opinion document URL is available for this case.");
  }

  throw new Error(`Failed to load opinion document${lastError ? ` (${lastError})` : ""}`);
};

export type { OpinionDocumentResult };
