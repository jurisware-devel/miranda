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
const indexPath = path.join(
  repoRoot,
  "public",
  "texts",
  "coa",
  yearArg,
  "index.json",
);

const outputsPath = path.join(repoRoot, "amplify_outputs.json");
const outputs = JSON.parse(await readFile(outputsPath, "utf-8"));
Amplify.configure(outputs);
const client = generateClient();

const username = process.env.AMPLIFY_USERNAME;
const password = process.env.AMPLIFY_PASSWORD;

const summaries = JSON.parse(await readFile(summaryPath, "utf-8"));
const indexJson = JSON.parse(await readFile(indexPath, "utf-8"));

if (!Array.isArray(summaries)) {
  throw new Error("summary.json must be an array");
}
if (!Array.isArray(indexJson?.items)) {
  throw new Error("index.json must contain an items array");
}

const dryRun = process.env.DRY_RUN === "1";
const createMissing = process.env.CREATE_MISSING === "1";
const prefix = "**Caution: AI Generated**\n";
const authModeEnv = process.env.AUTH_MODE || "auto";
const normalizeAuthMode = (mode) => {
  if (!mode) return "auto";
  const lowered = String(mode).trim().toLowerCase();
  if (lowered === "identitypool") return "iam";
  if (lowered === "userpool") return "userPool";
  if (lowered === "iam") return "iam";
  if (lowered === "auto") return "auto";
  return mode;
};
const requestedAuthMode = normalizeAuthMode(authModeEnv);
const indexByCaseId = new Map(indexJson.items.map((item) => [item.caseId, item]));

const toNullable = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

const buildCreatePayload = (item, summary) => ({
  caseId: item.caseId,
  caseName: item.caseName ?? item.caseId,
  opinionUrl: item.opinionUrl ?? `/coa/${yearArg}/${item.caseId}.txt`,
  slipOp: toNullable(item.slipOp),
  ny3dCite: toNullable(item.ny3dCite),
  court: toNullable(item.court),
  decisionDate: toNullable(item.decisionDate),
  arguedDate: toNullable(item.arguedDate),
  correctedDate: toNullable(item.correctedDate),
  citation: toNullable(item.citation),
  lowerCourtCite: toNullable(item.lowerCourtCite),
  disposition: toNullable(item.disposition),
  authoringJudge: toNullable(item.authoringJudge),
  partiesCaption: toNullable(item.partiesCaption),
  statutesCited: Array.isArray(item.statutesCited) ? item.statutesCited : null,
  summary,
});

let updated = 0;
let created = 0;
let skipped = 0;
let failed = 0;
let missing = 0;
let processed = 0;

let authMode = requestedAuthMode;
let requestOptions = undefined;
const tryProbe = async (mode) => {
  const probeCaseId = summaries[0]?.caseId;
  if (!probeCaseId) return { ok: true, found: false };
  const options = mode ? { authMode: mode } : undefined;
  try {
    const probe = await client.models.Case.get({ caseId: probeCaseId }, options);
    if (probe?.errors?.length) {
      return { ok: false, error: probe.errors.map((err) => err.message).join("; ") };
    }
    return { ok: true, found: Boolean(probe?.data) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
};

if (requestedAuthMode === "userPool") {
  if (!username || !password) {
    throw new Error("AUTH_MODE=userPool requires AMPLIFY_USERNAME and AMPLIFY_PASSWORD");
  }
  await signIn({ username, password });
  authMode = "userPool";
  requestOptions = { authMode };
} else if (requestedAuthMode === "auto") {
  const probeOrder = ["iam", "userPool"];
  let selected = null;
  for (const mode of probeOrder) {
    if (mode === "userPool") {
      if (!username || !password) continue;
      try {
        await signIn({ username, password });
      } catch {
        continue;
      }
    }
    const result = await tryProbe(mode);
    if (result.ok) {
      selected = mode;
      console.log(`Selected authMode=${mode} (probe found=${result.found})`);
      break;
    }
  }
  if (!selected) {
    throw new Error("Could not authorize probe in auto mode (tried iam and userPool)");
  }
  authMode = selected;
  requestOptions = { authMode };
} else {
  authMode = requestedAuthMode;
  if (authMode === "userPool") {
    if (!username || !password) {
      throw new Error("AUTH_MODE=userPool requires AMPLIFY_USERNAME and AMPLIFY_PASSWORD");
    }
    await signIn({ username, password });
  }
  requestOptions = { authMode };
}

const probeCaseId = summaries[0]?.caseId;
if (probeCaseId) {
  const probe = await client.models.Case.get({ caseId: probeCaseId }, requestOptions);
  if (probe?.errors?.length) {
    throw new Error(
      `Probe query failed for ${probeCaseId} using authMode=${authMode}: ${probe.errors
        .map((err) => err.message)
        .join("; ")}`,
    );
  }
  console.log(
    `Probe ${probeCaseId} with authMode=${authMode}: ${probe?.data ? "found" : "not found"}`,
  );
}

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
    const existing = await client.models.Case.get({ caseId }, requestOptions);
    if (existing?.errors?.length) {
      failed += 1;
      console.log(
        `Failed read ${caseId}: ${existing.errors.map((err) => err.message).join("; ")}`,
      );
      continue;
    }
    if (!existing?.data) {
      if (!createMissing) {
        missing += 1;
        console.log(`Missing caseId ${caseId}; not updated`);
        continue;
      }
      const indexItem = indexByCaseId.get(caseId);
      if (!indexItem) {
        missing += 1;
        console.log(`Missing caseId ${caseId}; no index item found`);
        continue;
      }
      if (dryRun) {
        console.log(`[DRY RUN] Would create ${caseId}`);
        created += 1;
        continue;
      }
      const createPayload = buildCreatePayload(indexItem, prefixedSummary);
      const createResult = await client.models.Case.create(
        createPayload,
        requestOptions,
      );
      if (createResult?.errors?.length) {
        failed += 1;
        console.log(
          `Failed create ${caseId}: ${createResult.errors.map((err) => err.message).join("; ")}`,
        );
      } else {
        created += 1;
      }
      continue;
    }

    const { errors } = await client.models.Case.update(
      {
        caseId,
        summary: prefixedSummary,
      },
      requestOptions,
    );

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
      `Progress ${processed}/${summaries.length} (updated ${updated}, created ${created}, missing ${missing}, skipped ${skipped}, failed ${failed})`,
    );
  }
}

console.log(
  `Done. Updated ${updated}, created ${created}, missing ${missing}, skipped ${skipped}, failed ${failed}.`,
);
