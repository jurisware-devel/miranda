import test from "node:test";
import assert from "node:assert/strict";
import { shouldUseExternalPdfViewer } from "../../src/components/shared/opinion/OpinionPdfView";

test("shouldUseExternalPdfViewer falls back to native PDF handling on iPhone Safari", () => {
  assert.equal(
    shouldUseExternalPdfViewer({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      maxTouchPoints: 5,
    }),
    true,
  );
});

test("shouldUseExternalPdfViewer falls back to native PDF handling on iPad desktop mode", () => {
  assert.equal(
    shouldUseExternalPdfViewer({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
      platform: "MacIntel",
      maxTouchPoints: 5,
    }),
    true,
  );
});

test("shouldUseExternalPdfViewer keeps inline viewer for desktop browsers", () => {
  assert.equal(
    shouldUseExternalPdfViewer({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      platform: "MacIntel",
      maxTouchPoints: 0,
    }),
    false,
  );
});
