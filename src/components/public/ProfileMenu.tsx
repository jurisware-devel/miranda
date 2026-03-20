import React from "react";
import { UserOutlined } from "@ant-design/icons";
import { Button, Dropdown } from "antd";
import type { MenuProps } from "antd";

type ProfileMenuProps = {
  items: MenuProps["items"];
  onClick: NonNullable<MenuProps["onClick"]>;
  label: string;
};

const ProfileMenu: React.FC<ProfileMenuProps> = ({ items, onClick, label }) => {
  return (
    <Dropdown menu={{ items, onClick }} trigger={["click"]} placement="bottomRight">
      <Button
        type="text"
        className="app-header-profile-button"
        aria-label={label}
        icon={<UserOutlined />}
      />
    </Dropdown>
  );
};

export default ProfileMenu;
