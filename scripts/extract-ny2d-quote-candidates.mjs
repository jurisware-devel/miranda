import fs from 'fs';
import path from 'path';

const corpusRoot = process.argv[2] ?? path.join('opinions', 'coa');
const outputBase =
  process.argv[3] ?? path.join('tmp', 'ny2d-quote-candidates');
const maxResults = Number.parseInt(process.argv[4] ?? '50', 10);
const skipResults = Number.parseInt(process.argv[5] ?? '0', 10);

const sentenceSegmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
const ny2dPattern = /\b(?:\d+\s+N\.?\s*Y\.?\s*2d|\d+\s+NY2D|\d+\s+NY2d)\b/i;
const citationSignalPattern =
  /\b(?:see|see also|cf\.?|quoting|citing|cited in|accord|but see|compare)\b/i;
const legalSignalPattern =
  /\b(?:we have held|we hold|we conclude|it is well settled|as a general rule|under|where|when|because|must|should|requires?|means|in determining|in resolving|the statute|due process|jurisdiction|preserv(?:e|ation)|meaningful representation|statutory interpretation|burden|standard|review|hearsay|testimonial|probable cause|suppression)\b/i;
const badStartPattern =
  /^(?:see|see also|cf\.?|but see|compare|id\.|supra|infra|here|there|then|thus|however|indeed|accordingly)\b/i;
const badContentPattern =
  /\b(?:defendant|plaintiff|claimant|petitioner|respondent)\b.{0,25}\b(?:argues|contends|asserts|testified|stated|admitted)\b/i;
const badLeadingCitationFragmentPattern =
  /^[A-Z][A-Za-z.& ]{0,24},\s+\d+\s+N\.?\s*Y\.?\s*2d/i;
const badEndingPattern = /(?:cf\.?|see also|see|accord)\.?$/i;
const standaloneLeadPattern =
  /^.{0,90}\b(?:is|are|was|were|be|being|must|should|may|can|cannot|lies|rests|requires?|means|den(?:y|ies)|preclude(?:s|d)?|acknowledge(?:s|d)?|need(?:s)?|entitled|hold|holds|conclude(?:s|d)?)\b/i;
const caseIdPattern = /^(?=.{1,128}$)(?=.*[A-Za-z0-9])[A-Za-z0-9._-]+$/;
const malformedMarkdownPattern =
  /(?:\*see(?: also| e\.g\.)? \*$|\*see \*(?:CPL|Penal|Judiciary|Executive|Correction|Family|Social|Vehicle)\b|\w\*\*|\*\*\s+[A-Z])/i;
const peopleStringCitePattern =
  /\b(?:see|see also|quoting|citing|cf\.?|accord|but see|compare)?\s*\*?(People v [A-Z][A-Za-z'.-]*(?:\s+[A-Z][A-Za-z'.-]*)*)\*?,\s+\d+\s+N\.?\s*Y\.?\s*2d\b/i;
const firstNy2dCitePattern =
  /\b(?:see|see also|quoting|citing|cf\.?|accord|but see|compare)?\s*(?:\*?[A-Z][^,;()]{0,80}\*?,\s+\d+\s+N\.?\s*Y\.?\s*2d\b|\d+\s+N\.?\s*Y\.?\s*2d\b)/i;

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
  if (caseId) {
    return `/case/${encodeURIComponent(caseId)}`;
  }

  return href;
}

