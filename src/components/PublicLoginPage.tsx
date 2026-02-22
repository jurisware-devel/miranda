import React from "react";
import { Alert, Button, Card } from "antd";
import { signInWithRedirect } from "aws-amplify/auth";
import { useSearchParams } from "react-router-dom";

const PublicLoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");

  const handleLogin = () => {
    void signInWithRedirect({
      customState: next ?? "/sub",
    });
  };

  return (
    <div className="public-login-page">
      <Card className="public-login-card" title="Sign in required">
        <Alert
          type="info"
          showIcon
          message="Please sign in to continue."
          style={{ marginBottom: 16 }}
        />
        <Button type="primary" onClick={handleLogin}>
          Login
        </Button>
      </Card>
    </div>
  );
};

export default PublicLoginPage;
