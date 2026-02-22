import React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import CaseDetailLayer from "../layers/CaseDetailLayer";
import CaseMasonryLayer from "../layers/CaseMasonryLayer";
import type { CaseItem } from "../core/types";
import type { TagMeta } from "../core/utils/tagUtils";
import type { CaseFilterControls } from "../core/filterControls";

type PublicContentRoutesProps = {
  error: string | null;
  tagsError: string | null;
  caseTagsError: string | null;
  loading: boolean;
  cases: CaseItem[];
  pagedCases: CaseItem[];
  tagsById: Map<string, TagMeta>;
  caseTagsByCaseId: Map<string, string[]>;
  filters: CaseFilterControls;
};

const PublicContentRoutes: React.FC<PublicContentRoutesProps> = ({
  error,
  tagsError,
  caseTagsError,
  loading,
  cases,
  pagedCases,
  tagsById,
  caseTagsByCaseId,
  filters,
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
        element={<CaseDetailLayer cases={cases} loading={loading} error={error} />}
      />
      <Route path="/tags" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default PublicContentRoutes;
