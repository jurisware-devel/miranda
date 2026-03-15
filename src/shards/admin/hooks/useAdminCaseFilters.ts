import { useEffect, useMemo, useState } from "react";
import type { CaseItem, CasePhaseItem, CaseTagItem, CourtItem, PhaseItem } from "../../../core/types";
import { getCourtBadgeLabel, getCourtCode, mapCourtsById } from "../../../core/utils/caseUtils";

export const useAdminCaseFilters = (
  cases: CaseItem[],
  courts: CourtItem[],
  phases: PhaseItem[],
  casePhases: CasePhaseItem[],
  caseTags: CaseTagItem[],
) => {
  const [selectedPhase, setSelectedPhaseInternal] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIdsInternal] = useState<string[]>([]);
  const [selectedCourt, setSelectedCourtInternal] = useState<string | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [debouncedNameQuery, setDebouncedNameQuery] = useState("");
  const [sortOrder, setSortOrderInternal] = useState("date_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  const courtsById = useMemo(() => mapCourtsById(courts), [courts]);
  const phaseOptions = useMemo(
    () =>
      phases
        .slice()
        .sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER))
        .map((phase) => ({ value: phase.phaseId, label: phase.label })),
    [phases],
  );

  const courtOptions = useMemo(() => {
    const seen = new Set<string>();
    return cases
      .map((item) => getCourtCode(item.court))
      .filter((courtId) => {
        if (!courtId || seen.has(courtId)) return false;
        seen.add(courtId);
        return true;
      })
      .sort()
      .map((courtId) => ({
        value: courtId,
        label: getCourtBadgeLabel(courtId, courtsById),
      }));
  }, [cases, courtsById]);

  const casePhaseIdsByCaseId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of casePhases) {
      if (!map.has(item.caseId)) {
        map.set(item.caseId, new Set());
      }
      map.get(item.caseId)?.add(item.phaseId);
    }
    return map;
  }, [casePhases]);

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
        return sortOrder === "name_asc" ? aName.localeCompare(bName) : bName.localeCompare(aName);
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
      if (selectedPhase) {
        if (casePhaseIdsByCaseId.size === 0) return false;
        const phaseIds = casePhaseIdsByCaseId.get(item.caseId);
        if (!phaseIds || !phaseIds.has(selectedPhase)) return false;
      }
      if (selectedCourt && getCourtCode(item.court) !== selectedCourt) {
        return false;
      }
      if (selectedTagIds.length) {
        if (caseTagIdsByCaseId.size === 0) return false;
        const tagIds = caseTagIdsByCaseId.get(item.caseId);
        if (!tagIds) return false;
        const matchesAll = selectedTagIds.every((tagId) => tagIds.has(tagId));
        if (!matchesAll) return false;
      }
      if (!query) return true;
      return (item.caseName ?? "").toLowerCase().includes(query);
    });
  }, [sortedCases, selectedPhase, selectedCourt, selectedTagIds, debouncedNameQuery, casePhaseIdsByCaseId, caseTagIdsByCaseId]);

  const setSelectedPhase = (value: string | null) => {
    setSelectedPhaseInternal(value);
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
    phaseOptions,
    courtOptions,
    selectedPhase,
    setSelectedPhase,
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
