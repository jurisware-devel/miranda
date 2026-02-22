import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type UseAdminRouteUiOptions = {
  setSelectedAuthor: (value: string | null) => void;
  setSelectedTagIds: (value: string[]) => void;
  setNameQuery: (value: string) => void;
  setSelectedCourt: (value: string | null) => void;
  setSortOrder: (value: string) => void;
};

export const useAdminRouteUi = ({
  setSelectedAuthor,
  setSelectedTagIds,
  setNameQuery,
  setSortOrder,
  setSelectedCourt,
}: UseAdminRouteUiOptions) => {
  const location = useLocation();
  const navigate = useNavigate();
  const casesPath = "/admin";
  const casePrefix = "/admin/case/";

  const isCaseView = location.pathname.startsWith(casePrefix);
  const isCasesPage = location.pathname === casesPath;

  useEffect(() => {
    if (!isCasesPage) return;
    const state = (location.state as { tagId?: string } | null) ?? null;
    if (!state?.tagId) return;
    setSelectedAuthor(null);
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
    setSelectedAuthor,
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
