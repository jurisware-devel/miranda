#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_ROOT = "/Users/jonathan/Projects/miranda/opinions/coa/2023";

const KNOWN_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "body",
  "br",
  "center",
  "div",
  "em",
  "font",
  "head",
  "html",
  "i",
  "img",
  "meta",
  "opinion",
  "p",
  "style",
  "script",
  "sup",
  "table",
  "tbody",
  "td",
  "title",
  "tr",
  "u",
]);

const TITLE_PATTERN = /<title>([\s\S]*?)<\/title>/i;
const BODY_PATTERN = /<body\b[^>]*>([\s\S]*?)<\/body>/i;
const TABLE_PATTERN = /<table\b[\s\S]*?<\/table>/gi;
const P_PATTERN = /<p\b[^>]*>([\s\S]*?)(?=<p\b|<\/body>|<div\b|<\/div>|<table\b|<script\b|$)/gi;
const PAGE_MARKER_PATTERN = /\{\*\*[^}]+\}|\[\*\d+\]/g;
const TAG_PATTERN = /<\/?([a-zA-Z][\w:-]*)\b/g;
const WRITING_HEADING_PATTERN =
  /^(?<author>(?:Chief Judge|Acting Chief Judge)\s+[A-Z][A-Za-z .'-]+|[A-Z][A-Za-z .'-]+,\s*(?:J|Ch\. J)\.?)\s*\((?<role>[^)]+)\)\.?/i;

async function main() {
  const root = path.resolve(process.argv[2] ?? DEFAULT_ROOT);
  const htmlPaths = (await fs.readdir(root))
    .filter((name) => name.toLowerCase().endsWith(".htm"))
    .sort()
    .map((name) => path.join(root, name));

  for (const htmlPath of htmlPaths) {
    const note = await analyzeHtmlFile(htmlPath);
    const notePath = htmlPath.replace(/\.htm$/i, ".notes.json");
    await fs.writeFile(notePath, `${JSON.stringify(note, null, 2)}\n`, "utf8");
  }

  console.log(
    JSON.stringify(
      {
        root,
        filesAnalyzed: htmlPaths.length,
        notesGenerated: htmlPaths.length,
      },
      null,
      2,
    ),
  );
}

