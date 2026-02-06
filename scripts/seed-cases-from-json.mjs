import { readFile } from "node:fs/promises";
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

const indexPath = path.join(repoRoot, "public", "texts", "coa", "index.json");

async function main() {
  const payload = JSON.parse(await readFile(indexPath, "utf-8"));
  const items = Array.isArray(payload.items) ? payload.items : [];

  let created = 0;
  let failed = 0;
  let processed = 0;
  const total = items.length;

  for (const item of items) {
    processed += 1;
    if (!item.caseId || !item.caseName || !item.opinionUrl) {
      failed += 1;
      console.log(`Skip invalid item at index ${processed - 1}`);
      continue;
    }

    const { errors } = await client.models.Case.create({
      caseId: item.caseId,
      caseName: item.caseName,
      slipOp: item.slipOp ?? undefined,
      ny3dCite: item.ny3dCite ?? undefined,
      opinionUrl: item.opinionUrl,
      court: item.court ?? undefined,
      decisionDate: item.decisionDate ?? undefined,
      arguedDate: item.arguedDate ?? undefined,
      correctedDate: item.correctedDate ?? undefined,
      citation: item.citation ?? undefined,
      lowerCourtCite: item.lowerCourtCite ?? undefined,
      disposition: item.disposition ?? undefined,
      authoringJudge: item.authoringJudge ?? undefined,
      partiesCaption: item.partiesCaption ?? undefined,
      statutesCited: item.statutesCited ?? undefined,
      summary: item.summary ?? undefined,
    });

    if (errors?.length) {
      failed += 1;
      console.log(`Failed ${item.caseId}:`, errors.map((e) => e.message).join("; "));
    } else {
      created += 1;
    }

    if (processed % 50 === 0) {
      console.log(`Progress ${processed}/${total} (created ${created}, failed ${failed})`);
    }
  }

  console.log(`Created: ${created}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
