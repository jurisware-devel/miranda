import type { Schema } from "../../amplify/data/resource";

export type CaseItem = Schema["Case"]["type"];
export type TagItem = Schema["Tag"]["type"];
export type CaseTagItem = Schema["CaseTag"]["type"];

export type AppRole = "guest" | "user" | "admin";

export type AppCapabilities = {
  role: AppRole;
  isAuthenticated: boolean;
  isAdmin: boolean;
  canAccessAdminRoutes: boolean;
  canEditCaseTags: boolean;
  canEditOpinionText: boolean;
  canEditCaseMetadata: boolean;
};
