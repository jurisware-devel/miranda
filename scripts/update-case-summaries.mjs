import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { signIn } from "aws-amplify/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const yearArg = process.argv[2];
if (!yearArg) {
  console.error("Usage: node scripts/update-case-summaries.mjs <year>");
  process.exit(1);
}

const summaryPath = path.join(
  repoRoot,
  "public",
  "texts",
  "coa",
  yearArg,
  "summary.json",
);

const outputsPath = path.join(repoRoot, "amplify_outputs.json");
const outputs = JSON.parse(await readFile(outputsPath, "utf-8"));
Amplify.configure(outputs);
const client = generateClient();

const username = process.env.AMPLIFY_USERNAME;
const password = process.env.AMPLIFY_PASSWORD;
if (!username || !password) {
  throw new Error(
    "Missing AMPLIFY_USERNAME or AMPLIFY_PASSWORD in environment",
  );
}

await signIn({ username, password });

const summaries = JSON.parse(await readFile(summaryPath, "utf-8"));

if (!Array.isArray(summaries)) {
  throw new Error("summary.json must be an array");
}

const dryRun = process.env.DRY_RUN === "1";
const prefix = "**Caution: AI Generated**\n";

let updated = 0;
let skipped = 0;
let failed = 0;
let missing = 0;
let processed = 0;

for (const entry of summaries) {
  processed += 1;
  const caseId = entry?.caseId;
  const summary = entry?.summary;
  if (!caseId || typeof summary !== "string") {
    skipped += 1;
    console.log(`Skip invalid entry at index ${processed - 1}`);
    continue;
  }

  const prefixedSummary = summary.startsWith(prefix)
    ? summary
    : `${prefix}${summary}`;

  if (dryRun) {
    console.log(`[DRY RUN] Would update ${caseId}`);
    updated += 1;
    continue;
  }

  try {
    const existing = await client.models.Case.get({ caseId });
    if (!existing?.data) {
      missing += 1;
      console.log(`Missing caseId ${caseId}; not updated`);
      continue;
    }

    const { errors } = await client.models.Case.update({
      caseId,
      summary: prefixedSummary,
    });

    if (errors?.length) {
      failed += 1;
      console.log(
        `Failed ${caseId}: ${errors.map((err) => err.message).join("; ")}`,
      );
    } else {
      updated += 1;
    }
  } catch (err) {
    failed += 1;
    console.log(`Failed ${caseId}:`, err instanceof Error ? err.message : err);
  }

  if (processed % 25 === 0) {
    console.log(
      `Progress ${processed}/${summaries.length} (updated ${updated}, missing ${missing}, skipped ${skipped}, failed ${failed})`,
    );
  }
}

console.log(
  `Done. Updated ${updated}, missing ${missing}, skipped ${skipped}, failed ${failed}.`,
);
