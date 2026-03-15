#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { signIn } from "aws-amplify/auth";

const COURTS = [
  {
    id: "coa",
    label_short: "CoA",
    label_long: "NY Court of Appeals",
  },
  {
    id: "scotus",
    label_short: "SCOTUS",
    label_long: "Supreme Court of the United States",
  },
  {
    id: "ad3",
    label_short: "AD3",
    label_long: "Appellate Division, Third Department",
  },
  {
    id: "albany",
    label_short: "Albany",
    label_long: "Albany County",
  },
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const apply = args.has("--apply");

if ((dryRun && apply) || (!dryRun && !apply)) {
  console.error("Usage: node scripts/seed-courts.mjs --dry-run | --apply");
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

const listResult = await client.models.Court.list({ limit: 100, authMode });
if (listResult.errors?.length) {
  throw new Error(listResult.errors.map((err) => err.message).join("; "));
}

const existing = new Map((listResult.data ?? []).map((item) => [item.id, item]));
const missing = COURTS.filter((court) => !existing.has(court.id));
const updates = COURTS.filter((court) => {
  const current = existing.get(court.id);
  return (
    current &&
    (current.label_short !== court.label_short || current.label_long !== court.label_long)
  );
});

console.log(`Known courts: ${COURTS.length}`);
console.log(`Existing courts: ${existing.size}`);
console.log(`Missing courts: ${missing.length}`);
console.log(`Out-of-date courts: ${updates.length}`);

if (dryRun) {
  if (missing.length) {
    console.log("Would create:");
    for (const court of missing) {
      console.log(`  - ${court.id}: ${court.label_short} / ${court.label_long}`);
    }
  }
  if (updates.length) {
    console.log("Would update:");
    for (const court of updates) {
      const current = existing.get(court.id);
      console.log(
        `  - ${court.id}: short ${JSON.stringify(current?.label_short)} -> ${JSON.stringify(court.label_short)}, long ${JSON.stringify(current?.label_long)} -> ${JSON.stringify(court.label_long)}`,
      );
    }
  }
  process.exit(0);
}

let created = 0;
let updated = 0;
let failed = 0;

for (const court of missing) {
  try {
    const result = await client.models.Court.create(court, { authMode });
    if (result.errors?.length) {
      throw new Error(result.errors.map((err) => err.message).join("; "));
    }
    created += 1;
  } catch (err) {
    failed += 1;
    console.error(
      `Create failed for ${court.id}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

for (const court of updates) {
  try {
    const result = await client.models.Court.update(court, { authMode });
    if (result.errors?.length) {
      throw new Error(result.errors.map((err) => err.message).join("; "));
    }
    updated += 1;
  } catch (err) {
    failed += 1;
    console.error(
      `Update failed for ${court.id}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

console.log(`Created: ${created}`);
console.log(`Updated: ${updated}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
