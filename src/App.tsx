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
  const isPublicPath = !isAdminPath && !isSubPath;
  const canLoadSubData =
    capabilities.isResolved && capabilities.isAuthenticated && !capabilities.isAdmin;

  useEffect(() => {
    if (!capabilities.isResolved) return;
    if (isPublicPath && capabilities.isAuthenticated) {
      navigate(capabilities.isAdmin ? "/admin" : "/sub", { replace: true });
      return;
    }
    if (isSubPath && !capabilities.isAuthenticated) {
      navigate("/", { replace: true });
      return;
    }
    if (isSubPath && capabilities.isAdmin) {
      navigate("/admin", { replace: true });
      return;
    }
    if (isAdminPath && !capabilities.isAuthenticated) {
      navigate("/", { replace: true });
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
    isPublicPath,
    isSubPath,
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
