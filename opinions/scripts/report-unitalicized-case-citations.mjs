import fs from "fs";
import path from "path";

const root = process.cwd();
const coaRoot = path.join(root, "coa");
const outputPath = path.join(
  root,
  "mutate",
  "coa-unitalicized-case-citations.txt"
);

const skipSingleTokens = new Set([
  "AD",
  "AD2d",
  "AD3d",
  "Misc",
  "Misc2d",
  "Misc3d",
  "NY",
  "NY2d",
  "NY3d",
  "US",
]);

const partyToken = "(?:[A-Z][A-Za-z0-9.'’&/-]*|[0-9]+(?:st|nd|rd|th))";
const connectorToken = `(?:of|the|and|&|${partyToken})`;
const relatorSegment = `(?:\\s+ex\\s+rel\\.?\\s+${partyToken}(?:,?\\s+${connectorToken}){0,10})?`;
const partySide = `${partyToken}(?:,?\\s+${connectorToken}){0,14}${relatorSegment}`;
const citationPattern =
  new RegExp(
    `\\b((?!In\\b)${partySide})\\s+v\\s+(${partySide})`,
    "g"
  );

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanLine(line) {
  return line
    .replace(/&#8203;/g, "")
    .replace(/\*\*\{\d+\}\*\*/g, "")
    .replace(/\[\*\d+\]/g, "")
    .replace(/\s+/g, " ");
}

const introSignals = [
  "see e.g.",
  "see, e.g.",
  "see generally",
  "see also",
  "but see",
  "e.g.",
  "see",
  "cf.",
  "accord",
  "compare",
  "contra",
];

function annotateIntroSignal(snippet, prefix = "") {
  const lowerPrefix = prefix.toLowerCase();

  for (const signal of introSignals) {
    const idx = lowerPrefix.lastIndexOf(signal);
    if (idx === -1) continue;

    const before = prefix.slice(0, idx);
    const matched = prefix.slice(idx, idx + signal.length);
    const after = prefix.slice(idx + signal.length);

    if (/[A-Za-z]/.test(before.slice(-1))) continue;
    if (/[A-Za-z]/.test(after.slice(0, 1))) continue;
    if (!/^[\s[\](){},;:.*0-9-]*$/.test(after)) continue;

    return `<${matched}> ${snippet}`;
  }

  return snippet;
}

function buildSnippet(line, start, end, citation) {
  const prefix = line.slice(0, start);
  return annotateIntroSignal(`<${citation}>`, prefix);
}

function normalizeCandidate(matchText, start) {
  if (/^In\s+/.test(matchText)) {
    return {
      citation: matchText.replace(/^In\s+/, ""),
      start: start + 3,
    };
  }

  if (/^People\s+v\s+/.test(matchText)) {
    return null;
  }

  return {
    citation: matchText,
    start,
  };
}

function looksLikeReporterOnly(side) {
  return skipSingleTokens.has(side.trim());
}

function isItalicized(line, start, end) {
  return line[start - 1] === "*" || line[end] === "*";
}

function hasCapitalizedPrefixToken(line, start) {
  const prefix = line.slice(0, start);
  return /[A-Z][A-Za-z0-9.'’&/-]*\s+$/.test(prefix);
}

function collectMatches(line) {
  const matches = [];
  const cleanedLine = cleanLine(line);

  for (const match of cleanedLine.matchAll(citationPattern)) {
    const normalized = normalizeCandidate(normalizeWhitespace(match[0]), match.index ?? 0);
    if (!normalized) continue;
    const full = normalized.citation;
    const left = normalizeWhitespace(match[1]);
    const right = normalizeWhitespace(match[2]);
    const start = normalized.start;
    const end = start + full.length;

    if (isItalicized(cleanedLine, start, end)) continue;
    if (hasCapitalizedPrefixToken(cleanedLine, start)) continue;
    if (looksLikeReporterOnly(left) || looksLikeReporterOnly(right)) continue;

    const snippet = buildSnippet(cleanedLine, start, end, full);

    matches.push({
      citation: full,
      snippet,
    });
  }

  return matches;
}

function buildReport() {
  const grouped = new Map();
  let filesScanned = 0;
  let candidates = 0;

  for (const file of walk(coaRoot)) {
    filesScanned += 1;
    const rel = path.relative(root, file);
    const caseId = path.basename(file, ".md");
    const lines = fs.readFileSync(file, "utf8").split("\n");

    lines.forEach((line, index) => {
      const lineMatches = collectMatches(line);
      if (lineMatches.length === 0) return;

      const current = grouped.get(caseId) ?? {
        file: rel,
        matches: [],
      };

      for (const match of lineMatches) {
        current.matches.push({
          lineNumber: index + 1,
          snippet: match.snippet,
        });
        candidates += 1;
      }

      grouped.set(caseId, current);
    });
  }

  const sortedCaseIds = [...grouped.keys()].sort();
  const sections = [
    `files_scanned: ${filesScanned}`,
    `cases_with_candidates: ${sortedCaseIds.length}`,
    `candidate_matches: ${candidates}`,
    "",
  ];

  for (const caseId of sortedCaseIds) {
    const entry = grouped.get(caseId);
    sections.push(`${caseId}  (${entry.file})`);
    for (const match of entry.matches) {
      sections.push(`  line ${match.lineNumber}: ${match.snippet}`);
    }
    sections.push("");
  }

  return sections.join("\n");
}

fs.writeFileSync(outputPath, `${buildReport()}\n`);
console.log(outputPath);
