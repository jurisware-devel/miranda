#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const reviewPath = path.join(
  repoRoot,
  "mutate",
  "coa-non-people-intro-signals-statutes-review.md",
);
const followUpPath = path.join(
  repoRoot,
  "mutate",
  "coa-non-people-intro-signals-statutes-follow-up.md",
);

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseReview(text) {
  const lines = text.split("\n");
  const sections = [];
  let current = null;

  for (const line of lines) {
    const header = line.match(/^##\s+(\d{4}_\d{5})$/);
    if (header) {
      current = { caseId: header[1], entries: [] };
      sections.push(current);
      continue;
    }
    if (!current || !line.trim()) continue;

    const m = line.match(/^<([^>]+)>\s+(.+)$/);
    if (m) {
      current.entries.push({ raw: line, signal: m[1], target: m[2] });
    }
  }

  return sections;
}

function formatSignal(text) {
  if (text.startsWith("*") && text.endsWith("*")) return text;
  return `*${text.replace(/^\*|\*$/g, "")}*`;
}

function buildRegex(entry) {
  const signalEsc = escapeRegExp(entry.signal);
  const targetEsc = escapeRegExp(entry.target);
  return new RegExp(
    `(?<signal>\\*?${signalEsc}\\*?)(?<ws>\\s+)(?<target>${targetEsc})`,
    "g",
  );
}

function overlaps(ranges, start, end) {
  return ranges.some(([a, b]) => start < b && end > a);
}

function findMatch(content, regex, cursor, usedRanges) {
  const attempts = [
    { offset: cursor, haystack: content.slice(cursor) },
    { offset: 0, haystack: content },
  ];

  for (const attempt of attempts) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(attempt.haystack))) {
      const start = attempt.offset + match.index;
      const end = start + match[0].length;
      if (!overlaps(usedRanges, start, end)) {
        return { match, start, end };
      }
    }
  }

  return null;
}

function replaceAt(content, start, end, replacement) {
  return content.slice(0, start) + replacement + content.slice(end);
}

function renderReview(sections) {
  const out = [
    "# Non-People Introductory Signals Statutes Review",
    "",
    "Statutory, constitutional, and similar non-case citation lines split from `coa-non-people-intro-signals-review.md`.",
    "",
  ];
  for (const section of sections) {
    if (!section.entries.length) continue;
    out.push(`## ${section.caseId}`, "");
    for (const entry of section.entries) out.push(entry.raw);
    out.push("");
  }
  return out.join("\n").replace(/\n+$/, "\n");
}

function renderFollowUp(misses) {
  const out = [
    "# Non-People Intro Signals Statutes Follow-Up",
    "",
    "Statute-review entries that could not be matched confidently in the corresponding opinion file.",
    "",
  ];
  for (const miss of misses) {
    out.push(`## ${miss.caseId}`, "");
    for (const line of miss.lines) out.push(line);
    out.push("");
  }
  return out.join("\n").replace(/\n+$/, "\n");
}

const reviewText = fs.readFileSync(reviewPath, "utf8");
const sections = parseReview(reviewText);
const misses = [];

let applied = 0;
let filesChanged = 0;

for (const section of sections) {
  const opinionPath = path.join(
    repoRoot,
    "coa",
    section.caseId.slice(0, 4),
    `${section.caseId}.md`,
  );
  let content = fs.readFileSync(opinionPath, "utf8");
  const original = content;
  let cursor = 0;
  const usedRanges = [];
  const remaining = [];

  for (const entry of section.entries) {
    const regex = buildRegex(entry);
    const found = findMatch(content, regex, cursor, usedRanges);
    if (!found) {
      remaining.push(entry);
      continue;
    }
    const { match, start, end } = found;
    const replacement = `${formatSignal(match.groups.signal)}${match.groups.ws}${match.groups.target}`;
    content = replaceAt(content, start, end, replacement);
    usedRanges.push([start, start + replacement.length]);
    cursor = start + replacement.length;
    applied += 1;
  }

  if (content !== original) {
    fs.writeFileSync(opinionPath, content);
    filesChanged += 1;
  }

  section.entries = remaining;
  if (remaining.length) {
    misses.push({ caseId: section.caseId, lines: remaining.map((e) => e.raw) });
  }
}

fs.writeFileSync(reviewPath, renderReview(sections));
fs.writeFileSync(followUpPath, renderFollowUp(misses));

process.stdout.write(
  `${JSON.stringify(
    {
      applied,
      filesChanged,
      remaining: misses.reduce((sum, m) => sum + m.lines.length, 0),
      followUpFile: path.relative(repoRoot, followUpPath),
    },
    null,
    2,
  )}\n`,
);
