import React from "react";
import { Grid, Layout } from "antd";
import type { MenuProps } from "antd";
import { signOut } from "aws-amplify/auth";
import { useNavigate } from "react-router-dom";
import AdminContentRoutes from "../../components/AdminContentRoutes";
import AdminFooter from "../../components/AdminFooter";
import AdminHeader from "../../components/AdminHeader";
import type { AppCapabilities } from "../../core/types";

const { Content } = Layout;

type AdminAppProps = {
  capabilities: AppCapabilities;
};

const AdminApp: React.FC<AdminAppProps> = ({ capabilities }) => {
  const screens = Grid.useBreakpoint();
  const isXlUp = Boolean(screens.xl);
  const navigate = useNavigate();
  const handleSignedInProfileClick: NonNullable<MenuProps["onClick"]> = ({ key }) => {
    if (key === "settings") {
      navigate("/admin/settings");
      return;
    }
    if (key === "signout") {
      void signOut();
    }
  };

  const signedInProfileItems: MenuProps["items"] = [
    { key: "settings", label: "Settings" },
    { key: "signout", label: "Sign Out" },
  ];

  return (
    <Layout className="app-shell app-shell--admin" style={{ background: "transparent" }}>
      <AdminHeader
        profileItems={signedInProfileItems}
        onProfileClick={handleSignedInProfileClick}
      />
      <Content className="app-content">
        <AdminContentRoutes capabilities={capabilities} isXlUp={isXlUp} />
      </Content>
      <AdminFooter />
    </Layout>
  );
};

export default AdminApp;
