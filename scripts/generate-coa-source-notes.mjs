#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_ROOT = "/Users/jonathan/Projects/miranda/opinions/coa";
const SUMMARY_FILENAME = "notes_summary.json";

const KNOWN_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "body",
  "br",
  "center",
  "classification",
  "conopnjd",
  "counselblock",
  "dateline",
  "div",
  "em",
  "font",
  "head",
  "headnote",
  "html",
  "i",
  "img",
  "meta",
  "opinion",
  "p",
  "para",
  "script",
  "sc",
  "style",
  "stmcs",
  "subopinion",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "title",
  "tr",
  "u",
]);

const APPEARANCE_END_PATTERN =
  /\b(?:for\s+(?:appellant|appellants|respondent|respondents|petitioner|petitioners|appellee|appellees|claimant|claimants|defendant|defendants|plaintiff|plaintiffs)|amic(?:us|i)\s+curiae)\./i;
const APPEARANCE_SIDE_PATTERN = /\bfor\s+(appellant|appellants|respondent|respondents|petitioner|petitioners|appellee|appellees|claimant|claimants|defendant|defendants|plaintiff|plaintiffs)\b/i;
const TITLE_PATTERN = /<title>([\s\S]*?)<\/title>/i;
const TABLE_PATTERN = /<table\b[\s\S]*?<\/table>/gi;
const TAG_PATTERN = /<\/?([a-zA-Z][\w:-]*)\b/g;
const STRAY_CLOSING_TAG_PATTERN = /<\/([a-zA-Z][\w:-]*)>/g;
const SCRIPT_PATTERN = /<script\b[\s\S]*?<\/script>/gi;
const STYLE_PATTERN = /<style\b[\s\S]*?<\/style>/gi;
const BODY_PATTERN = /<body\b[^>]*>([\s\S]*?)<\/body>/i;
const COUNSEL_BLOCK_PATTERN = /<counselblock\b[\s\S]*?<\/counselblock>/gi;
const P_TAG_PATTERN = /<p\b[^>]*>([\s\S]*?)(?=<p\b|<\/body>|<\/div>|<\/counselblock>|<div\b|<table\b|$)/gi;
const DIV_TAG_PATTERN = /<div\b[^>]*>([\s\S]*?)<\/div>/gi;
const BR_PATTERN = /<br\s*\/?>/gi;
const LINE_BREAK_TAG_PATTERN = /<\/(?:p|tr|div|table|headnote|summary|counselblock)>/gi;
const HTML_TAG_PATTERN = /<[^>]+>/g;
const ENTITY_NBSP_PATTERN = /&nbsp;|&#160;|&ensp;|&emsp;/gi;
const ENTITY_SECTION_PATTERN = /&sect;|&#167;/gi;
const ENTITY_AMP_PATTERN = /&amp;/gi;
const ENTITY_LT_PATTERN = /&lt;/gi;
const ENTITY_GT_PATTERN = /&gt;/gi;
const ENTITY_QUOT_PATTERN = /&quot;/gi;
const ENTITY_APOS_PATTERN = /&#39;|&apos;/gi;
const ENTITY_THINSP_PATTERN = /&thinsp;/gi;
const PAGE_MARKER_PATTERN = /\{\*\*[^}]+\}|\[\*\d+\]/g;
const OPINION_START_PATTERN = /\b(?:OPINION OF THE COURT|MEMORANDUM\.?|Per Curiam\.?|OPINION BY|DISSENTING OPINION|CONCURRING OPINION)\b/i;

