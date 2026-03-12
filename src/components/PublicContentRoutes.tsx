import React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import CaseDetailLayer from "../layers/CaseDetailLayer";
import CaseMasonryLayer from "../layers/CaseMasonryLayer";
import PublicLoginPage from "./PublicLoginPage";
import type { CaseItem, PhaseId } from "../core/types";
import type { TagMeta } from "../core/utils/tagUtils";
import type { CaseFilterControls } from "../core/filterControls";

type PublicContentRoutesProps = {
  error: string | null;
  tagsError: string | null;
  phasesError: string | null;
  caseTagsError: string | null;
  casePhasesError: string | null;
  loading: boolean;
  cases: CaseItem[];
  pagedCases: CaseItem[];
  tagsById: Map<string, TagMeta>;
  caseTagsByCaseId: Map<string, string[]>;
  casePhasesByCaseId: Map<string, PhaseId[]>;
  phasesById: Map<string, string>;
  filters: CaseFilterControls;
};

const PublicContentRoutes: React.FC<PublicContentRoutesProps> = ({
  error,
  tagsError,
  phasesError,
  caseTagsError,
  casePhasesError,
  loading,
  cases,
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
        path="/pub"
        element={
          <CaseMasonryLayer
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
            onOpenCase={(caseId) => navigate(`/pub/case/${caseId}`)}
            filters={filters}
          />
        }
      />
      <Route
        path="/pub/case/:caseId"
        element={<CaseDetailLayer cases={cases} loading={loading} error={error} />}
      />
      <Route path="/pub/login" element={<PublicLoginPage />} />
      <Route path="/pub/tags" element={<Navigate to="/pub" replace />} />
      <Route path="*" element={<Navigate to="/pub" replace />} />
    </Routes>
  );
};

export default PublicContentRoutes;
