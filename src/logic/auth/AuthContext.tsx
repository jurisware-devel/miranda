import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchAuthSession, getCurrentUser, signOut } from "aws-amplify/auth";
import type { AuthUser } from "aws-amplify/auth";
import { client } from "../amplifyClient";
import type { UserProfileItem } from "../types";

export type UserRole = "Admin" | "User";

type AuthState = {
  user: AuthUser | null;
  profile: UserProfileItem | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const resolveRole = (groups: string[] | undefined): UserRole =>
  groups?.includes("Admin") ? "Admin" : "User";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfileItem | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (authUser: AuthUser) => {
    const userId = authUser.userId;
    const email =
      authUser.signInDetails?.loginId ?? authUser.username ?? "";
    const existing = await client.models.UserProfile.get({ userId });
    if (existing?.data) {
      setProfile(existing.data as UserProfileItem);
      return;
    }
    const created = await client.models.UserProfile.create({
      userId,
      email,
      name: "",
      organization: "",
    });
    setProfile((created?.data ?? null) as UserProfileItem | null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const authUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const groups = (session.tokens?.idToken?.payload?.["cognito:groups"] ??
        []) as string[];
      setUser(authUser);
      setRole(resolveRole(groups));
      await loadProfile(authUser);
    } catch (err) {
      setUser(null);
      setProfile(null);
      setRole(null);
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setUser(null);
    setProfile(null);
    setRole(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      role,
      loading,
      error,
      refresh,
      signOut: handleSignOut,
    }),
    [user, profile, role, loading, error, refresh, handleSignOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
