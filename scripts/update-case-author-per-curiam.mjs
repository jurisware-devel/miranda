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
    'Usage: node scripts/update-case-author-per-curiam.mjs --dry-run | --apply [--case-id <CASE_ID>] [--auth-mode auto|iam|userPool]',
  );
  process.exit(2);
}

const outputsPath = path.join(repoRoot, 'amplify_outputs.json');
const outputs = JSON.parse(await readFile(outputsPath, 'utf-8'));
Amplify.configure(outputs);

const client = generateClient();
const FROM_AUTHOR = 'Memorandum';
const TO_AUTHOR = 'Per Curiam';
const FIELD_NAME = 'authoringJudge';
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

const listCasesByAuthorQuery = `
  query ListCasesByAuthor($limit: Int, $nextToken: String) {
    listCases(filter: { authoringJudge: { eq: "Memorandum" } }, limit: $limit, nextToken: $nextToken) {
      items {
        caseId
        authoringJudge
      }
      nextToken
    }
  }
`;

const updateCaseAuthorMutation = `
  mutation UpdateCaseAuthor($input: UpdateCaseInput!) {
    updateCase(input: $input) {
      caseId
      authoringJudge
      updatedAt
    }
  }
`;

async function listCasesWithMemorandumAuthor(authMode) {
  const items = [];
  let nextToken = null;

  do {
    const result = await client.graphql({
      query: listCasesByAuthorQuery,
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

async function updateCaseAuthor(caseId, authMode) {
  const result = await client.graphql({
    query: updateCaseAuthorMutation,
    variables: {
      input: {
        caseId,
        authoringJudge: TO_AUTHOR,
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

let cases = await listCasesWithMemorandumAuthor();
if (singleCaseId) {
  cases = cases.filter((item) => item.caseId === singleCaseId);
}

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

cases = await listCasesWithMemorandumAuthor(authMode);
if (singleCaseId) {
  cases = cases.filter((item) => item.caseId === singleCaseId);
}

console.log(`Rows found where ${FIELD_NAME}="${FROM_AUTHOR}": ${cases.length}`);
console.log(`Using authMode: ${authMode}`);
if (cases.length > 0) {
  console.log('Sample caseIds:', cases.slice(0, 20).map((item) => item.caseId));
}

if (dryRun) {
  console.log('Mode: dry-run (no writes).');
  process.exit(0);
}

let updated = 0;
let failed = 0;

for (const item of cases) {
  try {
    await updateCaseAuthor(item.caseId, authMode);
    updated += 1;
  } catch (err) {
    failed += 1;
    console.error(`Failed ${item.caseId}: ${formatErr(err)}`);
  }
}

console.log(`Updated: ${updated}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
