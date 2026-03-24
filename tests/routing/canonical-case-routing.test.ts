import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import InlineContent, { resolveOpinionHref } from "../../src/components/shared/opinion/InlineContent";
import {
  buildScopedCasePath,
  isValidCanonicalCaseId,
  roleFromPathname,
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

test("maps scoped pathnames back to app roles", () => {
  assert.equal(roleFromPathname("/admin/case/2017_03560"), "admin");
  assert.equal(roleFromPathname("/sub/case/2017_03560"), "user");
  assert.equal(roleFromPathname("/pub/case/2017_03560"), "guest");
});

test("rewrites opinion-internal case html links to canonical Miranda case routes", () => {
  const target = resolveOpinionHref(
    "../2007/2007_09814.htm",
    "http://localhost:5173/@fs/Users/jonathan/Projects/miranda/opinions/coa/2017/2017_03560.json",
    "/admin/case/2017_03560",
  );
  assert.equal(target, "/case/2007_09814");
});

test("preserves non-case relative opinion links as resolved asset urls", () => {
  const target = resolveOpinionHref(
    "../pdfs/appendix.pdf",
    "http://localhost:5173/@fs/Users/jonathan/Projects/miranda/opinions/coa/2017/2017_03560.json",
    "/admin/case/2017_03560",
  );
  assert.equal(
    target,
    "http://localhost:5173/@fs/Users/jonathan/Projects/miranda/opinions/coa/pdfs/appendix.pdf",
  );
});

test("renders canonical Miranda case links without opening a new tab", () => {
  const originalWindow = (globalThis as { window?: Window }).window;
  (globalThis as { window?: { location: { pathname: string } } }).window = {
    location: { pathname: "/admin/case/2017_03560" },
  };

  try {
    const html = renderToStaticMarkup(
      React.createElement(InlineContent, {
        opinionSourceUrl: "http://localhost:5173/@fs/Users/jonathan/Projects/miranda/opinions/coa/2017/2017_03560.json",
        nodes: [
          {
            type: "link",
            href: "../2008/2008_04122.htm",
            children: [{ type: "text", text: "People v Example" }],
          },
        ],
      }),
    );

    assert.match(html, /href="\/case\/2008_04122"/);
    assert.doesNotMatch(html, /target="_blank"/);
    assert.doesNotMatch(html, /rel="noreferrer"/);
  } finally {
    (globalThis as { window?: Window }).window = originalWindow;
  }
});
