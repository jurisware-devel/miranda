import { useEffect, useMemo, useState } from "react";
import type { CaseItem, CaseTagItem, TagItem } from "../types";
import { buildTagOptions } from "../tagUtils";
import { getCourtCode } from "../caseUtils";

const COURT_FILTER_OPTIONS = [
  { value: "scotus", label: "SCOTUS" },
  { value: "coa", label: "Ct. of Appeals" },
  { value: "ad3", label: "3d Dept" },
  { value: "albany", label: "Albany County" },
];

export const useCaseFilters = (
  cases: CaseItem[],
  tags: TagItem[],
  caseTags: CaseTagItem[],
) => {
  const [selectedAuthor, setSelectedAuthorInternal] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIdsInternal] = useState<string[]>([]);
  const [selectedCourt, setSelectedCourtInternal] = useState<string | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [debouncedNameQuery, setDebouncedNameQuery] = useState("");
  const [sortOrder, setSortOrderInternal] = useState("date_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  const judgeToCourts = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of cases) {
      const judge = item.authoringJudge;
      if (!judge || judge === "Memorandum") {
        continue;
      }
      if (!map.has(judge)) {
        map.set(judge, new Set());
      }
      map.get(judge)?.add(getCourtCode(item.court));
    }
    return map;
  }, [cases]);

  const courtToJudges = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of cases) {
      const judge = item.authoringJudge;
      if (!judge || judge === "Memorandum") {
        continue;
      }
      const courtCode = getCourtCode(item.court);
      if (!map.has(courtCode)) {
        map.set(courtCode, new Set());
      }
      map.get(courtCode)?.add(judge);
    }
    return map;
  }, [cases]);

  const authorOptions = useMemo(() => {
    const candidates = selectedCourt
      ? Array.from(courtToJudges.get(selectedCourt) ?? [])
      : Array.from(judgeToCourts.keys());

    const options = candidates
      .sort()
      .map((value) => ({ value, label: value }));

    const perCuriamIndex = options.findIndex((option) => option.value === "Per Curiam");
    if (perCuriamIndex > 0) {
      const [perCuriam] = options.splice(perCuriamIndex, 1);
      options.unshift(perCuriam);
    }
    return options;
  }, [selectedCourt, courtToJudges, judgeToCourts]);

  const tagOptions = useMemo(() => {
    return buildTagOptions(tags);
  }, [tags]);

  const courtOptions = useMemo(() => {
    if (!selectedAuthor) return COURT_FILTER_OPTIONS;

    const authorCourts = judgeToCourts.get(selectedAuthor) ?? new Set<string>();
    return COURT_FILTER_OPTIONS.filter((option) => authorCourts.has(option.value));
  }, [selectedAuthor, judgeToCourts]);

  const caseTagIdsByCaseId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of caseTags) {
      if (!map.has(item.caseId)) {
        map.set(item.caseId, new Set());
      }
      map.get(item.caseId)?.add(item.tagId);
    }
    return map;
  }, [caseTags]);

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
      if (selectedCourt && getCourtCode(item.court) !== selectedCourt) {
        return false;
      }
      if (selectedTagIds.length) {
        if (caseTagIdsByCaseId.size === 0) {
          return false;
        }
        const tagIds = caseTagIdsByCaseId.get(item.caseId);
        if (!tagIds) return false;
        const matchesAll = selectedTagIds.every((tagId) => tagIds.has(tagId));
        if (!matchesAll) return false;
      }
      if (!query) return true;
      return (item.caseName ?? "").toLowerCase().includes(query);
    });
  }, [sortedCases, selectedAuthor, selectedCourt, selectedTagIds, debouncedNameQuery, caseTagIdsByCaseId]);

  const setSelectedAuthor = (value: string | null) => {
    setSelectedAuthorInternal(value);
    setCurrentPage(1);
  };

  const setSelectedTagIds = (value: string[]) => {
    setSelectedTagIdsInternal(value);
    setCurrentPage(1);
  };

  const setSelectedCourt = (value: string | null) => {
    setSelectedCourtInternal(value);
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
    tagOptions,
    courtOptions,
    selectedAuthor,
    setSelectedAuthor,
    selectedTagIds,
    setSelectedTagIds,
    selectedCourt,
    setSelectedCourt,
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