async function main() {
  const root = path.resolve(process.argv[2] ?? DEFAULT_ROOT);
  const htmlPaths = await collectHtmlFiles(root);
  const summary = {
    root,
    generatedAt: new Date().toISOString(),
    filesAnalyzed: htmlPaths.length,
    notesGenerated: 0,
    appearanceSectionTypes: {},
    publicationStatuses: {},
    anomalyCounts: {},
    filesWithUnknownTags: [],
    filesWithStrayClosingTags: [],
    filesWithTruncatedAppearanceLines: [],
    filesWithPointsOfCounsel: [],
    filesWithPluralAmiciCuriae: [],
    filesWithMultipleWritings: [],
    filesWithAppearanceJsonMismatch: [],
  };

  for (const htmlPath of htmlPaths) {
    const notes = await analyzeFile(htmlPath, root);
    const notesPath = htmlPath.replace(/\.htm$/i, ".notes.json");
    await fs.writeFile(notesPath, `${JSON.stringify(notes, null, 2)}\n`, "utf8");
    summary.notesGenerated += 1;

    increment(summary.appearanceSectionTypes, notes.header.appearanceSectionType);
    increment(summary.publicationStatuses, notes.source.publicationStatus ?? "unknown");

    for (const anomaly of notes.anomalies) {
      increment(summary.anomalyCounts, anomaly.code);
    }
    if (notes.fileInfo.unknownTags.length) {
      summary.filesWithUnknownTags.push(notes.caseId);
    }
    if (notes.fileInfo.strayClosingTags.length) {
      summary.filesWithStrayClosingTags.push(notes.caseId);
    }
    if (notes.header.appearanceLikeLines.some((line) => line.possiblyTruncated)) {
      summary.filesWithTruncatedAppearanceLines.push(notes.caseId);
    }
    if (notes.header.pointsOfCounselCount > 0) {
      summary.filesWithPointsOfCounsel.push(notes.caseId);
    }
    if (notes.header.appearanceLikeLines.some((line) => line.terminalPhrase === "amici curiae.")) {
      summary.filesWithPluralAmiciCuriae.push(notes.caseId);
    }
    if ((notes.opinionStructure.totalWritings ?? 0) > 1) {
      summary.filesWithMultipleWritings.push(notes.caseId);
    }
    if (notes.anomalies.some((anomaly) => anomaly.code.startsWith("JSON_APPEARANCE_") || anomaly.code === "MALFORMED_APPEARANCES_CONTAINER")) {
      summary.filesWithAppearanceJsonMismatch.push(notes.caseId);
    }
  }

  const summaryPath = path.join(root, SUMMARY_FILENAME);
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        root,
        filesAnalyzed: summary.filesAnalyzed,
        notesGenerated: summary.notesGenerated,
        summaryPath,
      },
      null,
      2,
    ),
  );
}

async function analyzeFile(htmlPath, root) {
  const rawHtml = await fs.readFile(htmlPath, "utf8");
  const siblingJsonPath = htmlPath.replace(/\.htm$/i, ".json");
  const companionJson = await readJsonIfExists(siblingJsonPath);
  const relativePath = path.relative(root, htmlPath).split(path.sep).join("/");
  const title = captureFirst(rawHtml, TITLE_PATTERN);
  const bodyHtml = captureFirst(rawHtml, BODY_PATTERN) ?? rawHtml;
  const preOpinionHtml = sliceBeforeOpinion(bodyHtml);
  const lines = extractPreOpinionLines(preOpinionHtml);
  const headerTableTexts = extractTableTexts(bodyHtml);
  const tagStats = collectTagStats(rawHtml);
  const companionAppearances = (companionJson?.header?.appearances ?? [])
    .map((appearance) => analyzeCompanionAppearance(appearance))
    .filter(Boolean);

  const appearanceLikeLines = lines
    .filter((line) => isAppearanceLikeLine(line))
    .map((line) => analyzeAppearanceLine(line));

  const pointsOfCounselCount = countOccurrences(rawHtml, /<counselblock\b[^>]*type\s*=\s*["']?\s*points_of\b/gi);
  const anomalies = buildAnomalies({
    tagStats,
    appearanceLikeLines,
    companionAppearances,
    headerTableTexts,
    companionJson,
    rawHtml,
  });

  return {
    caseId: path.basename(htmlPath, ".htm"),
    sourcePath: `coa/${relativePath}`,
    notesPath: `coa/${relativePath.replace(/\.htm$/i, ".notes.json")}`,
    generatedAt: new Date().toISOString(),
    source: {
      title: normalizeText(title ?? ""),
      publicationStatus: companionJson?.source?.publicationStatus ?? null,
    },
    fileInfo: {
      byteSize: Buffer.byteLength(rawHtml),
      lineCount: rawHtml.split(/\r?\n/).length,
      tagCounts: tagStats.tagCounts,
      unknownTags: tagStats.unknownTags,
      strayClosingTags: tagStats.strayClosingTags,
    },
    header: {
      hasPrimaryHeaderTable: headerTableTexts.length > 0,
      primaryHeaderTableLines: headerTableTexts[0] ?? [],
      captionLines: companionJson?.header?.caption ?? [],
      citationLine: findCitationLine(lines, headerTableTexts, companionJson),
      courtLine: findCourtLine(lines, headerTableTexts, companionJson),
      dateLines: findDateLines(lines, headerTableTexts),
      authorLine: findAuthorLine(lines, headerTableTexts),
      appearanceSectionType: determineAppearanceSectionType(rawHtml),
      pointsOfCounselCount,
      appearanceLikeLines,
      companionAppearances,
    },
    sections: {
      summarySectionsCount: companionJson?.header?.summarySections?.length ?? countOccurrences(rawHtml, /<summary\b/gi),
      headnotesCount: companionJson?.header?.headnotes?.length ?? countOccurrences(rawHtml, /<headnote\b/gi),
      pointsOfCounselCount: companionJson?.header?.pointsOfCounsel?.length ?? pointsOfCounselCount,
      appearancesCount: companionJson?.header?.appearances?.length ?? appearanceLikeLines.length,
      opinionBlocksCount: companionJson?.opinions?.reduce((count, opinion) => count + (opinion?.blocks?.length ?? 0), 0) ?? 0,
      footnotesCount: companionJson?.footnotes?.length ?? estimateFootnoteCount(rawHtml),
    },
    citations: {
      slipOpinion: companionJson?.header?.slipOpinion ?? findSlipOpinion(rawHtml),
      officialCitation: companionJson?.header?.officialCitation ?? findOfficialCitation(rawHtml),
      pageMarkerCount: countOccurrences(rawHtml, PAGE_MARKER_PATTERN),
    },
    opinionStructure: buildOpinionStructure(companionJson, rawHtml),
    footnotes: {
      count: companionJson?.footnotes?.length ?? estimateFootnoteCount(rawHtml),
      labels: (companionJson?.footnotes ?? []).map((footnote) => footnote?.label).filter(Boolean),
      hasFootnotesHeading: /<div\b[^>]*>\s*<b>\s*Footnotes\s*<\/b>\s*<\/div>/i.test(rawHtml) || /\bFootnotes\b/i.test(rawHtml),
    },
    anomalies,
  };
}

async function collectHtmlFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectHtmlFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && fullPath.toLowerCase().endsWith(".htm")) {
      files.push(fullPath);
    }
  }
  files.sort();
  return files;
}

