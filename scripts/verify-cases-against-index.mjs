import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const outputsPath = path.join(repoRoot, "amplify_outputs.json");
const outputs = JSON.parse(await readFile(outputsPath, "utf-8"));
Amplify.configure(outputs);
const client = generateClient();

const coaDir = path.join(repoRoot, "public", "texts", "coa");

async function loadIndexCaseIds() {
  const caseIds = new Set();
  const yearDirs = (await readdir(coaDir, { withFileTypes: true })).filter(
    (entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name)
  );

  for (const yearDir of yearDirs) {
    const indexPath = path.join(coaDir, yearDir.name, "index.json");
    try {
      const payload = JSON.parse(await readFile(indexPath, "utf-8"));
      if (Array.isArray(payload.items)) {
        for (const item of payload.items) {
          if (item.caseId) caseIds.add(item.caseId);
        }
      }
    } catch (err) {
      console.log(`Skip ${indexPath}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return caseIds;
}

async function loadAllCaseIdsFromDb() {
  const caseIds = new Set();
  let nextToken = undefined;
  do {
    const { data, nextToken: token } = await client.models.Case.list({
      limit: 1000,
      nextToken,
    });
    for (const item of data ?? []) {
      if (item.caseId) caseIds.add(item.caseId);
    }
    nextToken = token ?? undefined;
  } while (nextToken);
  return caseIds;
}

async function main() {
  const indexIds = await loadIndexCaseIds();
  const dbIds = await loadAllCaseIdsFromDb();

  const missing = [];
  for (const id of indexIds) {
    if (!dbIds.has(id)) missing.push(id);
  }

  const extra = [];
  for (const id of dbIds) {
    if (!indexIds.has(id)) extra.push(id);
  }

  console.log(`Index count: ${indexIds.size}`);
  console.log(`DB count: ${dbIds.size}`);
  console.log(`Missing in DB: ${missing.length}`);
  console.log(`Extra in DB: ${extra.length}`);

  if (missing.length) {
    console.log("Missing sample:", missing.slice(0, 20));
  }
  if (extra.length) {
    console.log("Extra sample:", extra.slice(0, 20));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
