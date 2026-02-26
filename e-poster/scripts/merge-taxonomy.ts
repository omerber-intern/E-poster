import fs from "fs";
import path from "path";

interface TaxonomyEntry {
  instrumentId: number;
  symbol: string;
  instrumentName: string;
  majorCategory: string;
  subcategory: string;
  topic: string;
  weightBucket: string;
  reason: string;
}

const DOWNLOADS = path.join("C:", "Users", "omerber", "Downloads");
const CSV_FILES = [
  path.join(DOWNLOADS, "taxonomy table batch 1.csv"),
  path.join(DOWNLOADS, "taxonomy table batch 2.csv"),
  path.join(DOWNLOADS, "taxonomy table batch 3.csv"),
  path.join(DOWNLOADS, "taxonomy table batch 4.csv"),
];
const OUTPUT = path.join(process.cwd(), "data", "taxonomy.json");

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function toEntry(fields: string[]): TaxonomyEntry | null {
  const symbol = (fields[1] ?? "").trim();
  if (!symbol || symbol === "null" || symbol === "NULL") return null;

  return {
    instrumentId: parseInt(fields[0], 10),
    symbol,
    instrumentName: (fields[2] ?? "").trim(),
    majorCategory: (fields[3] ?? "").trim(),
    subcategory: (fields[4] ?? "").trim(),
    topic: (fields[5] ?? "").trim(),
    weightBucket: (fields[6] ?? "").trim(),
    reason: (fields[7] ?? "").trim(),
  };
}

const allEntries: TaxonomyEntry[] = [];
let nullCount = 0;

for (const csvPath of CSV_FILES) {
  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // Skip header row (first line of every batch file)
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const entry = toEntry(fields);
    if (entry) {
      allEntries.push(entry);
    } else {
      nullCount++;
    }
  }

  console.log(`  ${path.basename(csvPath)}: ${lines.length - 1} data rows`);
}

console.log(`\nTotal entries: ${allEntries.length}`);
console.log(`Filtered out (null symbol): ${nullCount}`);

fs.writeFileSync(OUTPUT, JSON.stringify(allEntries, null, 2), "utf-8");
console.log(`Written to ${OUTPUT}`);
