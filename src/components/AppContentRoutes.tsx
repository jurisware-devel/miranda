import React from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import CaseDetailLayer from "../layers/CaseDetailLayer";
import CaseMasonryLayer from "../layers/CaseMasonryLayer";
import TagsPage from "../pages/TagsPage";
import type { CaseItem } from "../logic/types";
import type { TagMeta } from "../logic/tagUtils";
import type { CaseFilterControls } from "../logic/filterControls";

type AppContentRoutesProps = {
  isMobile: boolean;
  filtersOpen: boolean;
  error: string | null;
  tagsError: string | null;
  caseTagsError: string | null;
  loading: boolean;
  cases: CaseItem[];
  filteredCases: CaseItem[];
  pagedCases: CaseItem[];
  tagsById: Map<string, TagMeta>;
  caseTagsByCaseId: Map<string, string[]>;
  filters: CaseFilterControls;
};

const AppContentRoutes: React.FC<AppContentRoutesProps> = ({
  isMobile,
  filtersOpen,
  error,
  tagsError,
  caseTagsError,
  loading,
  cases,
  filteredCases,
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
            isMobile={isMobile}
            filtersOpen={filtersOpen}
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
            filteredCases={filteredCases}
            loading={loading}
            error={error}
          />
        }
      />
      <Route path="/tags" element={<TagsPage />} />
    </Routes>
  );
};

export default AppContentRoutes;
