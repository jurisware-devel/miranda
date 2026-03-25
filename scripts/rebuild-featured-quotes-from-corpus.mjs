import fs from 'fs';
import path from 'path';

const corpusRoot = path.join('opinions', 'coa');
const outputDataFile = path.join('src', 'data', 'featuredQuotes.ts');
const outputBase = path.join('tmp', 'featured-quotes-100');
const startYear = 2003;
const endYear = 2026;
const targetTotal = 100;
const baselinePerYear = 4;
const perYearSoftCap = 5;

const sentenceSegmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
const ny2dPattern = /\b\d+\s+N\.?\s*Y\.?\s*2d\b/i;
const peopleStringCitePattern =
  /\b(?:see|see also|quoting|citing|cf\.?|accord|but see|compare)?\s*\*?(People v [A-Z][A-Za-z'.-]*(?:\s+[A-Z][A-Za-z'.-]*)*)\*?,\s+\d+\s+N\.?\s*Y\.?\s*2d\b/i;
const firstNy2dCitePattern =
  /\b(?:see|see also|quoting|citing|cf\.?|accord|but see|compare)?\s*(?:\*?[A-Z][^,;()]{0,100}\*?,\s+\d+\s+N\.?\s*Y\.?\s*2d\b|\d+\s+N\.?\s*Y\.?\s*2d\b)/i;
const legalSignalPattern =
  /\b(?:we have held|we hold|we conclude|it is well settled|as a general rule|under|where|when|because|must|should|requires?|means|due process|preserv(?:e|ation)|meaningful representation|statutory interpretation|burden|standard|review|hearsay|testimonial|probable cause|suppression|jurisdiction|error|reversal|harmless|sentence|plea|evidence|counsel|waiver)\b/i;
const standaloneLeadPattern =
  /^.{0,90}\b(?:is|are|was|were|be|being|must|should|may|can|cannot|lies|rests|requires?|means|den(?:y|ies)|preclude(?:s|d)?|acknowledge(?:s|d)?|need(?:s)?|entitled|hold|holds|conclude(?:s|d)?)\b/i;
const badStartPattern =
  /^(?:see|see also|cf\.?|but see|compare|id\.|supra|infra|here|there|then|thus|however|indeed|accordingly)\b/i;
const badEndingPattern = /(?:cf\.?|see also|see|accord)\.?$/i;
const badLeadingCitationFragmentPattern =
  /^[A-Z][A-Za-z.& ]{0,24},\s+\d+\s+N\.?\s*Y\.?\s*2d/i;
const badContentPattern =
  /\b(?:defendant|plaintiff|claimant|petitioner|respondent)\b.{0,25}\b(?:argues|contends|asserts|testified|stated|admitted)\b/i;
const malformedMarkdownPattern =
  /(?:\*see(?: also| e\.g\.)? \*$|\*see \*(?:CPL|Penal|Judiciary|Executive|Correction|Family|Social|Vehicle)\b|\w\*\*|\*\*\s+[A-Z])/i;
const caseIdPattern = /^(?=.{1,128}$)(?=.*[A-Za-z0-9])[A-Za-z0-9._-]+$/;

function walkJsonFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsonFiles(fullPath, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(fullPath);
    }
  }
  return out;
}

function isValidCaseId(caseId) {
  return (
    !!caseId &&
    caseId !== '.' &&
    caseId !== '..' &&
    !caseId.includes('/') &&
    !caseId.includes('\\') &&
    !caseId.includes('%') &&
    caseIdPattern.test(caseId)
  );
}

