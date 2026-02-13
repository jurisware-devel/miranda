import React, { useEffect, useMemo, useState } from "react";
import { Grid, Layout } from "antd";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AppFooter from "./components/AppFooter";
import AppHeader from "./components/AppHeader";
import CaseDetailLayer from "./layers/CaseDetailLayer";
import CaseMasonryLayer from "./layers/CaseMasonryLayer";
import TagsPage from "./pages/TagsPage";
import { useCaseFilters } from "./logic/hooks/useCaseFilters";
import { useCasesData } from "./logic/hooks/useCasesData";
import { useTagsData } from "./logic/hooks/useTagsData";
import { mapCaseTagsByCaseId, mapTagsById } from "./logic/tagUtils";

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
  const location = useLocation();
  const navigate = useNavigate();

  const isCaseView = location.pathname.startsWith("/case/");
  const isCasesPage = location.pathname === "/";
  const showFilters = isCasesPage || isCaseView;
  const lockFilters = isCaseView;
  const showPagination = isCasesPage;

  const tagsById = useMemo(() => mapTagsById(tags), [tags]);
  const caseTagsByCaseId = useMemo(
    () => mapCaseTagsByCaseId(caseTags, tagsById),
    [caseTags, tagsById],
  );

  useEffect(() => {
    if (location.pathname !== "/") return;
    const state = (location.state as { tagId?: string } | null) ?? null;
    if (!state?.tagId) return;
    setSelectedAuthor(null);
    setSelectedTagIds([state.tagId]);
    setNameQuery("");
    setSortOrder("date_desc");
    navigate(".", { replace: true, state: null });
  }, [
    location.pathname,
    location.state,
    navigate,
    setNameQuery,
    setSelectedAuthor,
    setSelectedTagIds,
    setSortOrder,
  ]);

  return (
    <Layout className="app-shell" style={{ background: "transparent" }}>
      <AppHeader
        showFilters={showFilters}
        lockFilters={lockFilters}
        isMobile={isMobile}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        authorOptions={authorOptions}
        tagOptions={tagOptions}
        selectedAuthor={selectedAuthor}
        onAuthorChange={setSelectedAuthor}
        selectedTagIds={selectedTagIds}
        onTagChange={setSelectedTagIds}
        nameQuery={nameQuery}
        onNameQueryChange={setNameQuery}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
      />
      <Content className="app-content">
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
                authorOptions={authorOptions}
                tagOptions={tagOptions}
                selectedAuthor={selectedAuthor}
                onAuthorChange={setSelectedAuthor}
                selectedTagIds={selectedTagIds}
                onTagChange={setSelectedTagIds}
                nameQuery={nameQuery}
                onNameQueryChange={setNameQuery}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
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
