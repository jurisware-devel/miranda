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
  console.error('Usage: node scripts/backfill-case-court-coa.mjs --dry-run | --apply');
  process.exit(2);
}

const outputsPath = path.join(repoRoot, 'amplify_outputs.json');
const outputs = JSON.parse(await readFile(outputsPath, 'utf-8'));
Amplify.configure(outputs);

const client = generateClient();
const authMode = 'iam';

const listAllQuery = `
  query ListAllCases($limit: Int, $nextToken: String) {
    listCases(limit: $limit, nextToken: $nextToken) {
      items { caseId }
      nextToken
    }
  }
`;

const listCoaQuery = `
  query ListCoaCases($limit: Int, $nextToken: String) {
    listCases(filter: { court: { eq: coa } }, limit: $limit, nextToken: $nextToken) {
      items { caseId }
      nextToken
    }
  }
`;

const updateCaseMutation = `
  mutation UpdateCaseCourt($input: UpdateCaseInput!) {
    updateCase(input: $input) {
      caseId
      court
      updatedAt
    }
  }
`;

async function listCaseIds(query) {
  const ids = new Set();
  let nextToken = null;

  do {
    const result = await client.graphql({
      query,
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
      if (item?.caseId) ids.add(item.caseId);
    }

    nextToken = payload.nextToken ?? null;
  } while (nextToken);

  return ids;
}

async function updateCaseToCoa(caseId) {
  const result = await client.graphql({
    query: updateCaseMutation,
    variables: {
      input: {
        caseId,
        court: 'coa',
      },
    },
    authMode,
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join('; '));
  }
}

const allIds = await listCaseIds(listAllQuery);
const coaIds = await listCaseIds(listCoaQuery);
const toUpdate = [...allIds].filter((id) => !coaIds.has(id)).sort();

console.log(`Total cases: ${allIds.size}`);
console.log(`Already coa: ${coaIds.size}`);
console.log(`Need update: ${toUpdate.length}`);

if (dryRun) {
  console.log('Mode: dry-run (no writes).');
  console.log('Sample caseIds to update:', toUpdate.slice(0, 20));
  process.exit(0);
}

let updated = 0;
let failed = 0;

for (const caseId of toUpdate) {
  try {
    await updateCaseToCoa(caseId);
    updated += 1;
  } catch (err) {
    failed += 1;
    console.error(`Failed ${caseId}:`, err instanceof Error ? err.message : String(err));
  }
}

console.log(`Updated: ${updated}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
