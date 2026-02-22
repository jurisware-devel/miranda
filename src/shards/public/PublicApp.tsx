import React, { useMemo, useState } from "react";
import { Grid, Layout } from "antd";
import type { MenuProps } from "antd";
import { message } from "antd";
import { signInWithRedirect } from "aws-amplify/auth";
import { useLocation, useNavigate } from "react-router-dom";
import AppFooter from "../../components/AppFooter";
import AppHeader from "../../components/AppHeader";
import CaseDetailNav from "../../components/CaseDetailNav";
import PublicContentRoutes from "../../components/PublicContentRoutes";
import type { CaseFilterControls } from "../../core/filterControls";
import { mapCaseTagsByCaseId, mapTagsById } from "../../core/utils/tagUtils";
import { usePublicCaseFilters } from "./hooks/usePublicCaseFilters";
import { usePublicCasesData } from "./hooks/usePublicCasesData";
import { usePublicRouteUi } from "./hooks/usePublicRouteUi";
import { usePublicTagsData } from "./hooks/usePublicTagsData";

const { Content } = Layout;

const PublicApp: React.FC = () => {
  const { cases, loading, error } = usePublicCasesData(true);
  const { tags, caseTags, tagsError, caseTagsError } = usePublicTagsData(true);
  const {
    authorOptions,
    tagOptions,
    selectedAuthor,
    setSelectedAuthor,
    selectedTagIds,
    setSelectedTagIds,
    courtOptions,
    selectedCourt,
    setSelectedCourt,
    nameQuery,
    setNameQuery,
    sortOrder,
    setSortOrder,
    currentPage,
    setCurrentPage,
    pageSize,
    filteredCases,
    pagedCases,
  } = usePublicCaseFilters(cases, tags, caseTags);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const isXlUp = Boolean(screens.xl);
  const location = useLocation();
  const navigate = useNavigate();

  const { showFilters, lockFilters, showPagination } = usePublicRouteUi({
    setSelectedAuthor,
    setSelectedTagIds,
    setNameQuery,
    setSortOrder,
    setSelectedCourt,
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
      courtOptions,
      selectedAuthor,
      onAuthorChange: setSelectedAuthor,
      selectedTagIds,
      onTagChange: setSelectedTagIds,
      selectedCourt,
      onCourtChange: setSelectedCourt,
      nameQuery,
      onNameQueryChange: setNameQuery,
      sortOrder,
      onSortOrderChange: setSortOrder,
    }),
    [
      authorOptions,
      tagOptions,
      courtOptions,
      selectedAuthor,
      setSelectedAuthor,
      selectedTagIds,
      setSelectedTagIds,
      selectedCourt,
      setSelectedCourt,
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

  const handlePublicProfileClick: NonNullable<MenuProps["onClick"]> = ({ key }) => {
    if (String(key) !== "login") return;
    void (async () => {
      try {
        await signInWithRedirect();
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown error";
        message.error("Unable to start login. Check local auth redirect configuration.");
        console.error("signInWithRedirect failed:", detail);
      }
    })();
  };

  const publicProfileItems: MenuProps["items"] = [{ key: "login", label: "Login" }];

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
        profileItems={publicProfileItems}
        onProfileClick={handlePublicProfileClick}
      />
      <Content className="app-content">
        <PublicContentRoutes
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

export default PublicApp;
