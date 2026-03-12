#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { signIn } from "aws-amplify/auth";

const PHASES = [
  { phaseId: "INVEST_ARREST", label: "Invest/Arrest", sort_order: 10 },
  { phaseId: "YOUTH_PART", label: "Youth Part", sort_order: 20 },
  { phaseId: "REMOVAL_YOUTH_PART", label: "Removal (Youth Part)", sort_order: 30 },
  { phaseId: "LOCAL_CRIMINAL_COURT", label: "Local Criminal Court", sort_order: 40 },
  { phaseId: "ARRAIGN_LCC", label: "Arraign (LCC)", sort_order: 50 },
  { phaseId: "PRELIM_HRG", label: "Prelim. Hrg.", sort_order: 60 },
  { phaseId: "GRAND_JURY", label: "Grand Jury", sort_order: 70 },
  { phaseId: "SUPERIOR_CRIMINAL_COURT", label: "Superior Criminal Court", sort_order: 80 },
  { phaseId: "ARRAIGN_SCC", label: "Arraign (SCC)", sort_order: 90 },
  { phaseId: "DISCOVERY", label: "Discovery", sort_order: 100 },
  { phaseId: "MOTIONS", label: "Motions", sort_order: 110 },
  { phaseId: "PRETRIAL_HEARINGS", label: "Pretrial Hearings", sort_order: 120 },
  { phaseId: "SUPP_HEARING", label: "Supp. Hearing", sort_order: 130 },
  { phaseId: "PLEA", label: "Plea", sort_order: 140 },
  { phaseId: "TRIAL", label: "Trial", sort_order: 150 },
  { phaseId: "SENTENCE", label: "Sentence", sort_order: 160 },
  { phaseId: "APPEAL", label: "Appeal", sort_order: 170 },
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const apply = args.has("--apply");

if ((dryRun && apply) || (!dryRun && !apply)) {
  console.error("Usage: node scripts/seed-phases.mjs --dry-run | --apply");
  process.exit(2);
}

const outputsPath = path.join(repoRoot, "amplify_outputs.json");
const outputs = JSON.parse(await readFile(outputsPath, "utf-8"));
Amplify.configure(outputs);

const client = generateClient();

const username = process.env.AMPLIFY_USERNAME;
const password = process.env.AMPLIFY_PASSWORD;
const authMode = apply ? "userPool" : "iam";

if (apply) {
  if (!username || !password) {
    console.error("For --apply, set AMPLIFY_USERNAME and AMPLIFY_PASSWORD env vars.");
    process.exit(2);
  }
  await signIn({ username, password });
}

const listResult = await client.models.Phase.list({ limit: 5000, authMode });
if (listResult.errors?.length) {
  throw new Error(listResult.errors.map((err) => err.message).join("; "));
}

const existing = new Map((listResult.data ?? []).map((item) => [item.phaseId, item]));
const knownById = new Map(PHASES.map((phase) => [phase.phaseId, phase]));
const missing = PHASES.filter((phase) => !existing.has(phase.phaseId));
const knownReorder = PHASES.filter((phase) => {
  const current = existing.get(phase.phaseId);
  return current && current.sort_order !== phase.sort_order;
});
const unknownExisting = [...existing.values()]
  .filter((phase) => !knownById.has(phase.phaseId))
  .sort((a, b) =>
    (a.label ?? a.phaseId).localeCompare(b.label ?? b.phaseId, undefined, { sensitivity: "base" }),
  );
const nextSortBase = PHASES.reduce((max, phase) => Math.max(max, phase.sort_order), 0);
const unknownAssignments = unknownExisting.map((phase, index) => ({
  phaseId: phase.phaseId,
  label: phase.label,
  sort_order: nextSortBase + (index + 1) * 10,
}));
const unknownReorder = unknownAssignments.filter((phase) => {
  const current = existing.get(phase.phaseId);
  return current && current.sort_order !== phase.sort_order;
});
const reorder = [...knownReorder, ...unknownReorder];

console.log(`Known phases: ${PHASES.length}`);
console.log(`Existing phases: ${existing.size}`);
console.log(`Missing phases: ${missing.length}`);
console.log(`Unknown existing phases: ${unknownExisting.length}`);
console.log(`Reorder needed: ${reorder.length} (${knownReorder.length} known, ${unknownReorder.length} unknown)`);

if (dryRun) {
  if (missing.length) {
    console.log("Would create:");
    for (const phase of missing) {
      console.log(`  - ${phase.phaseId}: ${phase.label}`);
    }
  }
  if (reorder.length) {
    console.log("Would reorder:");
    for (const phase of reorder) {
      const current = existing.get(phase.phaseId);
      console.log(
        `  - ${phase.phaseId}: ${String(current?.sort_order ?? "null")} -> ${phase.sort_order}`,
      );
    }
  }
  process.exit(0);
}

let created = 0;
let updated = 0;
let failed = 0;

for (const phase of missing) {
  try {
    const result = await client.models.Phase.create(phase, { authMode });
    if (result.errors?.length) {
      throw new Error(result.errors.map((err) => err.message).join("; "));
    }
    created += 1;
  } catch (err) {
    failed += 1;
    console.error(
      `Create failed for ${phase.phaseId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

for (const phase of reorder) {
  try {
    const result = await client.models.Phase.update(phase, { authMode });
    if (result.errors?.length) {
      throw new Error(result.errors.map((err) => err.message).join("; "));
    }
    updated += 1;
  } catch (err) {
    failed += 1;
    console.error(
      `Update failed for ${phase.phaseId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

console.log(`Created: ${created}`);
console.log(`Updated: ${updated}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
