import test from "node:test";
import assert from "node:assert/strict";
import {
  buildScopedCasePath,
  isValidCanonicalCaseId,
  resolveCanonicalCaseRedirect,
} from "../../src/core/routing/canonicalCaseRouting";

test("guest canonical case link redirects to public scope", () => {
  const target = resolveCanonicalCaseRedirect({
    caseId: "2026_00963",
    role: "guest",
    pathname: "/case/2026_00963",
  });
  assert.equal(target, "/pub/case/2026_00963");
});

test("authenticated subscriber canonical case link redirects to sub scope", () => {
  const target = resolveCanonicalCaseRedirect({
    caseId: "2026_00963",
    role: "user",
    pathname: "/case/2026_00963",
  });
  assert.equal(target, "/sub/case/2026_00963");
});

test("admin canonical case link redirects to admin scope", () => {
  const target = resolveCanonicalCaseRedirect({
    caseId: "2026_00963",
    role: "admin",
    pathname: "/case/2026_00963",
  });
  assert.equal(target, "/admin/case/2026_00963");
});

test("supports multiple valid case ID formats across courts", () => {
  assert.equal(isValidCanonicalCaseId("2026_00963"), true);
  assert.equal(isValidCanonicalCaseId("24A102"), true);
  assert.equal(buildScopedCasePath("user", "24A102"), "/sub/case/24A102");
});

test("rejects malicious or invalid case IDs", () => {
  assert.equal(isValidCanonicalCaseId("../etc/passwd"), false);
  assert.equal(isValidCanonicalCaseId("abc%2Fdef"), false);
  assert.equal(isValidCanonicalCaseId(""), false);
});

test("preserves query string and hash in canonical redirect", () => {
  const target = resolveCanonicalCaseRedirect({
    caseId: "24A102",
    role: "user",
    pathname: "/case/24A102",
    search: "?from=opinion&ref=1",
    hash: "#fn-2",
  });
  assert.equal(target, "/sub/case/24A102?from=opinion&ref=1#fn-2");
});

test("loop prevention: no redirect when already at scoped target", () => {
  const target = resolveCanonicalCaseRedirect({
    caseId: "24A102",
    role: "admin",
    pathname: "/admin/case/24A102",
  });
  assert.equal(target, null);
});
