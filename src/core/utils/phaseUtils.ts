import type { CasePhaseItem, PhaseId, PhaseItem } from "../types";

const PHASE_ORDER: PhaseId[] = [
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
const DEFAULT_PHASE_LABELS: Record<PhaseId, string> = {
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

export const mapPhasesById = (phases: PhaseItem[]) =>
  new Map(phases.map((phase) => [phase.phaseId, phase.label]));

export const getPhaseLabel = (phaseId: PhaseId, phasesById?: Map<string, string>) =>
  phasesById?.get(phaseId) ?? DEFAULT_PHASE_LABELS[phaseId] ?? phaseId;

export const mapCasePhasesByCaseId = (casePhases: CasePhaseItem[]) => {
  const byCase = new Map<string, PhaseId[]>();

  for (const item of casePhases) {
    if (!byCase.has(item.caseId)) {
      byCase.set(item.caseId, []);
    }
    const phases = byCase.get(item.caseId);
    if (!phases) continue;
    if (!phases.includes(item.phaseId)) {
      phases.push(item.phaseId);
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
