import React from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../logic/auth/useAuth";

const LoginPage: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const from = (
    location.state as { from?: { pathname?: string } } | null
  )?.from?.pathname;

  if (!loading && user) {
    return <Navigate to={from || "/"} replace />;
  }

  return (
    <div className="auth-page">
      <Authenticator initialState="signIn" />
    </div>
  );
};

export default LoginPage;
