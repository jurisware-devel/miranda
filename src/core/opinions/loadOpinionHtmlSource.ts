import type { CaseItem } from "../types";
import {
  buildLocalOpinionHtmlCandidatePaths,
  buildOpinionHtmlCandidateUrls,
} from "../utils/caseUtils";

const LOCAL_OPINIONS_ROOT_PATH = new URL(
  /* @vite-ignore */ "../../../opinions/",
  import.meta.url,
).pathname;

const buildLocalCorpusUrl = (relativePath: string) => {
  const normalizedRoot = LOCAL_OPINIONS_ROOT_PATH.endsWith("/")
    ? LOCAL_OPINIONS_ROOT_PATH
    : `${LOCAL_OPINIONS_ROOT_PATH}/`;
  return `/@fs${normalizedRoot}${relativePath.replace(/^\/+/, "")}`;
};

const fetchHtmlFromUrl = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(String(response.status));
  }

  return {
    html: await response.text(),
    sourceUrl: url,
  };
};

export const loadOpinionHtmlSource = async (
  caseItem?: CaseItem | null,
): Promise<{ html: string; sourceUrl: string }> => {
  if (import.meta.env.DEV) {
    const localPaths = buildLocalOpinionHtmlCandidatePaths(caseItem?.opinionUrl, caseItem);
    for (const localPath of localPaths) {
      try {
        return await fetchHtmlFromUrl(buildLocalCorpusUrl(localPath));
      } catch {
        continue;
      }
    }
  }

  const candidateUrls = buildOpinionHtmlCandidateUrls(caseItem?.opinionUrl, caseItem);
  let lastError = "";

  for (const candidateUrl of candidateUrls) {
    try {
      return await fetchHtmlFromUrl(candidateUrl);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  if (!candidateUrls.length) {
    throw new Error("No opinion HTML URL is available for this case.");
  }

  throw new Error(`Failed to load opinion HTML${lastError ? ` (${lastError})` : ""}`);
};
