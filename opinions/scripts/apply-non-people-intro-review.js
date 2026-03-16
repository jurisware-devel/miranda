#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const reviewPath = path.join(
  repoRoot,
  "mutate",
  "coa-non-people-intro-signals-review.md",
);
const followUpPath = path.join(
  repoRoot,
  "mutate",
  "coa-non-people-intro-signals-follow-up.md",
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

    const both = line.match(/^<([^>]+)>\s+<(.+)>$/);
    if (both) {
      current.entries.push({ raw: line, signal: both[1], caseName: both[2] });
      continue;
    }

    const justCase = line.match(/^<(.+)>$/);
    if (justCase) {
      current.entries.push({ raw: line, signal: null, caseName: justCase[1] });
    }
  }

  return sections;
}

function stripOuterStars(text) {
  if (text.startsWith("*") && text.endsWith("*")) {
    return text.slice(1, -1);
  }
  return text;
}

function formatSignal(text) {
  return text.startsWith("*") && text.endsWith("*")
    ? text
    : `*${stripOuterStars(text)}*`;
}

function formatCase(text) {
  const link = text.match(/^\[(.*)\]\(([^)\n]+)\)$/s);
  if (link) {
    const label = link[1];
    const url = link[2];
    const clean = stripOuterStars(label);
    return `[${label.startsWith("*") && label.endsWith("*") ? label : `*${clean}*`}](${url})`;
  }

  return text.startsWith("*") && text.endsWith("*")
    ? text
    : `*${stripOuterStars(text)}*`;
}

function buildRegex(entry) {
  const caseEsc = escapeRegExp(entry.caseName);
  const casePattern = [
    `\\[\\*${caseEsc}\\*\\]\\([^\\n)]+\\)`,
    `\\[${caseEsc}\\]\\([^\\n)]+\\)`,
    `\\*${caseEsc}\\*`,
    caseEsc,
  ].join("|");

  if (entry.signal) {
    const signalEsc = escapeRegExp(entry.signal);
    const signalPattern = [`\\*${signalEsc}\\*`, signalEsc].join("|");
    return new RegExp(
      `(?<signal>${signalPattern})(?<ws>\\s+)(?<case>${casePattern})`,
      "g",
    );
  }

  return new RegExp(`(?<case>${casePattern})`, "g");
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
  const out = [];
  for (const section of sections) {
    if (!section.entries.length) continue;
    out.push(`## ${section.caseId}`, "");
    for (const entry of section.entries) {
      out.push(entry.raw);
    }
    out.push("");
  }
  return out.join("\n").replace(/\n+$/, "\n");
}

function renderFollowUp(misses) {
  const out = [
    "# Non-People Intro Signals Follow-Up",
    "",
    "Review entries that could not be matched confidently in the corresponding opinion file.",
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

let filesChanged = 0;
let applied = 0;

for (const section of sections) {
  const opinionPath = path.join(
    repoRoot,
    "coa",
    section.caseId.slice(0, 4),
    `${section.caseId}.md`,
  );
  let content = fs.readFileSync(opinionPath, "utf8");
  const original = content;
  const usedRanges = [];
  let cursor = 0;
  const remaining = [];

  for (const entry of section.entries) {
    const regex = buildRegex(entry);
    const found = findMatch(content, regex, cursor, usedRanges);
    if (!found) {
      remaining.push(entry);
      continue;
    }

    const { match, start, end } = found;
    const replacement = entry.signal
      ? `${formatSignal(match.groups.signal)}${match.groups.ws}${formatCase(match.groups.case)}`
      : formatCase(match.groups.case);

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
    misses.push({
      caseId: section.caseId,
      lines: remaining.map((entry) => entry.raw),
    });
  }
}

fs.writeFileSync(reviewPath, renderReview(sections));
fs.writeFileSync(followUpPath, renderFollowUp(misses));

process.stdout.write(
  `${JSON.stringify(
    {
      applied,
      filesChanged,
      remaining: misses.reduce((sum, miss) => sum + miss.lines.length, 0),
      followUpFile: path.relative(repoRoot, followUpPath),
    },
    null,
    2,
  )}\n`,
);