function flattenInlineChunks(inline, format = { italic: false, href: '' }) {
  if (!inline || typeof inline !== 'object') {
    return [];
  }

  if (inline.type === 'page_marker') {
    return [];
  }

  if (inline.type === 'footnote_reference') {
    return [];
  }

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
  if (!block || block.type !== 'paragraph' || !Array.isArray(block.inlines)) {
    return [];
  }

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
  if (chunk.italic) {
    rendered = `*${rendered}*`;
  }
  if (chunk.href) {
    rendered = `[${rendered}](${chunk.href})`;
  }

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

function plainTextFromChunks(chunks) {
  return chunks.map((chunk) => chunk.text).join('');
}

function sentenceScore(sentence) {
  let score = 0;

  if (ny2dPattern.test(sentence)) score += 8;
  if (citationSignalPattern.test(sentence)) score += 3;
  if (legalSignalPattern.test(sentence)) score += 4;

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
  if ((sentence.match(/\b\d{4}\b/g) ?? []).length >= 2) score -= 2;
  if ((sentence.match(/"/g) ?? []).length % 2 === 1) score -= 2;

  const firstNy2dCite = sentence.match(firstNy2dCitePattern)?.[0] ?? '';
  if (firstNy2dCite && peopleStringCitePattern.test(firstNy2dCite)) score += 8;
  else if (peopleStringCitePattern.test(sentence)) score += 4;

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
  const opinions = Array.isArray(data.opinions) ? data.opinions : [];
  const candidates = [];

  for (const opinion of opinions) {
    const author =
      opinion.kind === 'opinion_of_the_court'
        ? 'Opinion of the Court'
        : opinion.author || opinion.kind || 'Opinion';

    for (const block of opinion.blocks ?? []) {
      const chunks = blockChunks(block);
      const paragraph = plainTextFromChunks(chunks);
      if (!paragraph || !ny2dPattern.test(paragraph)) continue;

      for (const part of sentenceSegmenter.segment(paragraph)) {
        const sentence = normalizeText(part.segment);
        const sentenceMarkdown = normalizeText(
          renderMarkdownRange(chunks, part.index, part.index + part.segment.length),
        );
        if (!ny2dPattern.test(sentence)) continue;
        if (sentence.length < 55 || sentence.length > 360) continue;
        if (!/[A-Za-z]/.test(sentence)) continue;
        if (badLeadingCitationFragmentPattern.test(sentence)) continue;
        if (badEndingPattern.test(sentence)) continue;
        if (!standaloneLeadPattern.test(sentence)) continue;
        if (malformedMarkdownPattern.test(sentenceMarkdown)) continue;

        candidates.push({
          quote: sentenceMarkdown,
          plainQuote: sentence,
          caseName,
          citation,
          decisionDate,
          author,
          sourcePath: filePath,
          score: sentenceScore(sentence),
        });
      }
    }
  }

  return candidates;
}

const allCandidates = [];
for (const filePath of walkJsonFiles(corpusRoot)) {
  allCandidates.push(...extractCandidates(filePath));
}

const seenQuotes = new Set();
const ranked = allCandidates
  .filter((candidate) => {
    const key = candidate.plainQuote.toLowerCase();
    if (seenQuotes.has(key)) return false;
    seenQuotes.add(key);
    return true;
  })
  .sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.plainQuote.length !== b.plainQuote.length) {
      return Math.abs(a.plainQuote.length - 170) - Math.abs(b.plainQuote.length - 170);
    }
    return a.caseName.localeCompare(b.caseName);
  })
  .slice(skipResults)
  .slice(0, maxResults);

fs.mkdirSync(path.dirname(outputBase), { recursive: true });
fs.writeFileSync(
  `${outputBase}.json`,
  `${JSON.stringify(
    ranked.map(({ plainQuote, ...candidate }) => candidate),
    null,
    2,
  )}\n`,
);

const markdown = [
  '# NY2D Quote Candidates',
  '',
  `Generated from \`${corpusRoot}\` on ${new Date().toISOString()}.`,
  skipResults > 0 ? `Skipped top ${skipResults} ranked candidate(s).` : null,
  '',
  ...ranked.flatMap((candidate, index) => [
    `## ${index + 1}. ${candidate.caseName}`,
    '',
    `> ${candidate.quote}`,
    '',
    `- Citation: ${candidate.citation || 'Unknown citation'}`,
    `- Author: ${candidate.author}`,
    `- Decision date: ${candidate.decisionDate || 'Unknown date'}`,
    `- Source: ${candidate.sourcePath}`,
    `- Score: ${candidate.score}`,
    '',
  ]),
];

fs.writeFileSync(`${outputBase}.md`, `${markdown.join('\n')}\n`);

console.log(
  `Wrote ${ranked.length} NY2D quote candidates to ${outputBase}.json and ${outputBase}.md`,
);
