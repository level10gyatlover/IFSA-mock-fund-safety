import { readFile, writeFile } from "node:fs/promises";

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) {
  throw new Error("Usage: node scripts/build-instrument-master.mjs <security.csv> <output.json>");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function classify(series, name) {
  const upper = name.toUpperCase();
  if (series === "SG" || upper.includes("SOVEREIGN GOLD")) return "Sovereign Gold Bond";
  if (upper.includes("REIT") || upper.includes("REAL ESTATE INV")) return "REIT";
  if (upper.includes("INVIT") || upper.includes("INFRASTRUCTURE INV TRUST") || upper.includes("INFRA INV TRUST")) return "InvIT";
  if (upper.includes("ETF") || upper.includes("EXCHANGE TRADED") || upper.includes("BEES")) {
    return upper.includes("GOLD") || upper.includes("SILVER") ? "Commodity ETF" : "ETF";
  }
  if (series === "MF") return "Listed Fund";
  if (["EQ", "BE", "BZ", "SM", "ST", "SZ"].includes(series)) return "Equity";
  if (upper.includes("PREF")) return "Preference Share";
  return "Listed Debt";
}

function referencePrice(priceRange) {
  const match = priceRange.match(/^([0-9.]+)-([0-9.]+)$/);
  if (!match) return 0;
  const low = Number(match[1]);
  const high = Number(match[2]);
  return low >= 0 && high > 0 ? Number(((low + high) / 2).toFixed(4)) : 0;
}

const csv = await readFile(sourcePath, "utf8");
const [headers, ...records] = parseCsv(csv.replace(/^\uFEFF/, ""));
const index = Object.fromEntries(headers.map((header, position) => [header, position]));
const get = (record, key) => (record[index[key]] ?? "").trim();
const seriesRank = new Map(["EQ", "BE", "BZ", "SM", "ST", "SZ", "IV", "MF", "SG"].map((series, rank) => [series, rank]));
const selected = new Map();

for (const record of records) {
  const symbol = get(record, "TckrSymb");
  const name = get(record, "FinInstrmNm");
  const isin = get(record, "ISIN");
  const series = get(record, "SctySrs");
  if (get(record, "DelFlg") !== "N" || !isin.startsWith("IN") || isin.includes("DUMMY") || !symbol || !name) continue;
  const exchange = get(record, "PrtdToTrad") === "1" ? "BSE" : "NSE";
  const key = `${exchange}:${symbol}`;
  const score = [get(record, "ElgbltyNrmlMkt") === "1" ? 0 : 1, seriesRank.get(series) ?? 20, series];
  const current = selected.get(key);
  const isBetter = !current
    || score[0] < current.score[0]
    || (score[0] === current.score[0] && score[1] < current.score[1])
    || (score[0] === current.score[0] && score[1] === current.score[1] && score[2] < current.score[2]);
  if (isBetter) {
    selected.set(key, {
      score,
      item: {
        s: symbol,
        n: name.replace(/\s+/g, " "),
        e: exchange,
        a: classify(series, name),
        r: series,
        i: isin,
        l: Math.max(1, Number(get(record, "NewBrdLotQty")) || 1),
        p: referencePrice(get(record, "PricRg")),
      },
    });
  }
}

const instruments = [...selected.values()]
  .map(({ item }) => item)
  .sort((left, right) => left.s.localeCompare(right.s) || left.e.localeCompare(right.e));

await writeFile(outputPath, `${JSON.stringify(instruments)}\n`);
console.log(`Wrote ${instruments.length.toLocaleString("en-IN")} instruments to ${outputPath}`);
