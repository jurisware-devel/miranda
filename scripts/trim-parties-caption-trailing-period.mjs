#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { signIn } from 'aws-amplify/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const args = new Set(argv);
const dryRun = args.has('--dry-run');
const apply = args.has('--apply');
const caseIdFlagIndex = argv.indexOf('--case-id');
const singleCaseId =
  caseIdFlagIndex >= 0 && argv[caseIdFlagIndex + 1] ? argv[caseIdFlagIndex + 1] : null;
const authModeFlagIndex = argv.indexOf('--auth-mode');
const authModeArg =
  authModeFlagIndex >= 0 && argv[authModeFlagIndex + 1] ? argv[authModeFlagIndex + 1] : null;

if ((dryRun && apply) || (!dryRun && !apply)) {
  console.error(
    'Usage: node scripts/trim-parties-caption-trailing-period.mjs --dry-run | --apply [--case-id <CASE_ID>] [--auth-mode auto|iam|userPool]',
  );
  process.exit(2);
}

const outputsPath = path.join(repoRoot, 'amplify_outputs.json');
const outputs = JSON.parse(await readFile(outputsPath, 'utf-8'));
Amplify.configure(outputs);

const client = generateClient();
const username = process.env.AMPLIFY_USERNAME;
const password = process.env.AMPLIFY_PASSWORD;

function normalizeAuthMode(mode) {
  if (!mode) return 'auto';
  const lowered = String(mode).trim().toLowerCase();
  if (lowered === 'identitypool') return 'iam';
  if (lowered === 'userpool') return 'userPool';
  if (lowered === 'iam') return 'iam';
  if (lowered === 'auto') return 'auto';
  return mode;
}

const requestedAuthMode = normalizeAuthMode(authModeArg || process.env.AUTH_MODE || 'auto');

let authMode = requestedAuthMode;
if (requestedAuthMode === 'auto') {
  if (username && password) {
    await signIn({ username, password });
    authMode = 'userPool';
  } else {
    authMode = 'iam';
  }
} else if (requestedAuthMode === 'userPool') {
  if (!username || !password) {
    throw new Error('AUTH_MODE=userPool requires AMPLIFY_USERNAME and AMPLIFY_PASSWORD');
  }
  await signIn({ username, password });
}

const listCasesQuery = `
  query ListCasesForPartiesCaptionTrim($limit: Int, $nextToken: String) {
    listCases(limit: $limit, nextToken: $nextToken) {
      items {
        caseId
        partiesCaption
      }
      nextToken
    }
  }
`;

const updateCaseMutation = `
  mutation UpdateCasePartiesCaption($input: UpdateCaseInput!) {
    updateCase(input: $input) {
      caseId
      partiesCaption
      updatedAt
    }
  }
`;

function removeTrailingPeriod(value) {
  if (typeof value !== 'string') return null;
  const trimmedEnd = value.replace(/\s+$/g, '');
  if (!trimmedEnd.endsWith('.')) return null;
  return trimmedEnd.slice(0, -1);
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

async function updatePartiesCaption(caseId, partiesCaption) {
  const result = await client.graphql({
    query: updateCaseMutation,
    variables: {
      input: {
        caseId,
        partiesCaption,
      },
    },
    authMode,
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join('; '));
  }
}

function formatErr(err) {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

const cases = await listAllCases();
const toUpdate = [];

for (const row of cases) {
  const nextCaption = removeTrailingPeriod(row.partiesCaption);
  if (nextCaption === null) continue;
  if (singleCaseId && row.caseId !== singleCaseId) continue;
  toUpdate.push({
    caseId: row.caseId,
    before: row.partiesCaption,
    after: nextCaption,
  });
}

console.log(`Total cases scanned: ${cases.length}`);
console.log(`Rows with trailing period in partiesCaption: ${toUpdate.length}`);
console.log(`Using authMode: ${authMode}`);
if (toUpdate.length > 0) {
  console.log(
    'Sample updates:',
    toUpdate.slice(0, 20).map((row) => ({
      caseId: row.caseId,
      before: row.before,
      after: row.after,
    })),
  );
}

if (dryRun) {
  console.log('Mode: dry-run (no writes).');
  process.exit(0);
}

let updated = 0;
let failed = 0;

for (const row of toUpdate) {
  try {
    await updatePartiesCaption(row.caseId, row.after);
    updated += 1;
  } catch (err) {
    failed += 1;
    console.error(`Failed ${row.caseId}: ${formatErr(err)}`);
  }
}

console.log(`Updated: ${updated}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
