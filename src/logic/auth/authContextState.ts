import { createContext } from "react";
import type { AuthUser } from "aws-amplify/auth";
import type { UserProfileItem } from "../types";
import type { UserRole } from "./authTypes";

export type AuthState = {
  user: AuthUser | null;
  profile: UserProfileItem | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | undefined>(undefined);
