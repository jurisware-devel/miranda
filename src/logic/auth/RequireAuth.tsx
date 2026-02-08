import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "./useAuth";

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading">
        <Spin />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