function extractCaseIdFromOpinionHref(href) {
  const trimmed = href.trim();
  if (!trimmed) return '';
  const withoutQueryOrHash = trimmed.replace(/[?#].*$/, '');
  const basename = withoutQueryOrHash.split('/').pop() ?? '';
  if (!/\.html?$/i.test(basename)) return '';
  const caseId = basename.replace(/\.html?$/i, '');
  return isValidCaseId(caseId) ? caseId : '';
}

function resolveInlineHref(href) {
  if (!href) return '';
  if (/^(#|https?:\/\/|mailto:)/i.test(href)) return href;
  const caseId = extractCaseIdFromOpinionHref(href);
  return caseId ? `/case/${encodeURIComponent(caseId)}` : href;
}

function flattenInlineChunks(inline, format = { italic: false, href: '' }) {
  if (!inline || typeof inline !== 'object') return [];
  if (inline.type === 'page_marker' || inline.type === 'footnote_reference') return [];
  if (typeof inline.text === 'string') {
    return [{ text: inline.text, italic: format.italic, href: format.href }];
  }
  if (inline.type === 'emphasis' && Array.isArray(inline.children)) {
    return inline.children.flatMap((child) =>
      flattenInlineChunks(child, { ...format, italic: true }),
    );
  }
  if (inline.type === 'link' && Array.isArray(inline.children)) {
    return inline.children.flatMap((child) =>
      flattenInlineChunks(child, { ...format, href: resolveInlineHref(inline.href ?? '') }),
    );
  }
  if (Array.isArray(inline.children)) {
    return inline.children.flatMap((child) => flattenInlineChunks(child, format));
  }
  return [];
}

function blockChunks(block) {
  if (!block || block.type !== 'paragraph' || !Array.isArray(block.inlines)) return [];
  return block.inlines.flatMap((inline) => flattenInlineChunks(inline));
}

function normalizeText(text) {
  return text
    .replace(/\{\*\*[^}]+\}/g, ' ')
    .replace(/\\\{\\\*\\\*[^}]+\}/g, ' ')
    .replace(/^\s*\[[0-9]+\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:)\]])/g, '$1')
    .replace(/([([])\s+/g, '$1')
    .trim();
}

function escapeMarkdownText(text) {
  return text.replace(/\\/g, '\\\\').replace(/([\[\]*_])/g, '\\$1');
}

function renderMarkdownSlice(chunk, start, end) {
  const text = chunk.text.slice(start, end);
  if (!text) return '';
  let rendered = escapeMarkdownText(text);
  if (chunk.italic) rendered = `*${rendered}*`;
  if (chunk.href) rendered = `[${rendered}](${chunk.href})`;
  return rendered;
}

function renderMarkdownRange(chunks, start, end) {
  let cursor = 0;
  let output = '';
  for (const chunk of chunks) {
    const chunkEnd = cursor + chunk.text.length;
    const overlapStart = Math.max(start, cursor);
    const overlapEnd = Math.min(end, chunkEnd);
    if (overlapStart < overlapEnd) {
      output += renderMarkdownSlice(chunk, overlapStart - cursor, overlapEnd - cursor);
    }
    cursor = chunkEnd;
    if (cursor >= end) break;
  }
  return output;
}

function firstNy2dCitation(sentence) {
  return sentence.match(firstNy2dCitePattern)?.[0] ?? '';
}

function sentenceScore(sentence) {
  let score = 0;
  if (ny2dPattern.test(sentence)) score += 8;
  if (legalSignalPattern.test(sentence)) score += 4;

  const firstCite = firstNy2dCitation(sentence);
  if (firstCite && peopleStringCitePattern.test(firstCite)) score += 10;
  else if (peopleStringCitePattern.test(sentence)) score += 4;

  const length = sentence.length;
  if (length >= 90 && length <= 260) score += 6;
  else if (length >= 70 && length <= 320) score += 3;
  else score -= 4;

  const citationCount = (sentence.match(/\b\d+\s+N\.?\s*Y\.?\s*2d\b/gi) ?? []).length;
  score += Math.min(citationCount, 2);

  if (badStartPattern.test(sentence)) score -= 2;
  if (badContentPattern.test(sentence)) score -= 4;
  if (badLeadingCitationFragmentPattern.test(sentence)) score -= 8;
  if (badEndingPattern.test(sentence)) score -= 8;
  if (/[!?]/.test(sentence)) score -= 1;
  return score;
}

function extractCandidates(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const sanitized = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const data = JSON.parse(sanitized);
  const header = data.header ?? {};
  const caseName = header.title ?? path.basename(filePath, '.json');
  const citation = header.officialCitation ?? header.slipOpinion ?? '';
  const decisionDate = header.decisionDate ?? '';
  const decisionYear = Number.parseInt((decisionDate ?? '').slice(0, 4), 10);
  const opinions = Array.isArray(data.opinions) ? data.opinions : [];
  const caseId = path.basename(filePath, '.json');
  const candidates = [];

  if (!Number.isInteger(decisionYear) || decisionYear < startYear || decisionYear > endYear) {
    return candidates;
  }

  for (const opinion of opinions) {
    const author =
      opinion.kind === 'opinion_of_the_court'
        ? 'Opinion of the Court'
        : opinion.author || opinion.kind || 'Opinion';

    for (const block of opinion.blocks ?? []) {
      const chunks = blockChunks(block);
      const paragraph = chunks.map((chunk) => chunk.text).join('');
      if (!paragraph || !ny2dPattern.test(paragraph)) continue;

      for (const part of sentenceSegmenter.segment(paragraph)) {
        const plainQuote = normalizeText(part.segment);
        const quote = normalizeText(
          renderMarkdownRange(chunks, part.index, part.index + part.segment.length),
        );

        if (!ny2dPattern.test(plainQuote)) continue;
        if (plainQuote.length < 55 || plainQuote.length > 360) continue;
        if (!/[A-Za-z]/.test(plainQuote)) continue;
        if (!standaloneLeadPattern.test(plainQuote)) continue;
        if (badLeadingCitationFragmentPattern.test(plainQuote)) continue;
        if (badEndingPattern.test(plainQuote)) continue;
        if (malformedMarkdownPattern.test(quote)) continue;

        candidates.push({
          quote,
          plainQuote,
          caseName,
          citation,
          author,
          caseId,
          decisionDate,
          decisionYear: String(decisionYear),
          sourcePath: filePath,
          score: sentenceScore(plainQuote),
          firstCite: firstNy2dCitation(plainQuote),
          firstCiteIsPeopleString: peopleStringCitePattern.test(firstNy2dCitation(plainQuote)),
        });
      }
    }
  }

  return candidates;
}

const years = Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
const allCandidates = walkJsonFiles(corpusRoot).flatMap(extractCandidates);

const deduped = [];
const seenQuotes = new Set();
for (const candidate of allCandidates) {
  const key = candidate.plainQuote.toLowerCase();
  if (seenQuotes.has(key)) continue;
  seenQuotes.add(key);
  deduped.push(candidate);
}

const byYear = new Map(
  years.map((year) => [
    year,
    deduped
      .filter((candidate) => Number.parseInt(candidate.decisionYear, 10) === year)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.firstCiteIsPeopleString !== b.firstCiteIsPeopleString) {
          return Number(b.firstCiteIsPeopleString) - Number(a.firstCiteIsPeopleString);
        }
        return Math.abs(a.plainQuote.length - 170) - Math.abs(b.plainQuote.length - 170);
      }),
  ]),
);

