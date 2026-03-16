import fs from "fs";
import path from "path";

const root = process.cwd();
const reportPath = path.join(root, "mutate", "coa-unitalicized-case-citations.txt");
const pageMarkerPattern = /(?:&#8203;|\*\*\{\d+\}\*\*|\[\*\d+\])/g;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseReport(text) {
  const lines = text.split("\n");
  const cases = [];
  let current = null;

  for (const line of lines.slice(4)) {
    const caseMatch = line.match(/^([0-9A-Za-z_]+)\s+\((.+)\)$/);
    if (caseMatch) {
      current = {
        caseId: caseMatch[1],
        file: caseMatch[2],
        entries: [],
      };
      cases.push(current);
      continue;
    }

    const entryMatch = line.match(/^  line (\d+): (.+)$/);
    if (entryMatch && current) {
      current.entries.push({
        lineNumber: Number(entryMatch[1]),
        target: entryMatch[2],
      });
    }
  }

  return cases;
}

function italicizeFirst(text, needle) {
  const pattern = new RegExp(`(?<!\\*)${escapeRegExp(needle)}(?!\\*)`);
  const match = pattern.exec(text);
  if (!match) {
    return null;
  }

  return {
    text:
      text.slice(0, match.index) +
      `*${needle}*` +
      text.slice(match.index + needle.length),
    index: match.index,
  };
}

function italicizeAcrossPageMarkers(text, needle) {
  const markers = [];
  let normalized = "";

  for (let i = 0; i < text.length; ) {
    pageMarkerPattern.lastIndex = i;
    const match = pageMarkerPattern.exec(text);
    if (match && match.index === i) {
      markers.push({
        start: i,
        end: i + match[0].length,
      });
      i += match[0].length;
      continue;
    }
    normalized += text[i];
    i += 1;
  }

  const start = normalized.indexOf(needle);
  if (start === -1) return null;
  const end = start + needle.length;

  let normalizedIndex = 0;
  let originalStart = -1;
  let originalEnd = -1;

  for (let i = 0; i < text.length; ) {
    pageMarkerPattern.lastIndex = i;
    const match = pageMarkerPattern.exec(text);
    if (match && match.index === i) {
      i += match[0].length;
      continue;
    }

    if (normalizedIndex === start && originalStart === -1) {
      originalStart = i;
    }
    if (normalizedIndex === end) {
      originalEnd = i;
      break;
    }

    normalizedIndex += 1;
    i += 1;
  }

  if (originalStart === -1) return null;
  if (originalEnd === -1) originalEnd = text.length;

  const target = text.slice(originalStart, originalEnd);
  const parts = target.split(pageMarkerPattern);
  const markersInside = [...target.matchAll(pageMarkerPattern)].map((m) => m[0]);
  if (parts.length === 1) return null;

  let rebuilt = "";
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i]) rebuilt += `*${parts[i]}*`;
    if (i < markersInside.length) rebuilt += markersInside[i];
  }

  return text.slice(0, originalStart) + rebuilt + text.slice(originalEnd);
}

function applyEntry(line, target) {
  const segments = [...target.matchAll(/<([^>]+)>/g)].map((match) => match[1]);
  if (segments.length === 0) return null;

  if (segments.length === 1) {
    return (
      italicizeFirst(line, segments[0])?.text ??
      italicizeAcrossPageMarkers(line, segments[0])
    );
  }

  const [signal, citation] = segments;
  const signalPattern = new RegExp(`(?<!\\*)${escapeRegExp(signal)}(?!\\*)`);
  const citationPattern = new RegExp(`(?<!\\*)${escapeRegExp(citation)}(?!\\*)`);
  const citationMatch = citationPattern.exec(line);
  if (!citationMatch) return null;

  const prefix = line.slice(0, citationMatch.index);
  let signalIndex = -1;
  let signalMatch = null;
  for (const match of prefix.matchAll(new RegExp(`(?<!\\*)${escapeRegExp(signal)}(?!\\*)`, "g"))) {
    signalIndex = match.index ?? -1;
    signalMatch = match;
  }

  if (!signalMatch || signalIndex === -1) return null;

  let updated =
    line.slice(0, signalIndex) +
    `*${signal}*` +
    line.slice(signalIndex + signal.length);

  const citationAfterSignal = citationPattern.exec(updated);
  if (!citationAfterSignal) return null;

  updated =
    updated.slice(0, citationAfterSignal.index) +
    `*${citation}*` +
    updated.slice(citationAfterSignal.index + citation.length);

  return updated;
}

function rebuildReport(unresolved) {
  const totalCases = unresolved.length;
  const totalMatches = unresolved.reduce((sum, item) => sum + item.entries.length, 0);
  const sections = [
    "files_scanned: 1393",
    `cases_with_candidates: ${totalCases}`,
    `candidate_matches: ${totalMatches}`,
    "",
  ];

  for (const item of unresolved) {
    sections.push(`${item.caseId}  (${item.file})`);
    for (const entry of item.entries) {
      sections.push(`  line ${entry.lineNumber}: ${entry.target}`);
    }
    sections.push("");
  }

  return `${sections.join("\n")}\n`;
}

const cases = parseReport(fs.readFileSync(reportPath, "utf8"));
const unresolved = [];
let applied = 0;

for (const item of cases) {
  const filePath = path.join(root, item.file);
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const remaining = [];
  let changed = false;

  for (const entry of item.entries) {
    const index = entry.lineNumber - 1;
    const originalLine = lines[index];
    const updatedLine = applyEntry(originalLine, entry.target);

    if (!updatedLine || updatedLine === originalLine) {
      remaining.push(entry);
      continue;
    }

    lines[index] = updatedLine;
    changed = true;
    applied += 1;
  }

  if (changed) {
    fs.writeFileSync(filePath, `${lines.join("\n")}`);
  }

  if (remaining.length > 0) {
    unresolved.push({
      caseId: item.caseId,
      file: item.file,
      entries: remaining,
    });
  }
}

fs.writeFileSync(reportPath, rebuildReport(unresolved));
console.log(JSON.stringify({ applied, unresolvedCases: unresolved.length }, null, 2));
