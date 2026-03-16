#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const coaRoot = path.join(repoRoot, "coa");
const reviewFile = path.join(
  repoRoot,
  "mutate",
  "coa-non-people-intro-signals-review.md",
);

const signalPattern =
  /(?<leading>^|[^A-Za-z*])(?<signal>see\s+also|see\s+e\.g\.|but\s+see|accord|compare|e\.g\.|but\s+cf\.|cf\.|see)(?<ws>\s+)/gi;

function listOpinionFiles(rootDir) {
  const files = [];
  for (const year of fs.readdirSync(rootDir).sort()) {
    const yearDir = path.join(rootDir, year);
    if (!fs.statSync(yearDir).isDirectory()) continue;
    for (const file of fs.readdirSync(yearDir).sort()) {
      if (/^\d{4}_\d{5}\.md$/.test(file)) {
        files.push(path.join(yearDir, file));
      }
    }
  }
  return files;
}

function parseBracketed(text, startIndex) {
  let depth = 0;
  for (let i = startIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "[") depth += 1;
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function parseParenthetical(text, startIndex) {
  let depth = 0;
  for (let i = startIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function extractCitation(text) {
  if (!text) return null;

  if (text[0] === "[") {
    const linkTextEnd = parseBracketed(text, 0);
    if (linkTextEnd === -1 || text[linkTextEnd] !== "(") return null;
    const linkEnd = parseParenthetical(text, linkTextEnd);
    if (linkEnd === -1) return null;
    return text.slice(0, linkEnd);
  }

  let seenYearToken = false;
  let bracketDepth = 0;
  let parenDepth = 0;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (ch === "[") {
      bracketDepth += 1;
      continue;
    }

    if (ch === "]") {
      const bracketStart = text.lastIndexOf("[", i);
      if (bracketStart !== -1 && /\d{4}/.test(text.slice(bracketStart, i + 1))) {
        seenYearToken = true;
      }
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (ch === "(") {
      parenDepth += 1;
      continue;
    }

    if (ch === ")") {
      const parenStart = text.lastIndexOf("(", i);
      if (parenStart !== -1 && /\d{4}/.test(text.slice(parenStart, i + 1))) {
        seenYearToken = true;
      }
      parenDepth = Math.max(0, parenDepth - 1);
      if (
        seenYearToken &&
        bracketDepth === 0 &&
        parenDepth === 0 &&
        !text.slice(i + 1).startsWith("]")
      ) {
        return text.slice(0, i + 1).trimEnd();
      }
      continue;
    }

    if (
      seenYearToken &&
      bracketDepth === 0 &&
      parenDepth === 0 &&
      (ch === ";" || ch === "\n" || ch === ".")
    ) {
      return text.slice(0, i).trimEnd();
    }
  }

  if (seenYearToken) {
    return text.trimEnd();
  }

  const fallbackMatch = text.match(/^.+?(?=[;\n.)]|$)/);
  return fallbackMatch ? fallbackMatch[0].trimEnd() : null;
}

function stripMarkdownLink(text) {
  if (!text.startsWith("[")) return text;
  const linkTextEnd = parseBracketed(text, 0);
  if (linkTextEnd === -1 || text[linkTextEnd] !== "(") return text;
  const linkEnd = parseParenthetical(text, linkTextEnd);
  if (linkEnd === -1) return text;
  return text.slice(1, linkTextEnd - 1);
}

function normalizeCitation(rawCitation) {
  let text = stripMarkdownLink(rawCitation)
    .replace(/^(?:\[\d+\]|\[\*\d+\])+\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/&#8203;/g, "")
    .replace(/\{[^}]+\}/g, "")
    .replace(/\s+/g, " ")
    .trim();

  text = text.replace(/[,;:]+$/g, "").trim();

  const dateMatch = text.match(/(\[[^\]]*\d{4}[^\]]*\]|\(\d{4}\))/);
  if (!dateMatch || dateMatch.index == null) {
    return text;
  }

  const end = dateMatch.index + dateMatch[0].length;
  let core = text.slice(0, end).trim();
  core = core.replace(/[,;:]+$/g, "").trim();

  const reporterStart = core.search(/,\s+\d[\dA-Za-z .\-]*\b(?:NY|US|F|A|P|S|Misc|AD|Mass|Conn|Ohio|La|Tex|RI|NC|Nev|Del|Ariz|Utah|Cal)/);
  if (reporterStart === -1) {
    return core;
  }

  const name = core.slice(0, reporterStart).trim().replace(/[,;:]+$/g, "");
  const citation = core.slice(reporterStart + 2).trim();
  return `${name}, ${citation}`;
}

function startsWithPeopleCitation(text) {
  return /^(?:\[\*)?\*?People v\b/i.test(text);
}

function looksLikeCaseCitation(text) {
  return /^(?:\[\*)?(?:\*?[A-Z][^,;\n]*\sv(?:\s|\.)|\*?Matter of\b|\*?In re\b|\*?In the Matter of\b)/.test(
    text,
  );
}

const opinionFiles = listOpinionFiles(coaRoot);
const reviewGroups = new Map();

let filesChanged = 0;
let replacements = 0;
let nonPeopleMatches = 0;

for (const filePath of opinionFiles) {
  const original = fs.readFileSync(filePath, "utf8");
  let updated = "";
  let cursor = 0;
  let changed = false;

  for (const match of original.matchAll(signalPattern)) {
    const fullMatch = match[0];
    const leading = match.groups.leading;
    const signal = match.groups.signal;
    const ws = match.groups.ws;
    const matchIndex = match.index ?? 0;
    const signalStart = matchIndex + leading.length;
    const afterSignal = original.slice(signalStart + signal.length + ws.length);
    if (startsWithPeopleCitation(afterSignal)) {
      updated += original.slice(cursor, signalStart);
      updated += `*${signal}*${ws}`;
      replacements += 1;
      changed = true;
      cursor = signalStart + signal.length + ws.length;
      continue;
    }

    const citation = extractCitation(afterSignal);

    if (!citation || !looksLikeCaseCitation(afterSignal)) {
      continue;
    }

    updated += original.slice(cursor, signalStart);
    updated += signal + ws;
    const caseId = path.basename(filePath, ".md");
    const fullString = `${signal}${ws}${normalizeCitation(citation)}`;
    if (!reviewGroups.has(caseId)) reviewGroups.set(caseId, []);
    const entries = reviewGroups.get(caseId);
    if (!entries.includes(fullString)) {
      entries.push(fullString);
      nonPeopleMatches += 1;
    }

    cursor = signalStart + signal.length + ws.length;
  }

  if (changed) {
    updated += original.slice(cursor);
    if (updated !== original) {
      fs.writeFileSync(filePath, updated);
      filesChanged += 1;
    }
  }
}

const reviewLines = [
  "# Non-People Introductory Signals Review",
  "",
  "Signals that precede case citations not beginning with `People v`.",
  "",
];

for (const caseId of [...reviewGroups.keys()].sort()) {
  reviewLines.push(`## ${caseId}`, "");
  for (const entry of reviewGroups.get(caseId)) {
    reviewLines.push(`- ${entry}`);
  }
  reviewLines.push("");
}

fs.writeFileSync(reviewFile, `${reviewLines.join("\n").trimEnd()}\n`);

const summary = {
  filesScanned: opinionFiles.length,
  filesChanged,
  replacements,
  nonPeopleCaseIds: reviewGroups.size,
  nonPeopleMatches,
  reviewFile: path.relative(repoRoot, reviewFile),
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