async function analyzeHtmlFile(htmlPath) {
  const rawHtml = await fs.readFile(htmlPath, "utf8");
  const bodyHtml = capture(rawHtml, BODY_PATTERN) ?? rawHtml;
  const title = normalizeText(capture(rawHtml, TITLE_PATTERN) ?? "");
  const tables = [...bodyHtml.matchAll(TABLE_PATTERN)].map((match) => match[0]);
  const headerLines = extractTableLines(tables[0] ?? "");
  const citationLine = headerLines.find((line) => /NY Slip Op/i.test(line)) ?? null;
  const authorLine = headerLines.find((line) => /(?:Chief Judge|Acting Chief Judge|, J\.|, Ch\. J\.)/.test(line)) ?? null;
  const cleanedParagraphs = extractParagraphs(bodyHtml);
  const voteLine =
    [...cleanedParagraphs].reverse().find((line) =>
      /^(?:Concur:|Chief Judge|Acting Chief Judge|Judge|Judges)\b.*(?:concur|dissent|took no part)/i.test(line),
    ) ?? null;
  const decisionLine =
    [...cleanedParagraphs].reverse().find((line) => /^(?:On review .*|Order .*|Judgment .*|Appeal .*|Matter .*|Proceeding .*|Order and judgment .*)/i.test(line)) ??
    cleanedParagraphs.find((line) => /(?:affirmed|reversed|modified|vacated|dismissed|remitted)/i.test(line)) ??
    null;
  const mainAuthor = cleanJudgeName(authorLine ? authorLine.replace(/,\s*(?:J|Ch\. J)\.?$/i, "") : null);
  const memorandum = /\bMemorandum\./i.test(bodyHtml);
  const perCuriam = /<opinion\b[^>]*category\s*=\s*["']per_curiam["']/i.test(rawHtml) || /\bPer Curiam\b/i.test(bodyHtml);
  const appearanceLines = cleanedParagraphs.filter((line) => /\bfor (?:appellant|respondent|petitioner|claimant|appellee|plaintiff|defendant)s?\.?$/i.test(line));
  const respondentPrecluded = cleanedParagraphs.some((line) => /Respondent precluded\./i.test(line));
  const citationShape = buildCitationShape(citationLine);
  const writingHeadings = extractSeparateWritingHeadings(cleanedParagraphs, mainAuthor);
  const decisionForm = determineDecisionForm({ memorandum, perCuriam, voteLine, writingHeadings });
  const hasMajority = determineHasMajority({ voteLine, decisionForm });
  const writings = buildWritings({
    decisionForm,
    mainAuthor,
    memorandum,
    perCuriam,
    voteLine,
    writingHeadings,
  });
  const unknownTags = collectUnknownTags(rawHtml);
  const headerQuirks = [];
  const sourceQuirks = [];
  const sourceTypos = [];
  const analysisNotes = [];

  if (!authorLine && !perCuriam) {
    headerQuirks.push("header table omits a judge author line");
  }
  if (citationShape.officialCitationInBrackets) {
    headerQuirks.push("official citation is embedded in a bracketed slip-op header line");
  }
  if (citationShape.officialCitationInParentheses) {
    headerQuirks.push("official citation is embedded in a parenthetical slip-op header line");
  }
  const arguedLine = cleanedParagraphs.find((line) => /\bArgued\b/i.test(line));
  if (arguedLine && /\breargued\b/i.test(arguedLine)) {
    headerQuirks.push("argument line reflects a reargument before decision");
    analysisNotes.push({
      type: "structure",
      text: "The source reflects both an original argument and a later reargument before decision.",
    });
  }
  if (respondentPrecluded) {
    sourceQuirks.push("appearances section includes a respondent-precluded line instead of a normal responsive appearance");
    analysisNotes.push({
      type: "counsel",
      text: "The appearances section is asymmetric because the respondent is marked as precluded rather than listed with a conventional appearance line.",
    });
  }
  if (unknownTags.length > 0) {
    sourceQuirks.push(`source uses nonstandard tag(s): ${unknownTags.join(", ")}`);
    sourceTypos.push({
      location: "html_markup",
      issue: `nonstandard tag(s): ${unknownTags.join(", ")}`,
      effect: "lightweight HTML extraction should not assume only standard reporter tags appear in the source",
    });
    analysisNotes.push({
      type: "source",
      text: `The HTML includes nonstandard tag markup (${unknownTags.join(", ")}), which is a small parser-risk signal.`,
    });
  }
  if (memorandum) {
    analysisNotes.push({
      type: "structure",
      text: writingHeadings.length
        ? "The court resolves the appeal by memorandum and the source also includes separate writing(s)."
        : "The court resolves the appeal by memorandum rather than a full signed majority opinion.",
    });
  }
  if (decisionForm === "mixed") {
    analysisNotes.push({
      type: "stanbook",
      text: "The vote line reflects concurring-in-result or otherwise split alignment, so no single majority rationale should be assumed from the source alone.",
    });
  }

  const mixedResultDisposition = /\bin part\b/i.test(decisionLine ?? "");
  const hasMultipleResults = mixedResultDisposition || /\b(?:two appeals|two orders|both appeals|both orders)\b/i.test(bodyHtml);
  const hasMultipleLowerCourtRulings = /\b(?:two appeals|two orders|both appeals|both orders)\b/i.test(bodyHtml);

  return {
    notesVersion: "1.0",
    caseId: path.basename(htmlPath, ".htm"),
    sourcePath: `coa/2023/${path.basename(htmlPath)}`,
    provenance: {
      creationMode: "codex_updated",
      reviewStatus: "codex_amended",
      lastUpdatedAt: new Date().toISOString(),
      updatedBy: "codex",
      confidence: writings.length > 1 || decisionForm === "mixed" ? "medium" : "high",
    },
    decisionStructure: {
      decisionForm,
      hasMajority,
      mainWritingKind: writings[0]?.kind ?? "unclear",
      mainWritingAuthor: writings[0]?.author ?? null,
      isMemorandum: memorandum,
      isPerCuriam: perCuriam,
      isOpinionOfTheCourt: /OPINION OF THE COURT/i.test(bodyHtml),
      notes: summarizeDecision({ decisionForm, memorandum, perCuriam, writings }),
    },
    writings,
    resultStructure: {
      hasMultipleResults,
      hasMultipleLowerCourtRulings,
      resultUnits: decisionLine ? [{ label: "disposition", disposition: decisionLine }] : [],
      mixedResultDisposition,
      confidence: hasMultipleResults ? "medium" : "low",
    },
    sourceFeatures: {
      citationShape,
      counselShape: {
        usesAppearancesOfCounsel: appearanceLines.length > 0 || respondentPrecluded,
        usesPointsOfCounsel: false,
        appearancesMustBeDerivedFromPointsOfCounsel: false,
      },
      headerQuirks,
      sourceQuirks,
    },
    stanbookHints: {
      treatAsPlurality: decisionForm === "plurality",
      noMajorityWriting: hasMajority === false,
      multipleOrdersResolved: hasMultipleResults,
      deriveAppearancesFrom: appearanceLines.length > 0 || respondentPrecluded ? "header_lines" : null,
      officialCitationSource: deriveOfficialCitationSource(citationShape),
      sourceTypos,
      parserCautions: buildParserCautions({
        memorandum,
        respondentPrecluded,
        decisionForm,
        writingHeadings,
      }),
    },
    analysisNotes,
  };
}

function capture(text, pattern) {
  const match = text.match(pattern);
  return match?.[1] ?? null;
}

function extractTableLines(tableHtml) {
  return normalizeText(tableHtml)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractParagraphs(bodyHtml) {
  const paragraphs = [];
  for (const match of bodyHtml.matchAll(P_PATTERN)) {
    const text = normalizeText(match[1]);
    if (text) {
      paragraphs.push(text);
    }
  }
  return paragraphs;
}

function normalizeText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|tr|table|td|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|&ensp;|&emsp;/gi, " ")
    .replace(/&thinsp;/gi, " ")
    .replace(/&#167;|&sect;/gi, "§")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "-")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(PAGE_MARKER_PATTERN, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanJudgeName(name) {
  return name?.replace(/^Acting Chief Judge\s+/i, "").replace(/^Chief Judge\s+/i, "").trim() ?? null;
}

function buildCitationShape(citationLine) {
  return {
    slipOpinionLineIncludesOfficialCitation: Boolean(citationLine && /\[(.*?)\]|\((.*?)\)/.test(citationLine)),
    officialCitationInParentheses: Boolean(citationLine && /\([^)]*NY3d[^)]*\)/.test(citationLine)),
    officialCitationInBrackets: Boolean(citationLine && /\[[^\]]*NY3d[^\]]*\]/.test(citationLine)),
  };
}

