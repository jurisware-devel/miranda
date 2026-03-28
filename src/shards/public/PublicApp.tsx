import React, { useMemo, useState } from "react";
import { Grid, Layout } from "antd";
import type { MenuProps } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import AppFooter from "../../components/public/Footer";
import AppHeader from "../../components/public/Header";
import CaseDetailNav from "../../components/public/CaseDetailNav";
import PublicContentRoutes from "../../components/public/ContentRoutes";
import { useCourtsData } from "../../core/hooks/useCourtsData";
import type { CaseFilterControls } from "../../core/filterControls";
import { mapCasePhasesByCaseId, mapPhasesById } from "../../core/utils/phaseUtils";
import { mapCourtsById } from "../../core/utils/caseUtils";
import { mapCaseTagsByCaseId, mapTagsById } from "../../core/utils/tagUtils";
import { usePublicCaseFilters } from "./hooks/usePublicCaseFilters";
import { usePublicCasesData } from "./hooks/usePublicCasesData";
import { usePublicRouteUi } from "./hooks/usePublicRouteUi";
import { usePublicTagsData } from "./hooks/usePublicTagsData";

const { Content } = Layout;

const PublicApp: React.FC = () => {
  const { cases, loading, error } = usePublicCasesData(true);
  const { courts, loading: courtsLoading, error: courtsError } = useCourtsData({
    enabled: true,
    authMode: "iam",
  });
  const { tags, phases, caseTags, casePhases, tagsError, phasesError, caseTagsError, casePhasesError } =
    usePublicTagsData(true);
  const {
    phaseOptions,
    selectedPhase,
    setSelectedPhase,
    selectedTagIds,
    setSelectedTagIds,
    courtOptions,
    selectedCourt,
    setSelectedCourt,
    publicationStatusOptions,
    selectedPublicationStatus,
    setSelectedPublicationStatus,
    nameQuery,
    setNameQuery,
    sortOrder,
    setSortOrder,
    currentPage,
    setCurrentPage,
    pageSize,
    filteredCases,
    pagedCases,
  } = usePublicCaseFilters(cases, courts, phases, casePhases, caseTags);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const isXlUp = Boolean(screens.xl);
  const location = useLocation();
  const navigate = useNavigate();

  const { showFilters, lockFilters, showPagination } = usePublicRouteUi({
    setSelectedPhase,
    setSelectedTagIds,
    setNameQuery,
    setSortOrder,
    setSelectedCourt,
    setSelectedPublicationStatus,
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
      publicationStatusOptions,
      selectedPhase,
      onPhaseChange: setSelectedPhase,
      selectedTagIds,
      onTagChange: setSelectedTagIds,
      selectedCourt,
      onCourtChange: setSelectedCourt,
      selectedPublicationStatus,
      onPublicationStatusChange: setSelectedPublicationStatus,
      nameQuery,
      onNameQueryChange: setNameQuery,
      sortOrder,
      onSortOrderChange: setSortOrder,
    }),
    [
      phaseOptions,
      courtOptions,
      publicationStatusOptions,
      selectedPhase,
      setSelectedPhase,
      selectedTagIds,
      setSelectedTagIds,
      selectedCourt,
      setSelectedCourt,
      selectedPublicationStatus,
      setSelectedPublicationStatus,
      nameQuery,
      setNameQuery,
      sortOrder,
      setSortOrder,
    ],
  );

  const activeCaseId = useMemo(() => {
    if (!location.pathname.startsWith("/pub/case/")) return null;
    return decodeURIComponent(location.pathname.slice("/pub/case/".length));
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
      onBack={() => navigate("/pub")}
      onPrevious={() => prevCase && navigate(`/pub/case/${prevCase.caseId}`)}
      onNext={() => nextCase && navigate(`/pub/case/${nextCase.caseId}`)}
    />
  ) : null;

  const handlePublicProfileClick: NonNullable<MenuProps["onClick"]> = ({ key }) => {
    if (String(key) !== "login") return;
    navigate("/pub/login");
  };

  const publicProfileItems: MenuProps["items"] = [{ key: "login", label: "Sign In" }];

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
          error={error ?? courtsError}
          tagsError={tagsError}
          phasesError={phasesError}
          caseTagsError={caseTagsError}
          casePhasesError={casePhasesError}
          loading={loading || courtsLoading}
          cases={cases}
          courtsById={courtsById}
          pagedCases={pagedCases}
          tagsById={tagsById}
          caseTagsByCaseId={caseTagsByCaseId}
          casePhasesByCaseId={casePhasesByCaseId}
          phasesById={phasesById}
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
