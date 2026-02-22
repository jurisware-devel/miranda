import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCapabilities } from "./core/auth/useCapabilities";
import AdminApp from "./shards/admin/AdminApp";
import PublicApp from "./shards/public/PublicApp";
import SubApp from "./shards/sub/SubApp";

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const capabilities = useCapabilities();
  const isAdminPath = location.pathname.startsWith("/admin");
  const isSubPath = location.pathname.startsWith("/sub");
  const isPubPath = location.pathname.startsWith("/pub");
  const isRootPath = location.pathname === "/";
  const isKnownPath = isAdminPath || isSubPath || isPubPath || isRootPath;
  const canLoadSubData =
    capabilities.isResolved && capabilities.isAuthenticated && !capabilities.isAdmin;

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
    if (!capabilities.isResolved) return;
    if (isRootPath) {
      navigate(capabilities.isAuthenticated ? (capabilities.isAdmin ? "/admin" : "/sub") : "/pub", {
        replace: true,
      });
      return;
    }
    if (!isKnownPath) {
      navigate(capabilities.isAuthenticated ? (capabilities.isAdmin ? "/admin" : "/sub") : "/pub", {
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
  return <PublicApp />;
};

export default App;
