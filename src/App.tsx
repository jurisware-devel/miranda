import React, { useMemo, useState } from "react";
import { Grid, Layout } from "antd";
import AppFooter from "./components/AppFooter";
import AppHeader from "./components/AppHeader";
import AppContentRoutes from "./components/AppContentRoutes";
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
  const isMobile = !screens.sm;
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

  return (
    <Layout className="app-shell" style={{ background: "transparent" }}>
      <AppHeader
        showFilters={showFilters}
        lockFilters={lockFilters}
        isMobile={isMobile}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        filters={filters}
      />
      <Content className="app-content">
        <AppContentRoutes
          isMobile={isMobile}
          filtersOpen={filtersOpen}
          error={error}
          tagsError={tagsError}
          caseTagsError={caseTagsError}
          loading={loading}
          cases={cases}
          filteredCases={filteredCases}
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
        footerAction={null}
      />
    </Layout>
  );
};

export default App;
