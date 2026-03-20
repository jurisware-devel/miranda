import React from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { useCapabilities } from "../../core/auth/useCapabilities";

const PublicLoginPage: React.FC = () => {
  const capabilities = useCapabilities();

  // Hide only when already authenticated; App-level routing handles redirect.
  if (capabilities.isAuthenticated) {
    return null;
  }

  return (
    <div className="public-login-page">
      <Authenticator />
    </div>
  );
};

export default PublicLoginPage;
