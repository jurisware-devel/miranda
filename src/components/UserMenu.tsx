import React from "react";
import { Button, Dropdown } from "antd";
import type { MenuProps } from "antd";

type UserMenuProps = {
  label: string;
  onAccount: () => void;
  onSignOut: () => void;
};

const UserMenu: React.FC<UserMenuProps> = ({ label, onAccount, onSignOut }) => {
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
      <Button type="text" className="app-header-user">
        {label}
      </Button>
    </Dropdown>
  );
};

export default UserMenu;
