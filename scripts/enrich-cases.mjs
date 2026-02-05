import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const textsDir = path.join(repoRoot, "public", "texts");

const OPINION_URL_BASE =
  process.env.OPINION_URL_BASE ?? "https://miranda.jurisware.com/texts/";

const outputsPath = path.join(repoRoot, "amplify_outputs.json");
const outputs = JSON.parse(await readFile(outputsPath, "utf-8"));
Amplify.configure(outputs);
const client = generateClient();

function extractCaseId(filename) {
  const match = filename.match(/^(\d{4}_\d{5})/);
  return match ? match[1] : filename.replace(/\.txt$/i, "");
}

function firstNonEmptyLine(lines, start = 0) {
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line) return line;
  }
  return "";
}

function parseDate(text) {
  if (!text) return null;
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function extractSlipOp(line) {
  const match = line.match(/(\d{4} NY Slip Op \d+)/);
  return match ? match[1] : null;
}

function extractNy3d(line) {
  const match = line.match(/(\d+ NY3d \d+)/);
  return match ? match[1] : null;
}

function extractArguedDecided(lines) {
  for (const line of lines) {
    if (line.includes("Argued") && line.includes("decided")) {
      const match = line.match(/Argued (.+); decided (.+)/i);
      if (match) {
        return {
          argued: parseDate(match[1].trim()),
          decided: parseDate(match[2].trim()),
        };
      }
    }
  }
  return { argued: null, decided: null };
}

function extractCorrectedDate(lines) {
  for (const line of lines) {
    if (line.startsWith("As corrected through")) {
      const trimmed = line.replace("As corrected through", "").trim();
      return parseDate(trimmed);
    }
  }
  return null;
}

function extractCourt(lines) {
  for (const line of lines) {
    if (line.trim() === "Court of Appeals") return "Court of Appeals";
  }
  return null;
}

function extractAuthoringJudge(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes("OPINION OF THE COURT")) {
      return firstNonEmptyLine(lines, i + 1) || null;
    }
  }
  return null;
}

function extractLowerCourtAndDisposition(lines) {
  for (const line of lines) {
    if (line.includes(" v ") && line.includes(" AD") && line.includes(",")) {
      const parts = line.split(",").map((part) => part.trim());
      if (parts.length >= 2) {
        const lowerCourtCite = parts[1] || null;
        const disposition = parts[2] || null;
        return { lowerCourtCite, disposition };
      }
    }
  }
  return { lowerCourtCite: null, disposition: null };
}

function extractPartiesCaption(lines) {
  const startIdx = lines.findIndex((line) => line.includes("Respondent"));
  if (startIdx === -1) return null;
  const endIdx = lines.findIndex((line, i) => i > startIdx && line.includes("Argued"));
  const slice = lines.slice(startIdx, endIdx === -1 ? startIdx + 5 : endIdx);
  const cleaned = slice.map((line) => line.trim()).filter(Boolean);
  return cleaned.join(" ");
}

function extractStatutes(lines) {
  const matches = new Set();
  const patterns = [
    /\bPenal Law §\s*\d+(\.\d+)?/g,
    /\bCPL\s*\d+(\.\d+)?/g,
  ];
  for (const line of lines) {
    for (const pattern of patterns) {
      for (const match of line.matchAll(pattern)) {
        matches.add(match[0]);
      }
    }
  }
  return matches.size ? Array.from(matches) : null;
}

async function main() {
  const entries = await readdir(textsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".txt"))
    .map((entry) => entry.name)
    .sort();

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;
  const total = files.length;

  for (const filename of files) {
    processed += 1;
    const filePath = path.join(textsDir, filename);
    const content = await readFile(filePath, "utf-8");
    const lines = content.split(/\r?\n/).map((line) => line.trim());

    const caseId = extractCaseId(filename);
    const caseName = firstNonEmptyLine(lines);
    if (!caseName) {
      skipped += 1;
      continue;
    }
    const opinionUrl = `${OPINION_URL_BASE}${encodeURIComponent(filename)}`;

    const slipOp = extractSlipOp(firstNonEmptyLine(lines, 1));
    const ny3dCite = extractNy3d(firstNonEmptyLine(lines, 1));
    const decisionDate = parseDate(firstNonEmptyLine(lines, 2));
    const { argued, decided } = extractArguedDecided(lines);
    const correctedDate = extractCorrectedDate(lines);
    const court = extractCourt(lines);
    const authoringJudge = extractAuthoringJudge(lines);
    const { lowerCourtCite, disposition } = extractLowerCourtAndDisposition(lines);
    const partiesCaption = extractPartiesCaption(lines);
    const statutesCited = extractStatutes(lines);

    const existing = await client.models.Case.get({ caseId });
    if (!existing.data) {
      const { errors: createErrors } = await client.models.Case.create({
        caseId,
        caseName,
        opinionUrl,
        slipOp: slipOp ?? undefined,
        ny3dCite: ny3dCite ?? undefined,
        court: court ?? undefined,
        decisionDate: decided ?? decisionDate ?? undefined,
        arguedDate: argued ?? undefined,
        correctedDate: correctedDate ?? undefined,
        lowerCourtCite: lowerCourtCite ?? undefined,
        disposition: disposition ?? undefined,
        authoringJudge: authoringJudge ?? undefined,
        partiesCaption: partiesCaption ?? undefined,
        statutesCited: statutesCited ?? undefined,
        summary: "MISSING IN DB: created by enrich script",
      });
      if (createErrors?.length) {
        failed += 1;
        console.log(
          `Failed ${filename}:`,
          createErrors.map((e) => e.message).join("; ")
        );
      } else {
        updated += 1;
      }
      if (processed % 50 === 0) {
        console.log(
          `Progress ${processed}/${total} (updated ${updated}, skipped ${skipped}, failed ${failed})`
        );
      }
      continue;
    }

    const { errors } = await client.models.Case.update({
      caseId,
      caseName,
      opinionUrl,
      slipOp: slipOp ?? undefined,
      ny3dCite: ny3dCite ?? undefined,
      court: court ?? undefined,
      decisionDate: decided ?? decisionDate ?? undefined,
      arguedDate: argued ?? undefined,
      correctedDate: correctedDate ?? undefined,
      lowerCourtCite: lowerCourtCite ?? undefined,
      disposition: disposition ?? undefined,
      authoringJudge: authoringJudge ?? undefined,
      partiesCaption: partiesCaption ?? undefined,
      statutesCited: statutesCited ?? undefined,
    });

    if (errors?.length) {
      failed += 1;
      console.log(`Failed ${filename}:`, errors.map((e) => e.message).join("; "));
    } else {
      updated += 1;
    }

    if (processed % 50 === 0) {
      console.log(
        `Progress ${processed}/${total} (updated ${updated}, skipped ${skipped}, failed ${failed})`
      );
    }
  }

  console.log(`Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
