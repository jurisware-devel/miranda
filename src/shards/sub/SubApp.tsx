import React, { useMemo, useState } from "react";
import { Grid, Layout } from "antd";
import type { MenuProps } from "antd";
import { signOut } from "aws-amplify/auth";
import { useLocation, useNavigate } from "react-router-dom";
import SubCaseDetailNav from "../../components/SubCaseDetailNav";
import SubContentRoutes from "../../components/SubContentRoutes";
import SubFooter from "../../components/SubFooter";
import SubHeader from "../../components/SubHeader";
import type { CaseFilterControls } from "../../core/filterControls";
import { mapCasePhasesByCaseId } from "../../core/utils/phaseUtils";
import { mapCaseTagsByCaseId, mapTagsById } from "../../core/utils/tagUtils";
import { useSubCaseFilters } from "./hooks/useSubCaseFilters";
import { useSubCasesData } from "./hooks/useSubCasesData";
import { useSubRouteUi } from "./hooks/useSubRouteUi";
import { useSubTagsData } from "./hooks/useSubTagsData";

const { Content } = Layout;

type SubAppProps = {
  enableData: boolean;
};

const SubApp: React.FC<SubAppProps> = ({ enableData }) => {
  const { cases, loading, error } = useSubCasesData(enableData);
  const { tags, caseTags, casePhases, tagsError, caseTagsError, casePhasesError } =
    useSubTagsData(enableData);
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
  } = useSubCaseFilters(cases, tags, caseTags);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const isXlUp = Boolean(screens.xl);
  const location = useLocation();
  const navigate = useNavigate();

  const { showFilters, lockFilters, showPagination } = useSubRouteUi({
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
  const casePhasesByCaseId = useMemo(() => mapCasePhasesByCaseId(casePhases), [casePhases]);
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
    if (!location.pathname.startsWith("/sub/case/")) return null;
    return decodeURIComponent(location.pathname.slice("/sub/case/".length));
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
    <SubCaseDetailNav
      className="case-detail__bar--footer"
      hasPrevious={Boolean(prevCase)}
      hasNext={Boolean(nextCase)}
      onBack={() => navigate("/sub")}
      onPrevious={() => prevCase && navigate(`/sub/case/${prevCase.caseId}`)}
      onNext={() => nextCase && navigate(`/sub/case/${nextCase.caseId}`)}
    />
  ) : null;

  const handleSignedInProfileClick: NonNullable<MenuProps["onClick"]> = ({ key }) => {
    if (key === "settings") {
      navigate("/sub/settings");
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
    <Layout className="app-shell app-shell--sub" style={{ background: "transparent" }}>
      <SubHeader
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
        <SubContentRoutes
          error={error}
          tagsError={tagsError}
          caseTagsError={caseTagsError}
          casePhasesError={casePhasesError}
          loading={loading}
          cases={cases}
          pagedCases={pagedCases}
          tagsById={tagsById}
          caseTagsByCaseId={caseTagsByCaseId}
          casePhasesByCaseId={casePhasesByCaseId}
          filters={filters}
          isXlUp={isXlUp}
        />
      </Content>
      <SubFooter
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

export default SubApp;