function determineDecisionForm({ memorandum, perCuriam, voteLine, writingHeadings }) {
  const lowerVoteLine = voteLine?.toLowerCase() ?? "";
  if (/\bplurality\b/.test(lowerVoteLine)) {
    return "plurality";
  }
  if (perCuriam && writingHeadings.length >= 2) {
    return "mixed";
  }
  if (/\bconcur in result\b/.test(lowerVoteLine) || writingHeadings.some((item) => item.kind === "concurrence_in_result")) {
    return "mixed";
  }
  if (memorandum) {
    return "memorandum";
  }
  if (perCuriam) {
    return "per_curiam";
  }
  return "opinion_of_the_court";
}

function determineHasMajority({ voteLine, decisionForm }) {
  const lowerVoteLine = voteLine?.toLowerCase() ?? "";
  if (decisionForm === "plurality") {
    return false;
  }
  if (decisionForm === "mixed" || /\bconcur in result\b/.test(lowerVoteLine)) {
    return null;
  }
  if (!voteLine) {
    return null;
  }
  return true;
}

function extractSeparateWritingHeadings(paragraphs, mainAuthor) {
  const writings = [];
  for (const paragraph of paragraphs) {
    const match = paragraph.match(WRITING_HEADING_PATTERN);
    if (!match) {
      continue;
    }
    const author = cleanJudgeName(match.groups.author.replace(/,\s*(?:J|Ch\. J)\.?$/i, ""));
    if (author === mainAuthor) {
      continue;
    }
    const role = match.groups.role.toLowerCase();
    writings.push({
      author,
      role,
      kind: roleToKind(role),
    });
  }
  return dedupeByAuthorAndKind(writings);
}

function roleToKind(role) {
  if (/concurr(?:ing)? in result/.test(role)) {
    return "concurrence_in_result";
  }
  if (/concurr(?:ing)? in part and dissent(?:ing)? in part/.test(role)) {
    return "concurrence_in_part_and_dissent_in_part";
  }
  if (/dissent(?:ing)? in part/.test(role)) {
    return "dissent_in_part";
  }
  if (/concurr(?:ing)? in part/.test(role)) {
    return "concurrence_in_part";
  }
  if (/dissent/.test(role)) {
    return "dissent";
  }
  if (/concurr/.test(role)) {
    return "concurrence";
  }
  return "unclear";
}

function dedupeByAuthorAndKind(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.author}:${item.kind}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildWritings({ decisionForm, mainAuthor, memorandum, perCuriam, voteLine, writingHeadings }) {
  const writings = [];
  const mainKind =
    decisionForm === "plurality"
      ? "plurality"
      : memorandum
        ? "memorandum"
        : perCuriam
          ? "per_curiam"
          : "opinion_of_the_court";
  const mainJoiners = extractMainJoiners(voteLine, mainAuthor, decisionForm);

  writings.push({
    order: 1,
    author: mainAuthor,
    kind: mainKind,
    label: "OPINION OF THE COURT",
    hasJoiners: mainJoiners.length > 0,
    joiners: mainJoiners,
    scope: memorandum ? "memorandum disposition" : "main court writing",
    relationshipToResult: decisionForm === "mixed" ? "sets the lead court rationale but may not supply a single majority rationale" : "controls the court's disposition",
    confidence: decisionForm === "mixed" ? "medium" : "high",
  });

  let order = 2;
  for (const heading of writingHeadings) {
    writings.push({
      order,
      author: heading.author,
      kind: heading.kind,
      label: heading.role,
      hasJoiners: false,
      joiners: extractJoinersForAuthor(voteLine, heading.author),
      scope: null,
      relationshipToResult: relationshipFromKind(heading.kind),
      confidence: "medium",
    });
    order += 1;
  }
  return writings;
}

