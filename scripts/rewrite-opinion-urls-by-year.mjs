#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const apply = args.has('--apply');

if ((dryRun && apply) || (!dryRun && !apply)) {
  console.error('Usage: ./scripts/rewrite-opinion-urls-by-year.mjs --dry-run | --apply');
  process.exit(2);
}

const outputsPath = path.join(repoRoot, 'amplify_outputs.json');
const outputs = JSON.parse(await readFile(outputsPath, 'utf-8'));
Amplify.configure(outputs);

const client = generateClient();
const authMode = 'iam';

const listCasesQuery = `
  query ListCasesForOpinionUrlRewrite($limit: Int, $nextToken: String) {
    listCases(limit: $limit, nextToken: $nextToken) {
      items {
        caseId
        opinionUrl
      }
      nextToken
    }
  }
`;

const updateCaseMutation = `
  mutation UpdateCaseOpinionUrl($input: UpdateCaseInput!) {
    updateCase(input: $input) {
      caseId
      opinionUrl
      updatedAt
    }
  }
`;

function rewriteOpinionUrl(opinionUrl) {
  if (typeof opinionUrl !== 'string') return null;

  const parts = opinionUrl.split('/');
  if (parts.length !== 2) return null;

  const [prefix, tail] = parts;
  if (prefix !== 'coa') return null;
  if (tail.length < 4) return null;

  const year = tail.slice(0, 4);
  if (!/^\d{4}$/.test(year)) return null;

  return `${year}/${tail}`;
}

async function listAllCases() {
  const items = [];
  let nextToken = null;

  do {
    const result = await client.graphql({
      query: listCasesQuery,
      variables: { limit: 1000, nextToken },
      authMode,
    });

    if (result.errors?.length) {
      throw new Error(result.errors.map((e) => e.message).join('; '));
    }

    const payload = result?.data?.listCases;
    if (!payload) {
      throw new Error('Missing listCases payload');
    }

    for (const item of payload.items ?? []) {
      if (item?.caseId) items.push(item);
    }

    nextToken = payload.nextToken ?? null;
  } while (nextToken);

  return items;
}

async function updateOpinionUrl(caseId, opinionUrl) {
  const result = await client.graphql({
    query: updateCaseMutation,
    variables: {
      input: {
        caseId,
        opinionUrl,
      },
    },
    authMode,
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join('; '));
  }
}

const cases = await listAllCases();

const toUpdate = [];
const skipped = [];

for (const item of cases) {
  const caseId = item.caseId;
  const oldUrl = item.opinionUrl;
  const newUrl = rewriteOpinionUrl(oldUrl);

  if (!newUrl) {
    skipped.push({ caseId, opinionUrl: oldUrl, reason: 'non-matching format' });
    continue;
  }

  if (newUrl === oldUrl) continue;
  toUpdate.push({ caseId, oldUrl, newUrl });
}

console.log(`Total cases scanned: ${cases.length}`);
console.log(`Rows to update: ${toUpdate.length}`);
console.log(`Rows skipped (non-matching format): ${skipped.length}`);

if (dryRun) {
  console.log('Mode: dry-run (no writes)');
  console.log('Sample updates:', toUpdate.slice(0, 20));
  process.exit(0);
}

let updated = 0;
let failed = 0;

for (const row of toUpdate) {
  try {
    await updateOpinionUrl(row.caseId, row.newUrl);
    updated += 1;
  } catch (err) {
    failed += 1;
    console.error(`Failed ${row.caseId}:`, err instanceof Error ? err.message : String(err));
  }
}

console.log(`Updated: ${updated}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
