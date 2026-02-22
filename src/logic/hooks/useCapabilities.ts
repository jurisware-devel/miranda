import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import type { AppCapabilities, AppRole } from "../types";

const ADMIN_GROUP = "admin";

const toGroups = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string" && value.trim()) {
    return [value];
  }
  return [];
};

const buildCapabilities = (role: AppRole): AppCapabilities => {
  const isAuthenticated = role !== "guest";
  const isAdmin = role === "admin";
  return {
    role,
    isAuthenticated,
    isAdmin,
    canAccessAdminRoutes: isAdmin,
    canEditCaseTags: isAdmin,
    canEditOpinionText: isAdmin,
    canEditCaseMetadata: isAdmin,
  };
};

const detectRoleFromSession = async (): Promise<AppRole> => {
  try {
    const session = await fetchAuthSession();
    const claims = session.tokens?.accessToken?.payload;
    const groups = toGroups(claims?.["cognito:groups"]);
    if (groups.includes(ADMIN_GROUP)) return "admin";
    if (session.tokens?.idToken || session.tokens?.accessToken) return "user";
  } catch {
    // Treat unavailable auth/session as an unauthenticated guest.
  }
  return "guest";
};

export const useCapabilities = () => {
  const [capabilities, setCapabilities] = useState<AppCapabilities>(() =>
    buildCapabilities("guest"),
  );

  useEffect(() => {
    let active = true;

    async function resolveCapabilities() {
      const role = await detectRoleFromSession();
      if (!active) return;
      setCapabilities(buildCapabilities(role));
    }

    void resolveCapabilities();
    return () => {
      active = false;
    };
  }, []);

  return capabilities;
};
