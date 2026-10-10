// Developer-only refresh. The app imports the saved JSON and never runs this fetch.
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const source = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";
const response = await fetch(source);
if (!response.ok)
  throw new Error("Cabinet Office CSV: HTTP " + response.status);
const bytes = Buffer.from(await response.arrayBuffer());
const lines = new TextDecoder("shift_jis")
  .decode(bytes)
  .trim()
  .split(/\r?\n/)
  .slice(1);
const dates = {};
for (const line of lines) {
  const [date, name] = line.split(",");
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(date);
  if (!m || !name) throw new Error("Invalid CSV row");
  dates[`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`] = name;
}
const years = Object.keys(dates).map((d) => +d.slice(0, 4));
if (years.length < 1000 || Math.max(...years) < 2027)
  throw new Error("Unexpected holiday coverage; keep the existing file");
const data = {
  source,
  checkedAt: new Date().toISOString().slice(0, 10),
  sourceSha256: createHash("sha256").update(bytes).digest("hex"),
  firstYear: Math.min(...years),
  lastYear: Math.max(...years),
  dates,
};
await writeFile(
  new URL("../src/domain/japan-holidays.json", import.meta.url),
  JSON.stringify(data, null, 2) + "\n",
  "utf8",
);
console.log(
  `Saved ${years.length} official holidays (${data.firstYear}–${data.lastYear})`,
);
