import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const outputsPath = path.join(repoRoot, "amplify_outputs.json");
const outputs = JSON.parse(await readFile(outputsPath, "utf-8"));
Amplify.configure(outputs);
const client = generateClient();

const dryRun = process.env.DRY_RUN === "1";
const limit = Number(process.env.LIMIT ?? 5000);

let updated = 0;
let skipped = 0;
let failed = 0;
let processed = 0;
let nextToken = undefined;

async function listCases(token) {
  return client.models.Case.list({ limit, nextToken: token });
}

while (true) {
  const { data, nextToken: newToken } = await listCases(nextToken);
  const items = data ?? [];

  for (const item of items) {
    processed += 1;
    if (item.ai_review === true) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would update ${item.caseId}`);
      updated += 1;
      continue;
    }

    try {
      const { errors } = await client.models.Case.update({
        caseId: item.caseId,
        ai_review: true,
      });
      if (errors?.length) {
        failed += 1;
        console.log(
          `Failed ${item.caseId}: ${errors.map((err) => err.message).join("; ")}`,
        );
      } else {
        updated += 1;
      }
    } catch (err) {
      failed += 1;
      console.log(
        `Failed ${item.caseId}:`,
        err instanceof Error ? err.message : err,
      );
    }

    if (processed % 100 === 0) {
      console.log(
        `Progress ${processed} (updated ${updated}, skipped ${skipped}, failed ${failed})`,
      );
    }
  }

  if (!newToken) break;
  nextToken = newToken;
}

console.log(
  `Done. Processed ${processed} (updated ${updated}, skipped ${skipped}, failed ${failed}).`,
);