async function readJsonIfExists(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function collectTagStats(rawHtml) {
  const openCounts = new Map();
  const closeCounts = new Map();
  let match;

  while ((match = TAG_PATTERN.exec(rawHtml)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    if (fullTag.startsWith("</")) {
      closeCounts.set(tagName, (closeCounts.get(tagName) ?? 0) + 1);
    } else {
      openCounts.set(tagName, (openCounts.get(tagName) ?? 0) + 1);
    }
  }

  const tagNames = new Set([...openCounts.keys(), ...closeCounts.keys()]);
  const tagCounts = Object.fromEntries(
    [...tagNames]
      .sort()
      .map((tagName) => [tagName, (openCounts.get(tagName) ?? 0) + (closeCounts.get(tagName) ?? 0)]),
  );

  const unknownTags = [...tagNames].filter((tagName) => !KNOWN_TAGS.has(tagName)).sort();
  const strayClosingTags = [...tagNames]
    .filter((tagName) => (closeCounts.get(tagName) ?? 0) > (openCounts.get(tagName) ?? 0))
    .sort();

  return { tagCounts, unknownTags, strayClosingTags };
}

function extractTableTexts(html) {
  const tables = html.match(TABLE_PATTERN) ?? [];
  return tables.map((tableHtml) => normalizeIntoLines(stripHtml(tableHtml)));
}

function sliceBeforeOpinion(bodyHtml) {
  const stripped = bodyHtml.replace(SCRIPT_PATTERN, "").replace(STYLE_PATTERN, "");
  const match = OPINION_START_PATTERN.exec(stripHtml(stripped));
  if (!match) {
    return stripped;
  }
  const marker = match[0];
  const idx = stripped.toUpperCase().indexOf(marker.toUpperCase());
  if (idx < 0) {
    return stripped;
  }
  return stripped.slice(0, idx);
}

function extractPreOpinionLines(preOpinionHtml) {
  const lines = [];
  const seen = new Set();

  const collect = (pattern) => {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(preOpinionHtml)) !== null) {
      const text = normalizeText(stripHtml(match[1] ?? match[0]));
      if (!text || seen.has(text)) {
        continue;
      }
      seen.add(text);
      lines.push(text);
    }
  };

  collect(DIV_TAG_PATTERN);
  collect(P_TAG_PATTERN);

  const bodyLines = normalizeIntoLines(stripHtml(preOpinionHtml));
  for (const line of bodyLines) {
    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }

  return lines;
}

