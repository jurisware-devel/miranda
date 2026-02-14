import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type UseAppRouteUiOptions = {
  setSelectedAuthor: (value: string | null) => void;
  setSelectedTagIds: (value: string[]) => void;
  setNameQuery: (value: string) => void;
  setSortOrder: (value: string) => void;
};

export const useAppRouteUi = ({
  setSelectedAuthor,
  setSelectedTagIds,
  setNameQuery,
  setSortOrder,
}: UseAppRouteUiOptions) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isCaseView = location.pathname.startsWith("/case/");
  const isCasesPage = location.pathname === "/";

  useEffect(() => {
    if (!isCasesPage) return;
    const state = (location.state as { tagId?: string } | null) ?? null;
    if (!state?.tagId) return;
    setSelectedAuthor(null);
    setSelectedTagIds([state.tagId]);
    setNameQuery("");
    setSortOrder("date_desc");
    navigate(".", { replace: true, state: null });
  }, [
    isCasesPage,
    location.state,
    navigate,
    setNameQuery,
    setSelectedAuthor,
    setSelectedTagIds,
    setSortOrder,
  ]);

  return {
    isCaseView,
    isCasesPage,
    showFilters: isCasesPage || isCaseView,
    lockFilters: isCaseView,
    showPagination: isCasesPage,
  };
};
