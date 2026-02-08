export const normalizeHexColor = (hex?: string | null) => {
  if (!hex) return null;
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return null;
  return normalized.toLowerCase();
};

export const darkenHex = (hex: string, amount: number) => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return hex;
  const clamp = (value: number) => Math.max(0, Math.min(255, value));
  const adjust = (channel: number) => clamp(Math.round(channel * (1 - amount)));
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(adjust(r))}${toHex(adjust(g))}${toHex(adjust(b))}`;
};

export const getReadableTextColor = (hex?: string | null, fallback?: string) => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return fallback;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.7 ? "#0f172a" : "#ffffff";
};
