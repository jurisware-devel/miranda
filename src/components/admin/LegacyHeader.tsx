import React from "react";
import { Layout } from "antd";
import { Link } from "react-router-dom";
import ProfileMenu from "./ProfileMenu";
import type { MenuProps } from "antd";

const { Header } = Layout;

type AdminHeaderProps = {
  profileItems: MenuProps["items"];
  onProfileClick: NonNullable<MenuProps["onClick"]>;
};

const AdminHeader: React.FC<AdminHeaderProps> = ({ profileItems, onProfileClick }) => {
  return (
    <Header className="admin-header">
      <div className="admin-header__title">Miranda Admin</div>
      <nav className="admin-header__nav" aria-label="Admin navigation">
        <Link to="/admin">Home</Link>
      </nav>
      <ProfileMenu
        items={profileItems}
        onClick={onProfileClick}
        label="Open admin account menu"
      />
    </Header>
  );
};

export default AdminHeader;
