/**
 * read-sigil-tiddlers.ts — node-side `.tid` frontmatter reader for the grammar table
 * generator and its drift witness.
 *
 * The live wiki (grammar-cache.ts) reads SharktoothSigil tiddlers through TW5's own
 * `wiki.getTiddler()` (shadows+tiddlers, tag-filtered). Node-side tooling has no `$tw`,
 * so this reads the SAME tiddlers straight off disk — `.tid` frontmatter is `key: value`
 * lines up to the first blank line, exactly what TW5's own `.tid` deserializer reads.
 *
 * This file does NOT re-derive field→rule meaning — it hands the parsed `fields` map to
 * the SHARED CONVERTER (`sigilFromFields` / `familyFromFields`, exported from
 * `../src/grammar-cache.js`) so the disk path and the live-wiki path read one rule.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { GRAMMAR_TAG } from "@lararium/mesh/lar-uris";
import { sigilFromFields, familyFromFields, nameFromTitle } from "../src/grammar-cache.js";
import type { SigilRule, FamilyRule } from "../src/meme-ast/types.js";

export const TIDDLERS_DIR = join(import.meta.dirname, "../tiddlers");

export interface TiddlerRecord {
  filename: string;
  title: string;
  fields: Record<string, string>;
}

/** Parse one `.tid` file's frontmatter (key: value lines before the first blank line). */
export function parseTidFrontmatter(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") break;
    const m = /^([A-Za-z0-9._-]+):\s?(.*)$/.exec(line);
    if (m) fields[m[1]!] = m[2]!;
  }
  return fields;
}

/** Every `sigil-*.tid` file under tiddlers/, parsed, regardless of tag (caller filters). */
export function readAllSigilTiddlers(dir: string = TIDDLERS_DIR): TiddlerRecord[] {
  const out: TiddlerRecord[] = [];
  for (const filename of readdirSync(dir).sort()) {
    if (!filename.startsWith("sigil-") || !filename.endsWith(".tid")) continue;
    const text = readFileSync(join(dir, filename), "utf-8");
    const fields = parseTidFrontmatter(text);
    const title = fields.title ?? filename;
    out.push({ filename, title, fields });
  }
  return out;
}

/** SharktoothSigil-tagged tiddlers only (the grammar-bearing subset). */
export function readGrammarTiddlers(dir: string = TIDDLERS_DIR): TiddlerRecord[] {
  return readAllSigilTiddlers(dir).filter((t) => (t.fields.tags ?? "").split(/\s+/).includes(GRAMMAR_TAG));
}

export interface DerivedGrammar {
  sigils: SigilRule[];
  families: FamilyRule[];
  /** filename each sigil/family rule was derived from, keyed by rule name, for witness reporting. */
  sourceOf: Map<string, string>;
}

/** Fold every grammar tiddler on disk into GrammarRules, through the SHARED CONVERTER. */
export function deriveGrammarFromDisk(dir: string = TIDDLERS_DIR): DerivedGrammar {
  const sigils: SigilRule[] = [];
  const families: FamilyRule[] = [];
  const sourceOf = new Map<string, string>();
  for (const t of readGrammarTiddlers(dir)) {
    const family = familyFromFields(t.title, t.fields);
    if (family) { families.push(family); sourceOf.set(`family:${family.name}`, t.filename); continue; }
    const rule = sigilFromFields(t.title, t.fields);
    if (rule) { sigils.push(rule); sourceOf.set(rule.name, t.filename); }
  }
  return { sigils, families, sourceOf };
}

/** Convenience: the bare sigil name a `.tid` filename carries, e.g. "sigil-ahu.tid" -> "ahu". */
export function nameFromFilename(filename: string): string {
  return filename.replace(/^sigil-/, "").replace(/\.tid$/, "");
}

export { nameFromTitle };
