/** Reframe parent TOML/header content inside STX–ETX.
 *
 * This opt-in command reads parent content standing before STX and writes the complete carrier body.
 * Runtime readers surface that placement to the operator; emitters place root content after STX.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { expandMemeRefs, memeticWikitextDeserializer, type TiddlerFields } from "../src/deserializer.js";

const root = new URL("../../../", import.meta.url).pathname;
const write = process.argv.includes("--write");
const files = process.argv.slice(2).filter((p) => !p.startsWith("--")).map((p) => resolve(root, p));

function uriOf(text: string, file: string): string | null {
  const head = /->\s*(?:to=)?"?(lar:\/\/\/[^"\s>]+)"?/.exec(text)?.[1];
  if (head) return head;
  const path = /(?:^|\n)uri-path\s*=\s*"([^"]+)"/.exec(text)?.[1];
  return path ? `lar:///${path}` : `lar:///migration/${relative(root, file).replace(/\\/g, "/").replace(/\.mem$/, "")}`;
}

function migrate(file: string): { before: number; after: number; changed: boolean } | null {
  const source = readFileSync(file, "utf8");
  // A bag-declaring carrier carries its own fields and prose inside a checked STX–ETX body. Teaching
  // payloads without a carrier head remain outside this migration.
  if (!/<<\^\s*code="&#x(?:0001|0011);"/.test(source)) return null;
  const uri = uriOf(source, file);
  if (!uri) throw new Error(`${file}: cannot derive carrier URI`);
  const records = memeticWikitextDeserializer(source, { title: uri });
  const byTitle = new Map(records.map((r) => [String(r.title), r]));
  const rendered = expandMemeRefs((title: string) => byTitle.get(title), uri);
  if (rendered === null) throw new Error(`${file}: deserializer produced no root record for ${uri}`);
  if (write && rendered !== source) writeFileSync(file, rendered, "utf8");
  return { before: records.length, after: memeticWikitextDeserializer(rendered, { title: uri }).length, changed: rendered !== source };
}

const targets = files.length > 0 ? files : [
  join(root, "bags"), join(root, "docs"), join(root, "corpus"),
];
const { globSync } = await import("node:fs");
const paths = files.length > 0 ? targets : targets.flatMap((dir) => globSync(`${dir}/**/*.mem`, { absolute: true }));
let changed = 0;
for (const file of paths) {
  const result = migrate(file);
  if (!result) continue;
  if (result.changed) changed++;
  console.log(`${write ? "migrated" : "would-migrate"} ${relative(root, file)} records=${result.before}->${result.after}`);
}
console.log(`${write ? "migrated" : "dry-run"}: ${changed} file(s)`);
