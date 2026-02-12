import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "./useAuth";

const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, loading } = useAuth();
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

  if (role !== "Admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RequireAdmin;
