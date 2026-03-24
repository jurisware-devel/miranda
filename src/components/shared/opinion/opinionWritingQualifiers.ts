const normalizeHeadingText = (text?: string | null): string => {
  return (text ?? "")
    .replace(/\{\*\*[^}]+\}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.:]+$/, "")
    .toLowerCase();
};

export const isRecognizedWritingQualifier = (text?: string | null): boolean => {
  const normalized = normalizeHeadingText(text);
  if (!normalized) return false;
  if (
    normalized === "opinion of the court" ||
    normalized.startsWith("opinion of the court by ") ||
    normalized === "per curiam" ||
    normalized === "memorandum" ||
    normalized === "concurring" ||
    normalized === "dissenting"
  ) {
    return true;
  }
  if (/^memorandum \((?:concurring|dissenting)(?: in part| in result)?\)$/.test(normalized)) {
    return true;
  }
  if (/^(?:chief judge .+|.+, j)$/.test(normalized)) {
    return true;
  }
  return /^(?:chief judge .+|.+, j)\.?(?::)? \((?:concurring|dissenting)(?: in part| in result| in .+)?\)$/.test(normalized);
};