function stripHtml(html) {
  return html
    .replace(SCRIPT_PATTERN, " ")
    .replace(STYLE_PATTERN, " ")
    .replace(BR_PATTERN, "\n")
    .replace(LINE_BREAK_TAG_PATTERN, "\n")
    .replace(ENTITY_NBSP_PATTERN, " ")
    .replace(ENTITY_SECTION_PATTERN, "§")
    .replace(ENTITY_THINSP_PATTERN, " ")
    .replace(ENTITY_AMP_PATTERN, "&")
    .replace(ENTITY_LT_PATTERN, "<")
    .replace(ENTITY_GT_PATTERN, ">")
    .replace(ENTITY_QUOT_PATTERN, '"')
    .replace(ENTITY_APOS_PATTERN, "'")
    .replace(HTML_TAG_PATTERN, " ");
}

function normalizeIntoLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function captureFirst(text, pattern) {
  const match = pattern.exec(text);
  return match?.[1] ?? null;
}

function countOccurrences(text, pattern) {
  pattern.lastIndex = 0;
  let count = 0;
  while (pattern.exec(text) !== null) {
    count += 1;
  }
  return count;
}

function isAppearanceLikeLine(line) {
  return /\bfor\b/i.test(line) && (APPEARANCE_END_PATTERN.test(line) || /\bamic(?:us|i)\s+curiae\b/i.test(line));
}

function analyzeAppearanceLine(line) {
  const sideMatch = line.match(APPEARANCE_SIDE_PATTERN);
  const terminalMatch = line.match(APPEARANCE_END_PATTERN);
  const terminalPhrase = terminalMatch?.[0] ?? null;
  const appearanceSentence = terminalMatch ? normalizeText(line.slice(0, terminalMatch.index + terminalMatch[0].length)) : line;
  const remainder = terminalMatch ? normalizeText(line.slice(terminalMatch.index + terminalMatch[0].length)) : "";
  return {
    text: line,
    sideGuess: sideMatch?.[1]?.toLowerCase() ?? null,
    terminalPhrase: terminalPhrase?.toLowerCase() ?? null,
    hasArgumentTail: Boolean(remainder),
    argumentTailPreview: remainder ? remainder.slice(0, 160) : null,
    sentenceText: appearanceSentence,
    possiblyTruncated: !terminalMatch || /\*[^\*]*$/.test(line) || /\([^)]*$/.test(line),
  };
}

function analyzeCompanionAppearance(appearance) {
  if (!appearance?.text) {
    return null;
  }
  const text = normalizeText(String(appearance.text));
  const normalized = normalizeAppearanceCompare(text);
  return {
    text,
    normalized,
    side: appearance.side ?? null,
    possiblyTruncated:
      hasOddDelimiterCount(text, "*")
      || hasMoreOpenParensThanClose(text)
      || !/[.?!]$/.test(text),
  };
}

