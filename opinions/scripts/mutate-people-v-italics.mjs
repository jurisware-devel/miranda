import fs from "fs";
import path from "path";

const root = process.cwd();
const years = Array.from({ length: 2026 - 2003 + 1 }, (_, i) => 2003 + i);

const partialMultiWordItalicsPattern =
  /\*People v ([A-Z][A-Za-z]+)\*(?=(?:[- ][A-Z]))/g;
const oneWordPattern =
  /(?<!\*)\b(People v [A-Z][A-Za-z]+)\b(?!\*)(?![- ][A-Z])/g;
const multiWordPattern = /\bPeople v ([A-Z][A-Za-z]+(?:[- ][A-Z][A-Za-z]+)+)\b/g;
const broadItalicsPattern = /\*[^*\n]*People v [^*\n]{40,}\*/g;

const report = {
  filesScanned: 0,
  filesChanged: 0,
  replacements: 0,
  multiWordNames: new Map(),
  suspiciousItalics: [],
};

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    processFile(fullPath);
  }
}

function addMultiWord(name, file, lineNumber, line) {
  const current = report.multiWordNames.get(name) ?? {
    count: 0,
    examples: [],
  };
  current.count += 1;
  if (current.examples.length < 5) {
    current.examples.push({
      file: path.relative(root, file),
      lineNumber,
      line: line.trim(),
    });
  }
  report.multiWordNames.set(name, current);
}

function processFile(file) {
  report.filesScanned += 1;
  const original = fs.readFileSync(file, "utf8");
  const lines = original.split("\n");

  lines.forEach((line, index) => {
    for (const match of line.matchAll(multiWordPattern)) {
      addMultiWord(match[1], file, index + 1, line);
    }
  });

  let replacementsInFile = 0;
  const normalized = original.replace(
    partialMultiWordItalicsPattern,
    (_, firstWord) => `People v ${firstWord}`
  );

  const updated = normalized.replace(oneWordPattern, (_, citation) => {
    replacementsInFile += 1;
    return `*${citation}*`;
  });

  if (updated !== original) {
    fs.writeFileSync(file, updated);
    report.filesChanged += 1;
    report.replacements += replacementsInFile;
  }

  const updatedLines = updated.split("\n");
  updatedLines.forEach((line, index) => {
    for (const match of line.matchAll(broadItalicsPattern)) {
      report.suspiciousItalics.push({
        file: path.relative(root, file),
        lineNumber: index + 1,
        excerpt: match[0],
      });
    }
  });
}

for (const year of years) {
  walk(path.join(root, "coa", String(year)));
}

const multiWordNames = [...report.multiWordNames.entries()]
  .sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    return a[0].localeCompare(b[0]);
  })
  .map(([name, data]) => ({
    name,
    count: data.count,
    examples: data.examples,
  }));

const output = {
  filesScanned: report.filesScanned,
  filesChanged: report.filesChanged,
  replacements: report.replacements,
  multiWordNames,
  suspiciousItalics: report.suspiciousItalics,
};

fs.writeFileSync(
  path.join(root, "mutate", "people-v-italics-report.json"),
  `${JSON.stringify(output, null, 2)}\n`
);

console.log(JSON.stringify(output, null, 2));
