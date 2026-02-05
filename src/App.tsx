import { useMemo } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { Avatar, Dropdown } from "antd";
import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import CasesPage from "./pages/CasesPage";
import ProfilePage from "./pages/ProfilePage";

function App() {
  const { signOut } = useAuthenticator();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = useMemo(
    () => [
      { key: "profile", label: "Profile" },
      { key: "signout", label: "Sign out", icon: <LogoutOutlined /> },
    ],
    []
  );

  function handleMenuClick({ key }: { key: string }) {
    if (key === "profile") {
      navigate("/profile");
    }
    if (key === "signout") {
      signOut();
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-right">
          <Dropdown
            menu={{ items: menuItems, onClick: handleMenuClick }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <Avatar className="avatar-button" icon={<UserOutlined />} />
          </Dropdown>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<CasesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<CasesPage />} />
        </Routes>
        {location.pathname === "/" ? (
          <div className="pagination-spacer" />
        ) : null}
      </main>
    </div>
  );
}

export default App;
