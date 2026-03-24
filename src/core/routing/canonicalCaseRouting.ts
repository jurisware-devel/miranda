import type { AppRole } from "../types";

const CASE_ID_SAFE_PATTERN = /^(?=.{1,128}$)(?=.*[A-Za-z0-9])[A-Za-z0-9._-]+$/;

export const isValidCanonicalCaseId = (caseId: string) => {
  if (!caseId) return false;
  if (caseId === "." || caseId === "..") return false;
  if (caseId.includes("/") || caseId.includes("\\") || caseId.includes("%")) return false;
  return CASE_ID_SAFE_PATTERN.test(caseId);
};

export const scopeFromRole = (role: AppRole) => {
  if (role === "admin") return "admin";
  if (role === "user") return "sub";
  return "pub";
};

export const roleFromPathname = (pathname?: string | null): AppRole => {
  const normalized = (pathname ?? "").trim().toLowerCase();
  if (normalized === "/admin" || normalized.startsWith("/admin/")) return "admin";
  if (normalized === "/sub" || normalized.startsWith("/sub/")) return "user";
  return "guest";
};

export const buildScopedCasePath = (role: AppRole, caseId: string) => {
  return `/${scopeFromRole(role)}/case/${encodeURIComponent(caseId)}`;
};

export const buildCanonicalCasePath = (caseId: string) => {
  return `/case/${encodeURIComponent(caseId)}`;
};

type CanonicalCaseRedirectInput = {
  caseId: string;
  role: AppRole;
  pathname: string;
  search?: string;
  hash?: string;
};

export const resolveCanonicalCaseRedirect = ({
  caseId,
  role,
  pathname,
  search = "",
  hash = "",
}: CanonicalCaseRedirectInput) => {
  if (!isValidCanonicalCaseId(caseId)) return null;
  const targetPath = buildScopedCasePath(role, caseId);
  if (pathname === targetPath) return null;
  return `${targetPath}${search}${hash}`;
};
