import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AdminCaseToolsPage from "./AdminCaseToolsPage";
import AdminPlaceholderPage from "./AdminPlaceholderPage";
import type { AppCapabilities } from "../core/types";

type AdminContentRoutesProps = {
  capabilities: AppCapabilities;
  isXlUp: boolean;
};

const AdminRoute: React.FC<{
  capabilities: AppCapabilities;
  children: React.ReactNode;
}> = ({ capabilities, children }) => {
  if (!capabilities.canAccessAdminRoutes) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const AdminContentRoutes: React.FC<AdminContentRoutesProps> = ({ capabilities, isXlUp }) => {
  return (
    <Routes>
      <Route
        path="/admin"
        element={
          <AdminRoute capabilities={capabilities}>
            <AdminPlaceholderPage
              title="Admin tools"
              description="Admin tools are not enabled yet."
              isCondensedLayout={!isXlUp}
            />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/cases/:caseId"
        element={
          <AdminRoute capabilities={capabilities}>
            <AdminCaseToolsPage isCondensedLayout={!isXlUp} />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/cases/:caseId/tags"
        element={
          <AdminRoute capabilities={capabilities}>
            <AdminPlaceholderPage
              title="Admin case tags"
              description="Admin case tag editor is not enabled yet."
              isCondensedLayout={!isXlUp}
            />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/cases/:caseId/opinion"
        element={
          <AdminRoute capabilities={capabilities}>
            <AdminPlaceholderPage
              title="Admin opinion editor"
              description="Admin opinion editor is not enabled yet."
              isCondensedLayout={!isXlUp}
            />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/cases/:caseId/metadata"
        element={
          <AdminRoute capabilities={capabilities}>
            <AdminPlaceholderPage
              title="Admin metadata editor"
              description="Admin metadata editor is not enabled yet."
              isCondensedLayout={!isXlUp}
            />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <AdminRoute capabilities={capabilities}>
            <AdminPlaceholderPage
              title="Admin settings"
              description="Admin settings are not enabled yet."
              isCondensedLayout={!isXlUp}
            />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
};

export default AdminContentRoutes;
