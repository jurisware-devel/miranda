import React, { useMemo, useState } from "react";
import { Grid, Layout } from "antd";
import type { MenuProps } from "antd";
import { signOut } from "aws-amplify/auth";
import { useLocation, useNavigate } from "react-router-dom";
import AdminContentRoutes from "../../components/AdminContentRoutes";
import AdminCaseDetailNav from "../../components/AdminCaseDetailNav";
import AdminShellFooter from "../../components/AdminShellFooter";
import AdminShellHeader from "../../components/AdminShellHeader";
import type { CaseFilterControls } from "../../core/filterControls";
import type { AppCapabilities } from "../../core/types";
import { mapCaseTagsByCaseId, mapTagsById } from "../../core/utils/tagUtils";
import { useAdminCaseFilters } from "./hooks/useAdminCaseFilters";
import { useAdminCasesData } from "./hooks/useAdminCasesData";
import { useAdminTagsData } from "./hooks/useAdminTagsData";
import { useAdminRouteUi } from "./hooks/useAdminRouteUi";

const { Content } = Layout;

type AdminAppProps = {
  capabilities: AppCapabilities;
};

const AdminApp: React.FC<AdminAppProps> = ({ capabilities }) => {
  const { cases, loading, error } = useAdminCasesData(capabilities.isResolved);
  const { tags, caseTags, setCaseTags, tagsError, caseTagsError } = useAdminTagsData(
    capabilities.isResolved,
  );
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
  } = useAdminCaseFilters(cases, tags, caseTags);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const isXlUp = Boolean(screens.xl);
  const location = useLocation();
  const navigate = useNavigate();

  const { showFilters, lockFilters, showPagination } = useAdminRouteUi({
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
    if (!location.pathname.startsWith("/admin/case/")) return null;
    return decodeURIComponent(location.pathname.slice("/admin/case/".length));
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
    <AdminCaseDetailNav
      className="case-detail__bar--footer"
      hasPrevious={Boolean(prevCase)}
      hasNext={Boolean(nextCase)}
      onBack={() => navigate("/admin")}
      onPrevious={() => prevCase && navigate(`/admin/case/${prevCase.caseId}`)}
      onNext={() => nextCase && navigate(`/admin/case/${nextCase.caseId}`)}
    />
  ) : null;

  const handleSignedInProfileClick: NonNullable<MenuProps["onClick"]> = ({ key }) => {
    if (key === "settings") {
      navigate("/admin/settings");
      return;
    }
    if (key === "signout") {
      void signOut();
    }
  };

  const signedInProfileItems: MenuProps["items"] = [
    { key: "settings", label: "Settings" },
    { key: "signout", label: "Sign Out" },
  ];

  return (
    <Layout className="app-shell app-shell--admin" style={{ background: "transparent" }}>
      <AdminShellHeader
        showFilters={showFilters}
        lockFilters={lockFilters}
        isXlUp={isXlUp}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        onCloseFilters={() => setFiltersOpen(false)}
        filters={filters}
        profileItems={signedInProfileItems}
        onProfileClick={handleSignedInProfileClick}
      />
      <Content className="app-content">
        <AdminContentRoutes
          capabilities={capabilities}
          isXlUp={isXlUp}
          error={error}
          tagsError={tagsError}
          caseTagsError={caseTagsError}
          loading={loading}
          cases={cases}
          tags={tags}
          caseTags={caseTags}
          setCaseTags={setCaseTags}
          pagedCases={pagedCases}
          tagsById={tagsById}
          caseTagsByCaseId={caseTagsByCaseId}
          filters={filters}
        />
      </Content>
      <AdminShellFooter
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

export default AdminApp;
