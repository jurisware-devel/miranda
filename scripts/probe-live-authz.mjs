#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { signIn, signOut } from 'aws-amplify/auth';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const outputsPath = path.join(repoRoot, 'amplify_outputs.json');
const outputs = JSON.parse(await readFile(outputsPath, 'utf8'));
Amplify.configure(outputs);
const client = generateClient();

const userPoolId = outputs?.auth?.user_pool_id;
if (!userPoolId) {
  throw new Error('Missing auth.user_pool_id in amplify_outputs.json');
}

const awsProfile = process.env.AWS_PROFILE || 'default';
const region = outputs?.auth?.aws_region || process.env.AWS_REGION || 'us-east-1';
const runId = randomUUID().slice(0, 8);
const now = Date.now();
const baseDomain = 'probe.miranda.local';
const userEmail = `probe-user-${now}-${runId}@${baseDomain}`;
const adminEmail = `probe-admin-${now}-${runId}@${baseDomain}`;
const password = `Probe!${String(now).slice(-6)}Aa1`;
const tempTagId = `probe_tag_${now}_${runId}`;
const tempTagLabel = `Probe Tag ${runId}`;

const results = [];
const createdUsers = [];

function addResult(role, action, ok, detail) {
  results.push({ role, action, ok, detail });
}

async function awsCognito(args) {
  const fullArgs = ['--profile', awsProfile, '--region', region, ...args];
  return execFileAsync('aws', ['cognito-idp', ...fullArgs], { cwd: repoRoot });
}

async function createProbeUser(username, groups = []) {
  await awsCognito([
    'admin-create-user',
    '--user-pool-id', userPoolId,
    '--username', username,
    '--user-attributes', `Name=email,Value=${username}`,
    '--message-action', 'SUPPRESS',
  ]);

  await awsCognito([
    'admin-set-user-password',
    '--user-pool-id', userPoolId,
    '--username', username,
    '--password', password,
    '--permanent',
  ]);

  for (const group of groups) {
    await awsCognito([
      'admin-add-user-to-group',
      '--user-pool-id', userPoolId,
      '--username', username,
      '--group-name', group,
    ]);
  }

  createdUsers.push(username);
}

async function cleanupUsers() {
  for (const username of createdUsers) {
    try {
      await awsCognito([
        'admin-delete-user',
        '--user-pool-id', userPoolId,
        '--username', username,
      ]);
    } catch {
      // Best-effort cleanup.
    }
  }
}

async function expectAllowed(role, action, fn) {
  try {
    const data = await fn();
    addResult(role, action, true, data ? 'allowed' : 'allowed');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    addResult(role, action, false, message);
  }
}

async function expectDenied(role, action, fn) {
  try {
    await fn();
    addResult(role, action, false, 'unexpectedly allowed');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    addResult(role, action, true, message);
  }
}

async function listCases(authMode) {
  const res = await client.models.Case.list({ limit: 1, authMode });
  if (res?.errors?.length) {
    throw new Error(res.errors.map((e) => e.message).join('; '));
  }
  return res?.data ?? [];
}

async function createTag(authMode, tagId, label) {
  const res = await client.models.Tag.create({ tagId, label }, { authMode });
  if (res?.errors?.length) {
    throw new Error(res.errors.map((e) => e.message).join('; '));
  }
  return res?.data;
}

async function deleteTag(authMode, tagId) {
  const res = await client.models.Tag.delete({ tagId }, { authMode });
  if (res?.errors?.length) {
    throw new Error(res.errors.map((e) => e.message).join('; '));
  }
  return res?.data;
}

async function saveOpinion(authMode) {
  const res = await client.mutations.saveOpinionText(
    { key: `probe/${runId}`, markdown: 'probe markdown' },
    { authMode },
  );
  if (res?.errors?.length) {
    throw new Error(res.errors.map((e) => e.message).join('; '));
  }
  return res?.data;
}

try {
  await createProbeUser(userEmail, ['User']);
  await createProbeUser(adminEmail, ['Admin']);

  await signOut().catch(() => {});

  await expectAllowed('guest', 'Case.read', async () => listCases('iam'));
  await expectDenied('guest', 'Tag.create', async () => createTag('iam', `${tempTagId}_guest`, 'Guest Probe'));
  await expectDenied('guest', 'saveOpinionText', async () => saveOpinion('iam'));

  await signIn({ username: userEmail, password });
  await expectAllowed('user', 'Case.read', async () => listCases('userPool'));
  await expectDenied('user', 'Tag.create', async () => createTag('userPool', `${tempTagId}_user`, 'User Probe'));
  await expectDenied('user', 'saveOpinionText', async () => saveOpinion('userPool'));
  await signOut();

  await signIn({ username: adminEmail, password });
  await expectAllowed('admin', 'Case.read', async () => listCases('userPool'));
  await expectAllowed('admin', 'Tag.create', async () => createTag('userPool', tempTagId, tempTagLabel));
  await expectAllowed('admin', 'saveOpinionText', async () => saveOpinion('userPool'));
  await expectAllowed('admin', 'Tag.delete', async () => deleteTag('userPool', tempTagId));
  await signOut();
} finally {
  await signOut().catch(() => {});
  await cleanupUsers();
}

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({
  runId,
  userPoolId,
  results,
  passed: failed.length === 0,
  failedCount: failed.length,
}, null, 2));

if (failed.length > 0) {
  process.exit(2);
}
