import { useEffect, useMemo, useState } from "react";
import type { CaseItem } from "../types";

export const useCaseFilters = (cases: CaseItem[]) => {
  const [selectedAuthor, setSelectedAuthorInternal] = useState<string | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [debouncedNameQuery, setDebouncedNameQuery] = useState("");
  const [sortOrder, setSortOrderInternal] = useState("date_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  const authorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of cases) {
      if (item.authoringJudge) set.add(item.authoringJudge);
    }
    set.delete("Memorandum");
    const options = Array.from(set)
      .sort()
      .map((value) => ({ value, label: value }));
    const perCuriamIndex = options.findIndex((option) => option.value === "Per Curiam");
    if (perCuriamIndex > 0) {
      const [perCuriam] = options.splice(perCuriamIndex, 1);
      options.unshift(perCuriam);
    }
    return options;
  }, [cases]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedNameQuery(nameQuery);
    }, 300);
    return () => clearTimeout(handle);
  }, [nameQuery]);

  const sortedCases = useMemo(() => {
    const sorted = [...cases];
    sorted.sort((a, b) => {
      if (sortOrder.startsWith("name")) {
        const aName = (a.caseName ?? "").toLowerCase();
        const bName = (b.caseName ?? "").toLowerCase();
        return sortOrder === "name_asc"
          ? aName.localeCompare(bName)
          : bName.localeCompare(aName);
      }
      const aDate = a.decisionDate ? Date.parse(a.decisionDate) : 0;
      const bDate = b.decisionDate ? Date.parse(b.decisionDate) : 0;
      return sortOrder === "date_asc" ? aDate - bDate : bDate - aDate;
    });
    return sorted;
  }, [cases, sortOrder]);

  const filteredCases = useMemo(() => {
    const query = debouncedNameQuery.trim().toLowerCase();
    return sortedCases.filter((item) => {
      if (selectedAuthor && item.authoringJudge !== selectedAuthor) {
        return false;
      }
      if (!query) return true;
      return (item.caseName ?? "").toLowerCase().includes(query);
    });
  }, [sortedCases, selectedAuthor, debouncedNameQuery]);

  const setSelectedAuthor = (value: string | null) => {
    setSelectedAuthorInternal(value);
    setCurrentPage(1);
  };

  const setSortOrder = (value: string) => {
    setSortOrderInternal(value);
    setCurrentPage(1);
  };

  const handleNameQueryChange = (value: string) => {
    setNameQuery(value);
    setCurrentPage(1);
  };

  const pagedCases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCases.slice(start, start + pageSize);
  }, [filteredCases, currentPage, pageSize]);

  return {
    authorOptions,
    selectedAuthor,
    setSelectedAuthor,
    nameQuery,
    setNameQuery: handleNameQueryChange,
    sortOrder,
    setSortOrder,
    currentPage,
    setCurrentPage,
    pageSize,
    filteredCases,
    pagedCases,
  };
};
