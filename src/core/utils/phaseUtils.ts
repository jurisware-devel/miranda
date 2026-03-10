import type { CasePhaseItem, PhaseItem } from "../types";

const PHASE_ORDER: PhaseItem[] = [
  "ARRAIGN_LCC",
  "PRELIM_HRG",
  "LOCAL_CRIMINAL_COURT",
  "GRAND_JURY",
  "SUPERIOR_CRIMINAL_COURT",
  "ARRAIGN_SCC",
  "DISCOVERY",
  "MOTIONS",
  "PRETRIAL_HEARINGS",
  "PLEA",
  "TRIAL",
  "SENTENCE",
];

const PHASE_ORDER_INDEX = new Map(PHASE_ORDER.map((phase, index) => [phase, index]));
const PHASE_LABELS: Record<PhaseItem, string> = {
  ARRAIGN_LCC: "Arraign (LCC)",
  PRELIM_HRG: "Prelim. Hrg.",
  LOCAL_CRIMINAL_COURT: "Local Criminal Court",
  GRAND_JURY: "Grand Jury",
  SUPERIOR_CRIMINAL_COURT: "Superior Criminal Court",
  ARRAIGN_SCC: "Arraign (SCC)",
  DISCOVERY: "Discovery",
  MOTIONS: "Motions",
  PRETRIAL_HEARINGS: "Pretrial Hearings",
  PLEA: "Plea",
  TRIAL: "Trial",
  SENTENCE: "Sentence",
};

export const getPhaseLabel = (phase: PhaseItem) => PHASE_LABELS[phase] ?? phase;

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
