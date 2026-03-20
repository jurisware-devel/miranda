#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { signIn } from "aws-amplify/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function usage() {
  console.error(
    "Usage: node scripts/import-coa-cases-from-opinion-json.mjs --year <year> [--case-ids <id1,id2,...>] --dry-run|--apply",
  );
}

function parseArgs(argv) {
  const parsed = {
    year: "",
    caseIds: [],
    dryRun: false,
    apply: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--year") {
      parsed.year = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--case-ids") {
      parsed.caseIds = String(argv[index + 1] ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (token === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (token === "--apply") {
      parsed.apply = true;
      continue;
    }

    console.error(`Unknown argument: ${token}`);
    usage();
    process.exit(2);
  }

  if (!/^\d{4}$/.test(parsed.year) || parsed.dryRun === parsed.apply) {
    usage();
    process.exit(2);
  }

  return parsed;
}

function toNullableString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function firstOpinionAuthor(opinions) {
  if (!Array.isArray(opinions)) return null;

  const majority = opinions.find((entry) => entry && entry.kind === "majority" && typeof entry.author === "string");
  if (majority?.author?.trim()) return majority.author.trim();

  const fallback = opinions.find((entry) => entry && typeof entry.author === "string" && entry.author.trim());
  return fallback?.author?.trim() || null;
}

function extractDisposition(document) {
  return toNullableString(document?.disposition?.text);
}

function buildCasePayload(document, year) {
  const caseId = toNullableString(document?.source?.caseId);
  if (!caseId) {
    throw new Error("Opinion JSON is missing source.caseId");
  }

  const title = toNullableString(document?.header?.title) ?? caseId;
  const slipOp = toNullableString(document?.header?.slipOpinion);
  const officialCitation = toNullableString(document?.header?.officialCitation);
  const decisionDate = toNullableString(document?.header?.decisionDate);

  return {
    caseId,
    caseName: title,
    slipOp,
    ny3dCite: officialCitation,
    opinionUrl: `${year}/${caseId}`,
    court: "coa",
    decisionDate,
    arguedDate: null,
    correctedDate: null,
    citation: officialCitation ?? slipOp,
    lowerCourtCite: null,
    disposition: extractDisposition(document),
    authoringJudge: firstOpinionAuthor(document?.opinions),
    partiesCaption: title,
    statutesCited: null,
    summary: null,
  };
}

function valuesEqual(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  }
  return (left ?? null) === (right ?? null);
}

function buildUpdatePayload(existing, desired) {
  const payload = { caseId: desired.caseId };

  for (const [key, value] of Object.entries(desired)) {
    if (key === "caseId") continue;
    if (!valuesEqual(existing?.[key], value)) {
      payload[key] = value;
    }
  }

  return payload;
}

function summarizeAction(action, caseId, changedKeys) {
  if (!changedKeys.length) return `${action} ${caseId}`;
  return `${action} ${caseId} (${changedKeys.join(", ")})`;
}

async function listOpinionJsonFiles(year) {
  const opinionsDir = path.join(repoRoot, "opinions", "coa", year);
  const entries = await readdir(opinionsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^\d{4}_\d{5}\.json$/.test(entry.name))
    .map((entry) => path.join(opinionsDir, entry.name))
    .sort();
}

const { year, caseIds, dryRun, apply } = parseArgs(process.argv.slice(2));
const selectedCaseIds = new Set(caseIds);

const outputsPath = path.join(repoRoot, "amplify_outputs.json");
const outputs = JSON.parse(await readFile(outputsPath, "utf-8"));
Amplify.configure(outputs);

const client = generateClient();
const username = process.env.AMPLIFY_USERNAME;
const password = process.env.AMPLIFY_PASSWORD;
const authModeEnv = process.env.AUTH_MODE || "auto";

function normalizeAuthMode(mode) {
  if (!mode) return "auto";
  const lowered = String(mode).trim().toLowerCase();
  if (lowered === "identitypool") return "iam";
  if (lowered === "userpool") return "userPool";
  if (lowered === "iam") return "iam";
  if (lowered === "auto") return "auto";
  return mode;
}

const requestedAuthMode = normalizeAuthMode(authModeEnv);

async function tryProbe(mode, probeCaseId) {
  const options = mode ? { authMode: mode } : undefined;
  try {
    const probe = await client.models.Case.get({ caseId: probeCaseId }, options);
    if (probe?.errors?.length) {
      return { ok: false, error: probe.errors.map((error) => error.message).join("; ") };
    }
    return { ok: true, found: Boolean(probe?.data) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

const opinionJsonFiles = await listOpinionJsonFiles(year);
const filteredFiles = opinionJsonFiles.filter((filePath) => {
  if (!selectedCaseIds.size) return true;
  return selectedCaseIds.has(path.basename(filePath, ".json"));
});

if (!filteredFiles.length) {
  console.log("No opinion JSON files matched the requested filters.");
  process.exit(0);
}

const probeDocument = JSON.parse(await readFile(filteredFiles[0], "utf-8"));
const probeCaseId = toNullableString(probeDocument?.source?.caseId);
if (!probeCaseId) {
  throw new Error(`Unable to determine probe caseId from ${filteredFiles[0]}`);
}

let authMode = requestedAuthMode;
let requestOptions = undefined;

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
    const result = await tryProbe(mode, probeCaseId);
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

const authProbe = await client.models.Case.get({ caseId: probeCaseId }, requestOptions);
if (authProbe?.errors?.length) {
  throw new Error(
    `Probe query failed for ${probeCaseId} using authMode=${authMode}: ${authProbe.errors
      .map((error) => error.message)
      .join("; ")}`,
  );
}
console.log(`Probe ${probeCaseId} with authMode=${authMode}: ${authProbe?.data ? "found" : "not found"}`);

let scanned = 0;
let creates = 0;
let updates = 0;
let skips = 0;
let failed = 0;

for (const filePath of filteredFiles) {
  scanned += 1;
  const raw = await readFile(filePath, "utf-8");
  const document = JSON.parse(raw);

  try {
    const desired = buildCasePayload(document, year);
    const existingResult = await client.models.Case.get({ caseId: desired.caseId }, requestOptions);

    if (existingResult?.errors?.length) {
      throw new Error(existingResult.errors.map((error) => error.message).join("; "));
    }

    const existing = existingResult?.data ?? null;
    if (!existing) {
      creates += 1;
      console.log(summarizeAction(dryRun ? "WOULD CREATE" : "CREATE", desired.caseId, Object.keys(desired).filter((key) => key !== "caseId")));
      if (apply) {
        const createResult = await client.models.Case.create(desired, requestOptions);
        if (createResult?.errors?.length) {
          throw new Error(createResult.errors.map((error) => error.message).join("; "));
        }
      }
      continue;
    }

    const updatePayload = buildUpdatePayload(existing, desired);
    const changedKeys = Object.keys(updatePayload).filter((key) => key !== "caseId");
    if (!changedKeys.length) {
      skips += 1;
      console.log(`SKIP ${desired.caseId} (no changes)`);
      continue;
    }

    updates += 1;
    console.log(summarizeAction(dryRun ? "WOULD UPDATE" : "UPDATE", desired.caseId, changedKeys));
    if (apply) {
      const updateResult = await client.models.Case.update(updatePayload, requestOptions);
      if (updateResult?.errors?.length) {
        throw new Error(updateResult.errors.map((error) => error.message).join("; "));
      }
    }
  } catch (error) {
    failed += 1;
    const caseId = path.basename(filePath, ".json");
    console.error(`FAILED ${caseId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(
  `Done. scanned=${scanned} create=${creates} update=${updates} skip=${skips} failed=${failed} mode=${dryRun ? "dry-run" : "apply"}`,
);

process.exit(failed > 0 ? 1 : 0);