const selected = [];
const selectedCaseIds = new Set();
const perYearCounts = new Map(years.map((year) => [year, 0]));

function trySelect(candidate) {
  if (selectedCaseIds.has(candidate.caseId)) return false;
  selected.push(candidate);
  selectedCaseIds.add(candidate.caseId);
  const year = Number.parseInt(candidate.decisionYear, 10);
  perYearCounts.set(year, (perYearCounts.get(year) ?? 0) + 1);
  return true;
}

for (const year of years) {
  const pool = byYear.get(year) ?? [];
  for (const candidate of pool) {
    if ((perYearCounts.get(year) ?? 0) >= baselinePerYear) break;
    trySelect(candidate);
  }
}

const leftovers = deduped
  .filter((candidate) => !selectedCaseIds.has(candidate.caseId))
  .sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Math.abs(a.plainQuote.length - 170) - Math.abs(b.plainQuote.length - 170);
  });

for (const candidate of leftovers) {
  if (selected.length >= targetTotal) break;
  const year = Number.parseInt(candidate.decisionYear, 10);
  if ((perYearCounts.get(year) ?? 0) >= perYearSoftCap) continue;
  trySelect(candidate);
}

for (const candidate of leftovers) {
  if (selected.length >= targetTotal) break;
  trySelect(candidate);
}

const selectedSorted = selected
  .slice(0, targetTotal)
  .sort((a, b) => {
    if (a.decisionYear !== b.decisionYear) return a.decisionYear.localeCompare(b.decisionYear);
    if (b.score !== a.score) return b.score - a.score;
    return a.caseName.localeCompare(b.caseName);
  });

fs.mkdirSync(path.dirname(outputBase), { recursive: true });
fs.writeFileSync(`${outputBase}.json`, `${JSON.stringify(selectedSorted, null, 2)}\n`);

const markdown = [
  '# Featured Quotes 100',
  '',
  `Generated from \`${corpusRoot}\` on ${new Date().toISOString()}.`,
  '',
  '## Year Counts',
  '',
  ...years.map((year) => `- ${year}: ${selectedSorted.filter((row) => row.decisionYear === String(year)).length}`),
  '',
  ...selectedSorted.flatMap((candidate, index) => [
    `## ${index + 1}. ${candidate.caseName} (${candidate.decisionYear})`,
    '',
    `> ${candidate.quote}`,
    '',
    `- Citation: ${candidate.citation}`,
    `- Author: ${candidate.author}`,
    `- Case ID: ${candidate.caseId}`,
    `- Source: ${candidate.sourcePath}`,
    `- Score: ${candidate.score}`,
    `- First cited NY2d string cite is full People format: ${candidate.firstCiteIsPeopleString ? 'yes' : 'no'}`,
    '',
  ]),
];
fs.writeFileSync(`${outputBase}.md`, `${markdown.join('\n')}\n`);

const outputData = selectedSorted.map(
  ({ quote, caseName, citation, author, caseId, decisionYear }) => ({
    quote,
    caseName,
    citation,
    author,
    caseId,
    decisionYear,
  }),
);

const tsFile = `export type FeaturedQuote = {\n  quote: string;\n  caseName: string;\n  citation: string;\n  author: string;\n  caseId: string;\n  decisionYear: string;\n};\n\nexport const featuredQuotes: FeaturedQuote[] = ${JSON.stringify(outputData, null, 2)};\n`;
fs.writeFileSync(outputDataFile, tsFile);

console.log(
  JSON.stringify(
    {
      selected: selectedSorted.length,
      outputDataFile,
      reviewFiles: [`${outputBase}.json`, `${outputBase}.md`],
      yearCounts: Object.fromEntries(
        years.map((year) => [year, selectedSorted.filter((row) => row.decisionYear === String(year)).length]),
      ),
    },
    null,
    2,
  ),
);
