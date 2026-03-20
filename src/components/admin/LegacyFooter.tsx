import React from "react";
import { Layout } from "antd";
import { Link } from "react-router-dom";

const { Footer } = Layout;

const AdminFooter: React.FC = () => {
  return (
    <Footer className="admin-footer">
      <Link to="/pub">Return to public site</Link>
    </Footer>
  );
};

export default AdminFooter;
