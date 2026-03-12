#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { signIn } from "aws-amplify/auth";

const PHASES = [
  { phaseId: "ARRAIGN_LCC", label: "Arraign (LCC)" },
  { phaseId: "PRELIM_HRG", label: "Prelim. Hrg." },
  { phaseId: "LOCAL_CRIMINAL_COURT", label: "Local Criminal Court" },
  { phaseId: "GRAND_JURY", label: "Grand Jury" },
  { phaseId: "SUPERIOR_CRIMINAL_COURT", label: "Superior Criminal Court" },
  { phaseId: "ARRAIGN_SCC", label: "Arraign (SCC)" },
  { phaseId: "DISCOVERY", label: "Discovery" },
  { phaseId: "MOTIONS", label: "Motions" },
  { phaseId: "PRETRIAL_HEARINGS", label: "Pretrial Hearings" },
  { phaseId: "PLEA", label: "Plea" },
  { phaseId: "TRIAL", label: "Trial" },
  { phaseId: "SENTENCE", label: "Sentence" },
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
const missing = PHASES.filter((phase) => !existing.has(phase.phaseId));
const relabel = PHASES.filter((phase) => {
  const current = existing.get(phase.phaseId);
  return current && current.label !== phase.label;
});

console.log(`Known phases: ${PHASES.length}`);
console.log(`Existing phases: ${existing.size}`);
console.log(`Missing phases: ${missing.length}`);
console.log(`Relabel needed: ${relabel.length}`);

if (dryRun) {
  if (missing.length) {
    console.log("Would create:");
    for (const phase of missing) {
      console.log(`  - ${phase.phaseId}: ${phase.label}`);
    }
  }
  if (relabel.length) {
    console.log("Would relabel:");
    for (const phase of relabel) {
      const current = existing.get(phase.phaseId);
      console.log(`  - ${phase.phaseId}: "${current?.label ?? ""}" -> "${phase.label}"`);
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

for (const phase of relabel) {
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

