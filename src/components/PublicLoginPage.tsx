import React from "react";
import { Card } from "antd";
import { Authenticator } from "@aws-amplify/ui-react";

const PublicLoginPage: React.FC = () => {
  return (
    <div className="public-login-page">
      <Card className="public-login-card" title="Sign in required">
        <Authenticator hideSignUp />
      </Card>
    </div>
  );
};

export default PublicLoginPage;
