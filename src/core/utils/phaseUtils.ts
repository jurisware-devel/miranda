import type { CasePhaseItem, PhaseItem } from "../types";

const PHASE_ORDER: PhaseItem[] = [
  "Arraign (LCC)",
  "Prelim. Hrg.",
  "Local Criminal Court",
  "Grand Jury",
  "Superior Criminal Court",
  "Arraign (SCC)",
  "Discovery",
  "Motions",
  "Pretrial Hearings",
  "Plea",
  "Trial",
  "Sentence",
];

const PHASE_ORDER_INDEX = new Map(PHASE_ORDER.map((phase, index) => [phase, index]));

export const mapCasePhasesByCaseId = (casePhases: CasePhaseItem[]) => {
  const byCase = new Map<string, PhaseItem[]>();

  for (const item of casePhases) {
    if (!byCase.has(item.caseId)) {
      byCase.set(item.caseId, []);
    }
    const phases = byCase.get(item.caseId);
    if (!phases) continue;
    if (!phases.includes(item.phase)) {
      phases.push(item.phase);
    }
  }

  for (const [caseId, phases] of byCase.entries()) {
    const sorted = [...phases].sort(
      (a, b) => (PHASE_ORDER_INDEX.get(a) ?? Number.MAX_SAFE_INTEGER) - (PHASE_ORDER_INDEX.get(b) ?? Number.MAX_SAFE_INTEGER),
    );
    byCase.set(caseId, sorted);
  }

  return byCase;
};
