import React from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { Navigate } from "react-router-dom";
import { useAuth } from "../logic/auth/useAuth";

const LoginPage: React.FC = () => {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="auth-page">
      <Authenticator initialState="signIn" />
    </div>
  );
};

export default LoginPage;
