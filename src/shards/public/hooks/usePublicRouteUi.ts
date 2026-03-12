import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type UsePublicRouteUiOptions = {
  setSelectedPhase: (value: string | null) => void;
  setSelectedTagIds: (value: string[]) => void;
  setNameQuery: (value: string) => void;
  setSelectedCourt: (value: string | null) => void;
  setSortOrder: (value: string) => void;
};

export const usePublicRouteUi = ({
  setSelectedPhase,
  setSelectedTagIds,
  setNameQuery,
  setSortOrder,
  setSelectedCourt,
}: UsePublicRouteUiOptions) => {
  const location = useLocation();
  const navigate = useNavigate();
  const casesPath = "/pub";
  const casePrefix = "/pub/case/";

  const isCaseView = location.pathname.startsWith(casePrefix);
  const isCasesPage = location.pathname === casesPath;

  useEffect(() => {
    if (!isCasesPage) return;
    const state = (location.state as { tagId?: string } | null) ?? null;
    if (!state?.tagId) return;
    setSelectedPhase(null);
    setSelectedTagIds([state.tagId]);
    setNameQuery("");
    setSelectedCourt(null);
    setSortOrder("date_desc");
    navigate(casesPath, { replace: true, state: null });
  }, [
    isCasesPage,
    location.state,
    navigate,
    setNameQuery,
    setSelectedPhase,
    setSelectedTagIds,
    setSortOrder,
    setSelectedCourt,
  ]);

  return {
    isCaseView,
    isCasesPage,
    showFilters: isCasesPage || isCaseView,
    lockFilters: isCaseView,
    showPagination: isCasesPage,
  };
};
