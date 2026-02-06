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

async function listAllCases() {
  let items = [];
  let nextToken = undefined;
  do {
    const { data, nextToken: token } = await client.models.Case.list({
      limit: 1000,
      nextToken,
    });
    items = items.concat(data ?? []);
    nextToken = token ?? undefined;
  } while (nextToken);
  return items;
}

async function main() {
  const cases = await listAllCases();
  console.log(`Found ${cases.length} cases to delete`);

  let deleted = 0;
  let failed = 0;

  for (const item of cases) {
    const { errors } = await client.models.Case.delete({ caseId: item.caseId });
    if (errors?.length) {
      failed += 1;
      console.log(
        `Failed ${item.caseId}:`,
        errors.map((e) => e.message).join("; ")
      );
    } else {
      deleted += 1;
    }

    if ((deleted + failed) % 50 === 0) {
      console.log(`Progress ${deleted + failed}/${cases.length}`);
    }
  }

  console.log(`Deleted: ${deleted}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
