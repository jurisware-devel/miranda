import React, { useEffect } from "react";
import { Navigate, matchPath, useLocation, useNavigate } from "react-router-dom";
import { useCapabilities } from "./core/auth/useCapabilities";
import AdminApp from "./shards/admin/AdminApp";
import PublicApp from "./shards/public/PublicApp";
import SubApp from "./shards/sub/SubApp";
import LandingPage from "./components/shared/LandingPage";
import type { AppRole } from "./core/types";
import {
  isValidCanonicalCaseId,
  resolveCanonicalCaseRedirect,
} from "./core/routing/canonicalCaseRouting";

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const capabilities = useCapabilities();
  const isAdminPath = location.pathname.startsWith("/admin");
  const isSubPath = location.pathname.startsWith("/sub");
  const isPubPath = location.pathname.startsWith("/pub");
  const isPubLoginPath = location.pathname === "/pub/login";
  const canonicalCaseMatch = matchPath("/case/:caseId", location.pathname);
  const canonicalCaseId = canonicalCaseMatch?.params.caseId ?? null;
  const isCanonicalCasePath = canonicalCaseId !== null;
  const isRootPath = location.pathname === "/";
  const isKnownPath = isAdminPath || isSubPath || isPubPath || isRootPath || isCanonicalCasePath;
  const canLoadSubData =
    capabilities.isResolved && capabilities.isAuthenticated && !capabilities.isAdmin;
  const resolvedRole: AppRole = capabilities.isAdmin
    ? "admin"
    : capabilities.isAuthenticated
      ? "user"
      : "guest";

  useEffect(() => {
    const routeClasses = ["route-theme-sub", "route-theme-admin", "route-theme-pub"];
    document.body.classList.remove(...routeClasses);
    if (isSubPath) {
      document.body.classList.add("route-theme-sub");
    } else if (isAdminPath) {
      document.body.classList.add("route-theme-admin");
    } else {
      document.body.classList.add("route-theme-pub");
    }
    return () => {
      document.body.classList.remove(...routeClasses);
    };
  }, [isAdminPath, isSubPath]);

  useEffect(() => {
    if (isCanonicalCasePath) return;
    if (!capabilities.isResolved) return;
    if (isRootPath) {
      if (capabilities.isAuthenticated) {
        navigate(capabilities.isAdmin ? "/admin" : "/sub", {
          replace: true,
        });
      }
      return;
    }
    if (!isKnownPath) {
      navigate(capabilities.isAuthenticated ? (capabilities.isAdmin ? "/admin" : "/sub") : "/", {
        replace: true,
      });
      return;
    }
    if (isPubPath && capabilities.isAuthenticated) {
      if (location.pathname === "/pub/login") {
        const nextRaw = new URLSearchParams(location.search).get("next");
        if (nextRaw) {
          const nextDecoded = decodeURIComponent(nextRaw);
          if (nextDecoded.startsWith("/sub") || nextDecoded.startsWith("/admin")) {
            navigate(nextDecoded, { replace: true });
            return;
          }
        }
      }
      navigate(capabilities.isAdmin ? "/admin" : "/sub", { replace: true });
      return;
    }
    if ((isSubPath || isAdminPath) && !capabilities.isAuthenticated) {
      const next = encodeURIComponent(
        `${location.pathname}${location.search}${location.hash}`,
      );
      navigate(`/pub/login?next=${next}`, { replace: true });
      return;
    }
    if (isSubPath && capabilities.isAdmin) {
      navigate("/admin", { replace: true });
      return;
    }
    if (isAdminPath && capabilities.isAuthenticated && !capabilities.isAdmin) {
      navigate("/sub", { replace: true });
    }
  }, [
    capabilities.isAdmin,
    capabilities.isAuthenticated,
    capabilities.isResolved,
    isAdminPath,
    isKnownPath,
    isPubPath,
    isRootPath,
    isSubPath,
    isCanonicalCasePath,
    location.hash,
    location.pathname,
    location.search,
    navigate,
  ]);

  if (isAdminPath) {
    return <AdminApp capabilities={capabilities} />;
  }
  if (isSubPath) {
    return <SubApp enableData={canLoadSubData} />;
  }
  if (isPubPath && capabilities.isResolved && capabilities.isAuthenticated) {
    return null;
  }
  if (isPubLoginPath && !capabilities.isResolved) {
    return null;
  }
  if (isRootPath && !capabilities.isResolved) {
    return null;
  }
  if (isRootPath && capabilities.isResolved && !capabilities.isAuthenticated) {
    return <LandingPage />;
  }
  if (isCanonicalCasePath) {
    if (!canonicalCaseId || !isValidCanonicalCaseId(canonicalCaseId)) {
      return <Navigate to="/pub" replace />;
    }
    if (!capabilities.isResolved) return null;
    const target = resolveCanonicalCaseRedirect({
      caseId: canonicalCaseId,
      role: resolvedRole,
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    });
    if (!target) return <Navigate to="/pub" replace />;
    return <Navigate to={target} replace />;
  }
  return <PublicApp />;
};

export default App;