function extractMainJoiners(voteLine, mainAuthor, decisionForm) {
  if (!voteLine || decisionForm === "mixed") {
    return [];
  }
  const segment = voteLine.match(/^.*?\bconcur\b\.?/i)?.[0] ?? voteLine;
  const joiners = extractJudgeNames(segment);
  return joiners.filter((name) => name !== mainAuthor);
}

function extractJoinersForAuthor(voteLine, author) {
  if (!voteLine) {
    return [];
  }
  const escaped = author.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = voteLine.match(
    new RegExp(`(?:Judge|Chief Judge|Acting Chief Judge)\\s+${escaped}[^.]*?in (?:an|a\\s+separate)?\\s*[^.]*?opinion, in which ([^.]+?) concur`, "i"),
  );
  return match ? extractJudgeNames(match[1]) : [];
}

function extractJudgeNames(text) {
  const names = [];
  const chunks = text.split(/\b(?:Acting Chief Judge|Chief Judge|Judges|Judge)\b/gi).slice(1);
  for (const chunk of chunks) {
    const label = chunk
      .replace(/^[\s:]+/, "")
      .split(/\b(?:concur|concurs|dissent|dissents|took no part|in an opinion|in a separate opinion|in a concurring opinion|for reasons stated)\b/i)[0]
      .replace(/\.$/, "")
      .replace(/\s+and\s+/g, ", ");
    for (const rawName of label.split(",")) {
      const name = cleanJudgeName(rawName.trim());
      if (name && !/\b(?:Acting|Chief|Judge|Judges)\b/i.test(name)) {
        names.push(name);
      }
    }
  }
  return [...new Set(names)];
}

function relationshipFromKind(kind) {
  switch (kind) {
    case "concurrence":
      return "agrees with the disposition but offers separate reasoning";
    case "concurrence_in_result":
      return "agrees only with the result";
    case "dissent":
    case "dissent_in_part":
      return "disagrees with the court's disposition";
    case "concurrence_in_part":
      return "agrees with only part of the court's reasoning or disposition";
    case "concurrence_in_part_and_dissent_in_part":
      return "takes a mixed position relative to the court's disposition";
    default:
      return "separate writing";
  }
}

function summarizeDecision({ decisionForm, memorandum, perCuriam, writings }) {
  if (decisionForm === "mixed") {
    return "The source reflects an opinion of the court with separate writings and split alignment in the final vote line.";
  }
  if (memorandum && writings.length > 1) {
    return "The court resolves the appeal by memorandum and includes at least one separate writing.";
  }
  if (memorandum) {
    return "The decision is a memorandum disposition.";
  }
  if (perCuriam) {
    return "The decision is presented as a per curiam court writing.";
  }
  return "The source presents a signed opinion of the court.";
}

function deriveOfficialCitationSource(citationShape) {
  if (citationShape.officialCitationInParentheses) {
    return "parenthetical_header_citation";
  }
  if (citationShape.officialCitationInBrackets) {
    return "bracketed_header_citation";
  }
  return "plain_header_line";
}

function buildParserCautions({ memorandum, respondentPrecluded, decisionForm, writingHeadings }) {
  const cautions = [];
  if (memorandum) {
    cautions.push("do not assume a full signed majority opinion structure when the source says Memorandum.");
  }
  if (respondentPrecluded) {
    cautions.push("treat the respondent-precluded line as an appearance-section outcome, not a normal counsel entry.");
  }
  if (decisionForm === "mixed") {
    cautions.push("do not infer a single majority rationale from concurring-in-result or split vote language alone.");
  }
  if (writingHeadings.length > 0) {
    cautions.push("preserve separate writings as distinct opinion records rather than folding them into the main writing.");
  }
  return cautions;
}

function collectUnknownTags(rawHtml) {
  const found = new Set();
  for (const match of rawHtml.matchAll(TAG_PATTERN)) {
    const tag = match[1].toLowerCase();
    if (!KNOWN_TAGS.has(tag)) {
      found.add(tag);
    }
  }
  return [...found].sort();
}

await main();
