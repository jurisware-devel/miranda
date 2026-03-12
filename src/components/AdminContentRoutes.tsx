import React from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import AdminPlaceholderPage from "./AdminPlaceholderPage";
import AdminCaseDetailLayer from "../layers/AdminCaseDetailLayer";
import AdminCaseMasonryLayer from "../layers/AdminCaseMasonryLayer";
import type { CaseFilterControls } from "../core/filterControls";
import type { AppCapabilities } from "../core/types";
import type { CaseItem, CasePhaseItem, CaseTagItem, PhaseId, PhaseItem, TagItem } from "../core/types";
import type { TagMeta } from "../core/utils/tagUtils";

type AdminContentRoutesProps = {
  capabilities: AppCapabilities;
  isXlUp: boolean;
  error: string | null;
  tagsError: string | null;
  phasesError: string | null;
  caseTagsError: string | null;
  casePhasesError: string | null;
  loading: boolean;
  cases: CaseItem[];
  tags: TagItem[];
  phases: PhaseItem[];
  caseTags: CaseTagItem[];
  setCaseTags: React.Dispatch<React.SetStateAction<CaseTagItem[]>>;
  casePhases: CasePhaseItem[];
  setCasePhases: React.Dispatch<React.SetStateAction<CasePhaseItem[]>>;
  pagedCases: CaseItem[];
  tagsById: Map<string, TagMeta>;
  caseTagsByCaseId: Map<string, string[]>;
  casePhasesByCaseId: Map<string, PhaseId[]>;
  phasesById: Map<string, string>;
  filters: CaseFilterControls;
};

const AdminRoute: React.FC<{
  capabilities: AppCapabilities;
  children: React.ReactNode;
}> = ({ capabilities, children }) => {
  if (!capabilities.isAuthenticated) {
    return <Navigate to="/pub/login" replace />;
  }
  if (!capabilities.canAccessAdminRoutes) {
    return <Navigate to="/sub" replace />;
  }
  return <>{children}</>;
};

const AdminLegacyCaseRedirect: React.FC = () => {
  const { caseId } = useParams();
  if (!caseId) return <Navigate to="/admin" replace />;
  return <Navigate to={`/admin/case/${encodeURIComponent(caseId)}`} replace />;
};

const AdminContentRoutes: React.FC<AdminContentRoutesProps> = ({
  capabilities,
  isXlUp,
  error,
  tagsError,
  phasesError,
  caseTagsError,
  casePhasesError,
  loading,
  cases,
  tags,
  phases,
  caseTags,
  setCaseTags,
  casePhases,
  setCasePhases,
  pagedCases,
  tagsById,
  caseTagsByCaseId,
  casePhasesByCaseId,
  phasesById,
  filters,
}) => {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        path="/admin"
        element={
          <AdminRoute capabilities={capabilities}>
            <AdminCaseMasonryLayer
              error={error}
              tagsError={tagsError}
              phasesError={phasesError}
              caseTagsError={caseTagsError}
              casePhasesError={casePhasesError}
              loading={loading}
              cases={pagedCases}
              tagsById={tagsById}
              caseTagsByCaseId={caseTagsByCaseId}
              casePhasesByCaseId={casePhasesByCaseId}
              phasesById={phasesById}
              onOpenCase={(caseId) => navigate(`/admin/case/${caseId}`)}
              filters={filters}
            />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/case/:caseId"
        element={
          <AdminRoute capabilities={capabilities}>
            <AdminCaseDetailLayer
              cases={cases}
              tags={tags}
              phases={phases}
              caseTags={caseTags}
              setCaseTags={setCaseTags}
              casePhases={casePhases}
              setCasePhases={setCasePhases}
              canEditCaseTags={capabilities.canEditCaseTags}
              loading={loading}
              error={error}
              phasesError={phasesError}
              isWideLayout={isXlUp}
            />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/cases/:caseId"
        element={<AdminLegacyCaseRedirect />}
      />
      <Route
        path="/admin/cases/:caseId/tags"
        element={<AdminLegacyCaseRedirect />}
      />
      <Route
        path="/admin/cases/:caseId/opinion"
        element={<AdminLegacyCaseRedirect />}
      />
      <Route
        path="/admin/cases/:caseId/metadata"
        element={<AdminLegacyCaseRedirect />}
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
      <Route path="/admin/tags" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
};

export default AdminContentRoutes;
