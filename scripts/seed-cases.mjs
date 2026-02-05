import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const textsDir = path.join(repoRoot, "public", "texts");

const OPINION_URL_BASE =
  process.env.OPINION_URL_BASE ?? "https://main.d2jq3nso2igffn.amplifyapp.com/texts/";

const outputsPath = path.join(repoRoot, "amplify_outputs.json");
const outputs = JSON.parse(await readFile(outputsPath, "utf-8"));
Amplify.configure(outputs);
const client = generateClient();

function extractCaseId(filename) {
  const match = filename.match(/^(\d{4}_\d{5})/);
  return match ? match[1] : filename.replace(/\.txt$/i, "");
}

function firstNonEmptyLine(lines, start = 0) {
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line) return line;
  }
  return "";
}

function parseDateLine(line) {
  if (!line) return null;
  const parsed = Date.parse(line);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function parseCitation(line) {
  if (!line) return null;
  if (line.includes("NY Slip Op") || line.includes("NY3d")) return line.trim();
  return null;
}

async function main() {
  const entries = await readdir(textsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".txt"))
    .map((entry) => entry.name)
    .sort();

  let created = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;
  const total = files.length;

  for (const filename of files) {
    processed += 1;
    const filePath = path.join(textsDir, filename);
    const content = await readFile(filePath, "utf-8");
    const lines = content.split(/\r?\n/);

    const caseId = extractCaseId(filename);
    const caseName = firstNonEmptyLine(lines);
    const citation = parseCitation(firstNonEmptyLine(lines, 1));
    const decisionDate = parseDateLine(firstNonEmptyLine(lines, 2));
    const opinionUrl = `${OPINION_URL_BASE}${encodeURIComponent(filename)}`;

    if (!caseName) {
      failed += 1;
      console.log(`Skip ${filename}: missing case name`);
      continue;
    }

    const existing = await client.models.Case.get({ caseId });
    if (existing.data) {
      skipped += 1;
      if (processed % 50 === 0) {
        console.log(
          `Progress ${processed}/${total} (created ${created}, skipped ${skipped}, failed ${failed})`
        );
      }
      continue;
    }

    const { errors } = await client.models.Case.create({
      caseId,
      caseName,
      opinionUrl,
      citation: citation ?? undefined,
      decisionDate: decisionDate ?? undefined,
    });

    if (errors?.length) {
      failed += 1;
      console.log(`Failed ${filename}:`, errors.map((e) => e.message).join("; "));
      continue;
    }

    created += 1;
    if (processed % 50 === 0) {
      console.log(
        `Progress ${processed}/${total} (created ${created}, skipped ${skipped}, failed ${failed})`
      );
    }
  }

  console.log(`Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
