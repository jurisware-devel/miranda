import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const resourcePath = new URL('../../amplify/data/resource.ts', import.meta.url);
const source = readFileSync(resourcePath, 'utf8');

function between(startAnchor, endAnchor) {
  const start = source.indexOf(startAnchor);
  assert.ok(start >= 0, `Missing section anchor: ${startAnchor}`);

  const afterStart = source.slice(start);
  if (!endAnchor) {
    return afterStart;
  }

  const end = afterStart.indexOf(endAnchor);
  assert.ok(end >= 0, `Missing section end anchor: ${endAnchor}`);
  return afterStart.slice(0, end);
}

const caseSection = between('Case: a', '\n\n  Tag: a');
const tagSection = between('Tag: a', '\n\n  CaseTag: a');
const caseTagSection = between('CaseTag: a', '\n\n  saveOpinionText: a');
const saveOpinionSection = between('saveOpinionText: a', '\n\n  UserProfile: a');
const userProfileSection = between('UserProfile: a', '\n});');

function assertContains(block, snippet, context) {
  assert.ok(block.includes(snippet), `Expected ${context} to include: ${snippet}`);
}

function assertNotContains(block, snippet, context) {
  assert.ok(!block.includes(snippet), `Expected ${context} not to include: ${snippet}`);
}

test('Case: guest/user read only, admin write', () => {
  assertContains(caseSection, 'allow.guest().to(["read"])', 'Case authorization');
  assertContains(caseSection, 'allow.authenticated().to(["read"])', 'Case authorization');
  assertContains(caseSection, 'allow.group("Admin").to(["create", "update", "delete"])', 'Case authorization');
  assertNotContains(caseSection, 'allow.guest().to(["create"', 'Case authorization');
  assertNotContains(caseSection, 'allow.guest().to(["create", "read", "update", "delete"])', 'Case authorization');
});

test('Tag: guest/user read only, admin write', () => {
  assertContains(tagSection, 'allow.guest().to(["read"])', 'Tag authorization');
  assertContains(tagSection, 'allow.authenticated().to(["read"])', 'Tag authorization');
  assertContains(tagSection, 'allow.group("Admin").to(["create", "update", "delete"])', 'Tag authorization');
  assertNotContains(tagSection, 'allow.guest().to(["create"', 'Tag authorization');
});

test('CaseTag: guest/user read only, admin create/delete', () => {
  assertContains(caseTagSection, 'allow.guest().to(["read"])', 'CaseTag authorization');
  assertContains(caseTagSection, 'allow.authenticated().to(["read"])', 'CaseTag authorization');
  assertContains(caseTagSection, 'allow.group("Admin").to(["create", "delete"])', 'CaseTag authorization');
  assertNotContains(caseTagSection, 'allow.guest().to(["create"', 'CaseTag authorization');
});

test('saveOpinionText: admin only', () => {
  assertContains(saveOpinionSection, 'allow.group("Admin")', 'saveOpinionText authorization');
  assertNotContains(saveOpinionSection, 'allow.guest()', 'saveOpinionText authorization');
});

test('UserProfile: authenticated create/read/update, admin delete', () => {
  assertContains(userProfileSection, 'allow.authenticated().to(["create", "read", "update"])', 'UserProfile authorization');
  assertContains(userProfileSection, 'allow.group("Admin").to(["read", "delete"])', 'UserProfile authorization');
  assertNotContains(userProfileSection, 'allow.guest()', 'UserProfile authorization');
});

test('Data API default auth mode remains explicit identityPool', () => {
  assertContains(source, "defaultAuthorizationMode: 'identityPool'", 'defineData.authorizationModes');
});
