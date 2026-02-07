export const REVIEW_MARKER = "_REVIEW_";

export const buildOpinionUrl = (opinionUrl?: string) => {
  if (!opinionUrl) return "";
  if (opinionUrl.startsWith("http")) return opinionUrl;
  const trimmed = opinionUrl.replace(/^\//, "");
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://miranda.jurisware.com";
  return `${origin}/texts/${trimmed}`;
};

export const normalizeDate = (value?: string | null) => value ?? "";

export const normalizeNullableField = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};
