import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bootTestWiki } from "../tests/test-wiki.js";
import { runFilterCtsCase, type FilterCtsCase } from "../tests/filter-cts-run.js";

type Case = FilterCtsCase;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sections = ["preserved", "added", "deprecated", "fault", "context"] as const;
const camerasOnly = process.argv.includes("--cameras-only");
const world = JSON.parse(readFileSync(path.join(root, "tests/goldens/worlds/pono-small.json"), "utf8")) as { tiddlers: Record<string, string | string[]>[] };
const engine = await bootTestWiki({ tiddlers: world.tiddlers });
const outputDir = path.join(root, "tests/goldens/filter-cts");
mkdirSync(outputDir, { recursive: true });
const assembled: Record<string, unknown[]> = {};
for (const section of camerasOnly ? [] : sections) {
  const inputPath = path.join(root, "tests/goldens/filter-cts-sections", `${section}.json`);
  let cases: Case[];
  try { cases = JSON.parse(readFileSync(inputPath, "utf8")) as Case[]; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`Missing authored case list: ${inputPath}`); throw error; }
  const records = cases.map((test) => ({ ...test, world: "pono-small", ...runFilterCtsCase(engine, test) }));
  writeFileSync(path.join(outputDir, `${section}.json`), `${JSON.stringify(records, null, 2)}\n`);
  assembled[section] = records;
}
if (!camerasOnly) writeFileSync(path.join(root, "tests/goldens/filter-cts.json"), `${JSON.stringify({ world: "pono-small", sections: assembled }, null, 2)}\n`);

const cameraDir = path.join(root, "tests/goldens/cameras");
const specimens = JSON.parse(readFileSync(path.join(cameraDir, "specimens.json"), "utf8")) as Array<{ title: string; text: string }>;
const cameraEngine = await bootTestWiki({ tiddlers: specimens.map(({ title, text }) => ({ title, text })) });
const normalize = (value: string) => value.replace(/\r\n/g, "\n").trim();
for (const specimen of specimens) {
  const golden = {
    html: normalize(cameraEngine.wiki.renderTiddler("text/html", specimen.title)),
    text: normalize(cameraEngine.wiki.renderTiddler("text/plain", specimen.title)),
  };
  writeFileSync(path.join(cameraDir, `${encodeURIComponent(specimen.title)}.json`), `${JSON.stringify(golden, null, 2)}\n`);
}
