import React from "react";
import { Button, Dropdown } from "antd";
import { UserOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";

type UserMenuProps = {
  onAccount: () => void;
  onSignOut: () => void;
};

const UserMenu: React.FC<UserMenuProps> = ({ onAccount, onSignOut }) => {
  const items: MenuProps["items"] = [
    {
      key: "account",
      label: "Account Settings",
      onClick: onAccount,
    },
    {
      key: "signout",
      label: "Sign Out",
      onClick: onSignOut,
    },
  ];

  return (
    <Dropdown menu={{ items }} placement="bottomRight" trigger={["click"]}>
      <Button type="text" className="app-header-user" aria-label="User menu">
        <UserOutlined />
      </Button>
    </Dropdown>
  );
};

export default UserMenu;
