import React, { useMemo, useState } from "react";
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
import RequireAuth from "./logic/auth/RequireAuth";
import { useAuth } from "./logic/auth/useAuth";
import { useCaseFilters } from "./logic/hooks/useCaseFilters";
import { useCasesData } from "./logic/hooks/useCasesData";
import { useTagsData } from "./logic/hooks/useTagsData";
import { mapCaseTagsByCaseId, mapTagsById } from "./logic/tagUtils";
import type { CaseItem, CaseTagItem } from "./logic/types";

const { Content } = Layout;

const AppShell: React.FC = () => {
  const { user, profile, role, signOut } = useAuth();
  const canEdit = role === "Admin";
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
    selectedAuthor,
    setSelectedAuthor,
    nameQuery,
    setNameQuery,
    sortOrder,
    setSortOrder,
    currentPage,
    setCurrentPage,
    pageSize,
    filteredCases,
    pagedCases,
  } = useCaseFilters(cases);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.sm;
  const location = useLocation();
  const isCaseView = location.pathname.startsWith("/case/");
  const isCasesPage = location.pathname === "/";
  const showFilters = isCasesPage || isCaseView;
  const lockFilters = isCaseView;
  const showPagination = isCasesPage;
  const userLabel =
    profile?.name?.trim() ||
    profile?.email ||
    user?.signInDetails?.loginId ||
    "Account";

  const tagsById = useMemo(() => mapTagsById(tags), [tags]);
  const caseTagsByCaseId = useMemo(
    () => mapCaseTagsByCaseId(caseTags, tagsById),
    [caseTags, tagsById],
  );

  const navigate = useNavigate();
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
        showFilters={showFilters}
        lockFilters={lockFilters}
        isMobile={isMobile}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        authorOptions={authorOptions}
        selectedAuthor={selectedAuthor}
        onAuthorChange={setSelectedAuthor}
        nameQuery={nameQuery}
        onNameQueryChange={setNameQuery}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        userLabel={userLabel}
        onAccount={() => navigate("/account")}
        onSignOut={signOut}
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
                selectedAuthor={selectedAuthor}
                onAuthorChange={setSelectedAuthor}
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
                tags={tags}
                caseTags={caseTags}
                canEdit={canEdit}
                onCaseUpdated={handleCaseUpdated}
                onCaseTagsUpdated={handleCaseTagsUpdated}
              />
            }
          />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/tags" element={<TagsPage />} />
        </Routes>
      </Content>
      <AppFooter
        showPagination={showPagination}
        currentPage={currentPage}
        pageSize={pageSize}
        total={filteredCases.length}
        onPageChange={setCurrentPage}
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
        path="/*"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      />
    </Routes>
  );
};

export default App;
