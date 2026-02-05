import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const textsDir = path.join(repoRoot, "public", "texts");
const indexPath = path.join(textsDir, "index.json");

const entries = await fs.readdir(textsDir, { withFileTypes: true });
const files = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".txt"))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

const items = [];
for (const file of files) {
  const fullPath = path.join(textsDir, file);
  const content = await fs.readFile(fullPath, "utf-8");
  const caseName =
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) || file;
  items.push({ file, caseName });
}

const payload = JSON.stringify({ items }, null, 2);
await fs.writeFile(indexPath, payload);
console.log(`Wrote ${items.length} case names to ${indexPath}`);