function determineAppearanceSectionType(rawHtml) {
  const hasAppearances = /APPEARANCES OF COUNSEL/i.test(rawHtml);
  const hasPoints = /POINTS OF COUNSEL/i.test(rawHtml) || /<counselblock\b[^>]*type\s*=\s*["']?\s*points_of\b/i.test(rawHtml);
  if (hasAppearances && hasPoints) return "appearances_and_points_of_counsel";
  if (hasAppearances) return "appearances_only";
  if (hasPoints) return "points_of_counsel_only";
  return "none";
}

function findCitationLine(lines, tableTexts, companionJson) {
  const fromCompanion = [companionJson?.header?.slipOpinion, companionJson?.header?.officialCitation].filter(Boolean).join(" ").trim();
  if (fromCompanion) {
    return fromCompanion;
  }
  return [...lines, ...tableTexts.flat()].find((line) => /\bNY Slip Op\b|\bNY3d\b|\bNY2d\b|\bAD3d\b|\bAD2d\b/i.test(line)) ?? null;
}

function findCourtLine(lines, tableTexts, companionJson) {
  return companionJson?.header?.court
    ?? [...lines, ...tableTexts.flat()].find((line) => /Court of Appeals|Appellate Division/i.test(line))
    ?? null;
}

function findDateLines(lines, tableTexts) {
  return [...new Set([...lines, ...tableTexts.flat()].filter((line) => /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b|\b(?:Argued|Decided|Submitted|Heard)\b/i.test(line)))];
}

function findAuthorLine(lines, tableTexts) {
  return [...lines, ...tableTexts.flat()].find((line) => /\b(?:Per Curiam|[A-Z][A-Za-z.' -]+,\s*J\.)\b/.test(line)) ?? null;
}

function findSlipOpinion(rawHtml) {
  return rawHtml.match(/\b\d{4}\s+NY\s+Slip\s+Op\s+\d+(?:\(U\))?\b/i)?.[0] ?? null;
}

function findOfficialCitation(rawHtml) {
  return rawHtml.match(/\b\d+\s+(?:NY2d|NY3d|AD2d|AD3d|Misc(?:\s+2d|\s+3d)?)\s+\d+\b/)?.[0] ?? null;
}

function estimateFootnoteCount(rawHtml) {
  return countOccurrences(rawHtml, /Footnote\s+\*?\d*:/gi) || countOccurrences(rawHtml, /\[FN\*?\d+\]/gi);
}

function buildOpinionStructure(companionJson, rawHtml) {
  const opinions = companionJson?.opinions ?? [];
  const byKind = {};
  for (const opinion of opinions) {
    increment(byKind, opinion?.kind ?? "unknown");
  }
  const qualifierLines = opinions.flatMap((opinion) =>
    (opinion?.blocks ?? [])
      .map((block) => inlineText(block))
      .filter((text) => /OPINION OF THE COURT|MEMORANDUM|Per Curiam|CONCUR|DISSENT/i.test(text)),
  );

  return {
    totalWritings: opinions.length,
    byKind,
    authors: [...new Set(opinions.map((opinion) => opinion?.author).filter(Boolean))],
    qualifierLines: [...new Set(qualifierLines)],
    hasMemorandum: /Memorandum\.?/i.test(rawHtml) || qualifierLines.some((line) => /MEMORANDUM/i.test(line)),
    hasPerCuriam: /Per Curiam/i.test(rawHtml) || qualifierLines.some((line) => /Per Curiam/i.test(line)),
    concurrenceCount: (byKind.concurrence ?? 0) + (byKind.concurrence_in_result ?? 0),
    dissentCount: byKind.dissent ?? 0,
    mixedWritingCount: byKind.mixed ?? 0,
  };
}

function inlineText(block) {
  if (!block) return "";
  if (typeof block.text === "string") return block.text;
  if (Array.isArray(block.inlines)) {
    return block.inlines
      .map((inline) => {
        if (inline?.text) return inline.text;
        if (Array.isArray(inline?.children)) {
          return inline.children.map((child) => child?.text ?? "").join("");
        }
        return "";
      })
      .join("");
  }
  if (Array.isArray(block.blocks)) {
    return block.blocks.map((child) => inlineText(child)).join(" ");
  }
  return "";
}

function buildAnomalies({ tagStats, appearanceLikeLines, companionAppearances, headerTableTexts, companionJson, rawHtml }) {
  const anomalies = [];

  for (const tag of tagStats.unknownTags) {
    anomalies.push({
      code: "UNKNOWN_TAG",
      severity: "info",
      detail: `Encountered unknown tag <${tag}> in source HTML.`,
    });
  }

  for (const tag of tagStats.strayClosingTags) {
    anomalies.push({
      code: "STRAY_CLOSING_TAG",
      severity: "warning",
      detail: `Closing tag </${tag}> appears more times than opening tag <${tag}>.`,
    });
  }

  for (const line of appearanceLikeLines.filter((item) => item.possiblyTruncated)) {
    anomalies.push({
      code: "TRUNCATED_APPEARANCE_LINE",
      severity: "warning",
      detail: `Appearance-like line may be truncated: ${line.text}`,
    });
  }

  for (const line of appearanceLikeLines.filter((item) => item.hasArgumentTail)) {
    anomalies.push({
      code: "APPEARANCE_LINE_WITH_ARGUMENT_TAIL",
      severity: "info",
      detail: `Appearance-like line continues into argument text after "${line.terminalPhrase ?? "unknown ending"}".`,
    });
  }

  const rawAppearanceSentences = appearanceLikeLines.map((line) => ({
    text: line.sentenceText,
    normalized: normalizeAppearanceCompare(line.sentenceText),
    sideGuess: line.sideGuess,
  }));
  const rawNormalizedSet = new Set(rawAppearanceSentences.map((line) => line.normalized));
  const companionNormalizedSet = new Set(companionAppearances.map((line) => line.normalized));

  for (const appearance of companionAppearances.filter((item) => item.possiblyTruncated)) {
    anomalies.push({
      code: "JSON_APPEARANCE_TRUNCATED",
      severity: "warning",
      detail: `Companion JSON appearance looks truncated: ${appearance.text}`,
    });
  }

  if (rawAppearanceSentences.length !== companionAppearances.length) {
    anomalies.push({
      code: "JSON_APPEARANCE_COUNT_MISMATCH",
      severity: "warning",
      detail: `Raw source suggests ${rawAppearanceSentences.length} appearance line(s), but companion JSON has ${companionAppearances.length}.`,
    });
  }

  for (const rawAppearance of rawAppearanceSentences) {
    if (!companionNormalizedSet.has(rawAppearance.normalized)) {
      anomalies.push({
        code: "JSON_APPEARANCE_MISSING_RAW_SENTENCE",
        severity: "warning",
        detail: `Raw appearance sentence is not reproduced in companion JSON: ${rawAppearance.text}`,
      });
    }
  }

  for (const companionAppearance of companionAppearances) {
    if (!rawNormalizedSet.has(companionAppearance.normalized)) {
      anomalies.push({
        code: "JSON_APPEARANCE_UNMATCHED",
        severity: "info",
        detail: `Companion JSON appearance does not directly match any raw appearance sentence: ${companionAppearance.text}`,
      });
    }
  }

  const hasAppearanceContainerMalformation =
    (tagStats.unknownTags.includes("appcouns") || tagStats.strayClosingTags.includes("appcouns"))
    && rawAppearanceSentences.length > 0
    && companionAppearances.some((appearance) => appearance.possiblyTruncated || !rawNormalizedSet.has(appearance.normalized));
  if (hasAppearanceContainerMalformation) {
    anomalies.push({
      code: "MALFORMED_APPEARANCES_CONTAINER",
      severity: "warning",
      detail: "Malformed appearances container markup likely interferes with structured counsel extraction. Raw source still contains recoverable appearance sentences.",
    });
  }

  const mergedCompanionAppearance = companionAppearances.find((appearance) =>
    countDistinctSides(appearance.text) > 1,
  );
  if (mergedCompanionAppearance) {
    anomalies.push({
      code: "JSON_APPEARANCE_MULTI_SIDE_MERGE",
      severity: "warning",
      detail: `Companion JSON appearance appears to merge multiple sides into one entry: ${mergedCompanionAppearance.text}`,
    });
  }

  if (/POINTS OF COUNSEL/i.test(rawHtml) && !/APPEARANCES OF COUNSEL/i.test(rawHtml)) {
    anomalies.push({
      code: "POINTS_OF_COUNSEL_ONLY",
      severity: "info",
      detail: "Source uses POINTS OF COUNSEL without a separate APPEARANCES OF COUNSEL section.",
    });
  }

  if ((companionJson?.opinions?.length ?? 0) > 1) {
    anomalies.push({
      code: "MULTIPLE_WRITINGS",
      severity: "info",
      detail: `Companion JSON reports ${companionJson.opinions.length} writings.`,
    });
  }

  if (headerTableTexts.length > 1) {
    anomalies.push({
      code: "MULTIPLE_HEADER_TABLES",
      severity: "info",
      detail: `Found ${headerTableTexts.length} table elements before or within the header region.`,
    });
  }

  return anomalies;
}

function normalizeAppearanceCompare(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/([(])\s+/g, "$1");
}

function countDistinctSides(text) {
  const sides = new Set();
  const lower = text.toLowerCase();
  for (const token of [
    "for appellant",
    "for appellants",
    "for respondent",
    "for respondents",
    "for petitioner",
    "for petitioners",
    "amicus curiae",
    "amici curiae",
  ]) {
    if (lower.includes(token)) {
      sides.add(token);
    }
  }
  return sides.size;
}

function hasOddDelimiterCount(text, delimiter) {
  return text.split(delimiter).length % 2 === 0;
}

function hasMoreOpenParensThanClose(text) {
  const openCount = [...text].filter((char) => char === "(").length;
  const closeCount = [...text].filter((char) => char === ")").length;
  return openCount > closeCount;
}

function increment(target, key) {
  const safeKey = key ?? "unknown";
  target[safeKey] = (target[safeKey] ?? 0) + 1;
}

main().catch((error) => {
  console.error(error?.stack ?? String(error));
  process.exit(1);
});
