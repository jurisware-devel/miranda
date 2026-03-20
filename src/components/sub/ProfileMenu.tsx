import React from "react";
import { UserOutlined } from "@ant-design/icons";
import { Button, Dropdown } from "antd";
import type { MenuProps } from "antd";

type SubProfileMenuProps = {
  items: MenuProps["items"];
  onClick: NonNullable<MenuProps["onClick"]>;
  label: string;
};

const SubProfileMenu: React.FC<SubProfileMenuProps> = ({ items, onClick, label }) => {
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

export default SubProfileMenu;
