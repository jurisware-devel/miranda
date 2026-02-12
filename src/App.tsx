import React, { useEffect, useMemo, useState } from "react";
import { Grid, Layout } from "antd";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AppFooter from "./components/AppFooter";
import AppHeader from "./components/AppHeader";
import CaseDetailLayer from "./layers/CaseDetailLayer";
import CaseMasonryLayer from "./layers/CaseMasonryLayer";
import AccountPage from "./pages/AccountPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import TagsPage from "./pages/TagsPage";
import RequireAdmin from "./logic/auth/RequireAdmin";
import { useAuth } from "./logic/auth/useAuth";
import { useCaseFilters } from "./logic/hooks/useCaseFilters";
import { useCasesData } from "./logic/hooks/useCasesData";
import { useTagsData } from "./logic/hooks/useTagsData";
import { mapCaseTagsByCaseId, mapTagsById } from "./logic/tagUtils";
import type { CaseItem, CaseTagItem } from "./logic/types";

const { Content } = Layout;

type AppShellProps = {
  basePath?: string;
  adminMode?: boolean;
};

const AppShell: React.FC<AppShellProps> = ({ basePath = "", adminMode = false }) => {
  const { signOut } = useAuth();
  const canEdit = adminMode;
  const { cases, setCases, loading, error } = useCasesData(true);
  const {
    tags,
    caseTags,
    setCaseTags,
    tagsError,
    caseTagsError,
  } = useTagsData(true);
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
  const rootPath = basePath || "/";
  const tagsPath = basePath ? `${basePath}/tags` : "/tags";
  const accountPath = basePath ? `${basePath}/account` : "/account";
  const isCaseView = basePath
    ? location.pathname.startsWith(`${basePath}/case/`)
    : location.pathname.startsWith("/case/");
  const isCasesPage = location.pathname === rootPath;
  const isTagsPage = location.pathname === tagsPath;
  const showFilters = isCasesPage || isCaseView;
  const lockFilters = isCaseView;
  const showPagination = isCasesPage;

  const tagsById = useMemo(() => mapTagsById(tags), [tags]);
  const caseTagsByCaseId = useMemo(
    () => mapCaseTagsByCaseId(caseTags, tagsById),
    [caseTags, tagsById],
  );

  const navigate = useNavigate();
  useEffect(() => {
    if (location.pathname !== rootPath) return;
    const state = (location.state as { tagId?: string } | null) ?? null;
    if (!state?.tagId) return;
    setSelectedAuthor(null);
    setSelectedTagIds([state.tagId]);
    setNameQuery("");
    setSortOrder("date_desc");
    setFiltersOpen(false);
    navigate(".", { replace: true, state: null });
  }, [
    location.pathname,
    location.state,
    navigate,
    rootPath,
    setNameQuery,
    setSelectedAuthor,
    setSelectedTagIds,
    setSortOrder,
    setFiltersOpen,
  ]);
  const handleCaseUpdated = (updated: CaseItem) => {
    setCases((prev) =>
      prev.map((item) => (item.caseId === updated.caseId ? updated : item)),
    );
  };
  const handleCaseTagsUpdated = (_caseId: string, nextCaseTags: CaseTagItem[]) => {
    setCaseTags(nextCaseTags);
  };

  return (
    <Layout className="app-shell" style={{ background: "transparent" }}>
      <AppHeader
        basePath={basePath}
        showUserMenu={adminMode}
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
        onAccount={() => navigate(accountPath)}
        onSignOut={signOut}
      />
      <Content className="app-content">
        <Routes>
          <Route
            path={rootPath}
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
                onOpenCase={(caseId) =>
                  navigate(basePath ? `${basePath}/case/${caseId}` : `/case/${caseId}`)
                }
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
            path={basePath ? `${basePath}/case/:caseId` : "/case/:caseId"}
            element={
              <CaseDetailLayer
                routePrefix={basePath}
                cases={cases}
                filteredCases={filteredCases}
                loading={loading}
                error={error}
                tags={tags}
                caseTags={caseTags}
                canEdit={canEdit}
                onCaseUpdated={handleCaseUpdated}
                onCaseTagsUpdated={handleCaseTagsUpdated}
              />
            }
          />
          <Route path={tagsPath} element={<TagsPage canEdit={canEdit} basePath={basePath} />} />
          {adminMode ? <Route path={accountPath} element={<AccountPage />} /> : null}
        </Routes>
      </Content>
      <AppFooter
        showPagination={showPagination}
        currentPage={currentPage}
        pageSize={pageSize}
        total={filteredCases.length}
        onPageChange={setCurrentPage}
        footerAction={
          isTagsPage && canEdit ? (
            <button
              type="button"
              className="tag-footer-action"
              onClick={() => navigate(tagsPath, { state: { openCreateTag: true } })}
            >
              + Tag
            </button>
          ) : null
        }
      />
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/admin/*"
        element={
          <RequireAdmin>
            <AppShell basePath="/admin" adminMode />
          </RequireAdmin>
        }
      />
      <Route
        path="/*"
        element={<AppShell />}
      />
    </Routes>
  );
};

export default App;
