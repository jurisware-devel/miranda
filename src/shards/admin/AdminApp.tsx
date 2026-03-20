import React, { useMemo, useState } from "react";
import { Grid, Layout } from "antd";
import type { MenuProps } from "antd";
import { signOut } from "aws-amplify/auth";
import { useLocation, useNavigate } from "react-router-dom";
import AdminContentRoutes from "../../components/admin/ContentRoutes";
import AdminCaseDetailNav from "../../components/admin/CaseDetailNav";
import AdminShellFooter from "../../components/admin/Footer";
import AdminShellHeader from "../../components/admin/Header";
import { useCourtsData } from "../../core/hooks/useCourtsData";
import type { CaseFilterControls } from "../../core/filterControls";
import type { AppCapabilities } from "../../core/types";
import { mapCourtsById } from "../../core/utils/caseUtils";
import { mapCasePhasesByCaseId, mapPhasesById } from "../../core/utils/phaseUtils";
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
  const { courts, loading: courtsLoading, error: courtsError } = useCourtsData({
    enabled: capabilities.isResolved,
    authMode: "userPool",
  });
  const {
    tags,
    phases,
    caseTags,
    setCaseTags,
    casePhases,
    setCasePhases,
    tagsError,
    phasesError,
    caseTagsError,
    casePhasesError,
  } = useAdminTagsData(capabilities.isResolved);
  const {
    phaseOptions,
    selectedPhase,
    setSelectedPhase,
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
  } = useAdminCaseFilters(cases, courts, phases, casePhases, caseTags);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const isXlUp = Boolean(screens.xl);
  const location = useLocation();
  const navigate = useNavigate();

  const { showFilters, lockFilters, showPagination } = useAdminRouteUi({
    setSelectedPhase,
    setSelectedTagIds,
    setNameQuery,
    setSortOrder,
    setSelectedCourt,
  });

  const tagsById = useMemo(() => mapTagsById(tags), [tags]);
  const courtsById = useMemo(() => mapCourtsById(courts), [courts]);
  const caseTagsByCaseId = useMemo(
    () => mapCaseTagsByCaseId(caseTags, tagsById),
    [caseTags, tagsById],
  );
  const casePhasesByCaseId = useMemo(() => mapCasePhasesByCaseId(casePhases, phases), [casePhases, phases]);
  const phasesById = useMemo(() => mapPhasesById(phases), [phases]);
  const filters = useMemo<CaseFilterControls>(
    () => ({
      phaseOptions,
            courtOptions,
      selectedPhase,
      onPhaseChange: setSelectedPhase,
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
      phaseOptions,
            courtOptions,
      selectedPhase,
      setSelectedPhase,
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
      void signOut().finally(() => {
        navigate("/", { replace: true });
      });
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
          error={error ?? courtsError}
          tagsError={tagsError}
          phasesError={phasesError}
          caseTagsError={caseTagsError}
          casePhasesError={casePhasesError}
          loading={loading || courtsLoading}
          cases={cases}
          courts={courts}
          courtsById={courtsById}
          tags={tags}
          phases={phases}
          caseTags={caseTags}
          setCaseTags={setCaseTags}
          casePhases={casePhases}
          setCasePhases={setCasePhases}
          pagedCases={pagedCases}
          tagsById={tagsById}
          caseTagsByCaseId={caseTagsByCaseId}
          casePhasesByCaseId={casePhasesByCaseId}
          phasesById={phasesById}
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
