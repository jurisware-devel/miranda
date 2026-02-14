import React, { useMemo, useState } from "react";
import { Grid, Layout } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import AppFooter from "./components/AppFooter";
import AppHeader from "./components/AppHeader";
import AppContentRoutes from "./components/AppContentRoutes";
import CaseDetailNav from "./components/CaseDetailNav";
import { useCaseFilters } from "./logic/hooks/useCaseFilters";
import { useCasesData } from "./logic/hooks/useCasesData";
import { useTagsData } from "./logic/hooks/useTagsData";
import { useAppRouteUi } from "./logic/hooks/useAppRouteUi";
import { mapCaseTagsByCaseId, mapTagsById } from "./logic/tagUtils";
import type { CaseFilterControls } from "./logic/filterControls";

const { Content } = Layout;
const App: React.FC = () => {
  const { cases, loading, error } = useCasesData(true);
  const { tags, caseTags, tagsError, caseTagsError } = useTagsData(true);
  const {
    authorOptions,
    tagOptions,
    selectedAuthor,
    setSelectedAuthor,
    selectedTagIds,
    setSelectedTagIds,
    nameQuery,
    setNameQuery,
    sortOrder,
    setSortOrder,
    currentPage,
    setCurrentPage,
    pageSize,
    filteredCases,
    pagedCases,
  } = useCaseFilters(cases, tags, caseTags);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const location = useLocation();
  const navigate = useNavigate();
  const isXlUp = Boolean(screens.xl);
  const { showFilters, lockFilters, showPagination } = useAppRouteUi({
    setSelectedAuthor,
    setSelectedTagIds,
    setNameQuery,
    setSortOrder,
  });

  const tagsById = useMemo(() => mapTagsById(tags), [tags]);
  const caseTagsByCaseId = useMemo(
    () => mapCaseTagsByCaseId(caseTags, tagsById),
    [caseTags, tagsById],
  );
  const filters = useMemo<CaseFilterControls>(
    () => ({
      authorOptions,
      tagOptions,
      selectedAuthor,
      onAuthorChange: setSelectedAuthor,
      selectedTagIds,
      onTagChange: setSelectedTagIds,
      nameQuery,
      onNameQueryChange: setNameQuery,
      sortOrder,
      onSortOrderChange: setSortOrder,
    }),
    [
      authorOptions,
      tagOptions,
      selectedAuthor,
      setSelectedAuthor,
      selectedTagIds,
      setSelectedTagIds,
      nameQuery,
      setNameQuery,
      sortOrder,
      setSortOrder,
    ],
  );

  const activeCaseId = useMemo(() => {
    if (!location.pathname.startsWith("/case/")) return null;
    return decodeURIComponent(location.pathname.slice("/case/".length));
  }, [location.pathname]);

  const filteredIndex = useMemo(() => {
    if (!activeCaseId) return -1;
    return filteredCases.findIndex((item) => item.caseId === activeCaseId);
  }, [activeCaseId, filteredCases]);

  const prevCase = filteredIndex > 0 ? filteredCases[filteredIndex - 1] : null;
  const nextCase =
    filteredIndex >= 0 && filteredIndex < filteredCases.length - 1
      ? filteredCases[filteredIndex + 1]
      : null;

  const footerAction = lockFilters ? (
    <CaseDetailNav
      className="case-detail__bar--footer"
      hasPrevious={Boolean(prevCase)}
      hasNext={Boolean(nextCase)}
      onBack={() => navigate("/")}
      onPrevious={() => prevCase && navigate(`/case/${prevCase.caseId}`)}
      onNext={() => nextCase && navigate(`/case/${nextCase.caseId}`)}
    />
  ) : null;

  return (
    <Layout className="app-shell" style={{ background: "transparent" }}>
      <AppHeader
        showFilters={showFilters}
        lockFilters={lockFilters}
        isXlUp={isXlUp}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        onCloseFilters={() => setFiltersOpen(false)}
        filters={filters}
      />
      <Content className="app-content">
        <AppContentRoutes
          error={error}
          tagsError={tagsError}
          caseTagsError={caseTagsError}
          loading={loading}
          cases={cases}
          pagedCases={pagedCases}
          tagsById={tagsById}
          caseTagsByCaseId={caseTagsByCaseId}
          filters={filters}
        />
      </Content>
      <AppFooter
        showPagination={showPagination}
        currentPage={currentPage}
        pageSize={pageSize}
        total={filteredCases.length}
        onPageChange={setCurrentPage}
        footerAction={footerAction}
      />
    </Layout>
  );
};

export default App;
