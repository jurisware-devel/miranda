import React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import SubPlaceholderPage from "./SubPlaceholderPage";
import SubCaseDetailLayer from "../layers/SubCaseDetailLayer";
import SubCaseMasonryLayer from "../layers/SubCaseMasonryLayer";
import type { CaseFilterControls } from "../core/filterControls";
import type { CaseItem, PhaseId } from "../core/types";
import type { TagMeta } from "../core/utils/tagUtils";

type SubContentRoutesProps = {
  error: string | null;
  tagsError: string | null;
  caseTagsError: string | null;
  casePhasesError: string | null;
  loading: boolean;
  cases: CaseItem[];
  pagedCases: CaseItem[];
  tagsById: Map<string, TagMeta>;
  caseTagsByCaseId: Map<string, string[]>;
  casePhasesByCaseId: Map<string, PhaseId[]>;
  filters: CaseFilterControls;
  isXlUp: boolean;
};

const SubContentRoutes: React.FC<SubContentRoutesProps> = ({
  error,
  tagsError,
  caseTagsError,
  casePhasesError,
  loading,
  cases,
  pagedCases,
  tagsById,
  caseTagsByCaseId,
  casePhasesByCaseId,
  filters,
  isXlUp,
}) => {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        path="/sub"
        element={
          <SubCaseMasonryLayer
            error={error}
            tagsError={tagsError}
            caseTagsError={caseTagsError}
            casePhasesError={casePhasesError}
            loading={loading}
            cases={pagedCases}
            tagsById={tagsById}
            caseTagsByCaseId={caseTagsByCaseId}
            casePhasesByCaseId={casePhasesByCaseId}
            onOpenCase={(caseId) => navigate(`/sub/case/${caseId}`)}
            filters={filters}
          />
        }
      />
      <Route
        path="/sub/case/:caseId"
        element={<SubCaseDetailLayer cases={cases} loading={loading} error={error} />}
      />
      <Route
        path="/sub/settings"
        element={
          <SubPlaceholderPage
            title="Subscriber settings"
            description="Subscriber settings are not enabled yet."
            isCondensedLayout={!isXlUp}
            backPathOverride="/sub"
            backLabel="Back to subscriber home"
          />
        }
      />
      <Route path="/sub/tags" element={<Navigate to="/sub" replace />} />
      <Route path="*" element={<Navigate to="/sub" replace />} />
    </Routes>
  );
};

export default SubContentRoutes;
