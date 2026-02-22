import React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import CaseDetailLayer from "../layers/CaseDetailLayer";
import CaseMasonryLayer from "../layers/CaseMasonryLayer";
import type { AppCapabilities, CaseItem } from "../logic/types";
import type { TagMeta } from "../logic/tagUtils";
import type { CaseFilterControls } from "../logic/filterControls";

type AppContentRoutesProps = {
  error: string | null;
  tagsError: string | null;
  caseTagsError: string | null;
  loading: boolean;
  cases: CaseItem[];
  pagedCases: CaseItem[];
  tagsById: Map<string, TagMeta>;
  caseTagsByCaseId: Map<string, string[]>;
  filters: CaseFilterControls;
  capabilities: AppCapabilities;
};

const AppContentRoutes: React.FC<AppContentRoutesProps> = ({
  error,
  tagsError,
  caseTagsError,
  loading,
  cases,
  pagedCases,
  tagsById,
  caseTagsByCaseId,
  filters,
  capabilities,
}) => {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <CaseMasonryLayer
            error={error}
            tagsError={tagsError}
            caseTagsError={caseTagsError}
            loading={loading}
            cases={pagedCases}
            tagsById={tagsById}
            caseTagsByCaseId={caseTagsByCaseId}
            onOpenCase={(caseId) => navigate(`/case/${caseId}`)}
            filters={filters}
          />
        }
      />
      <Route
        path="/case/:caseId"
        element={
          <CaseDetailLayer
            cases={cases}
            loading={loading}
            error={error}
          />
        }
      />
      <Route
        path="/admin"
        element={
          capabilities.canAccessAdminRoutes ? (
            <div style={{ padding: 24 }}>Admin tools are not enabled yet.</div>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="/tags" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppContentRoutes;
