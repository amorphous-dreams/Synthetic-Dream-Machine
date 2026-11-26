/**
 * rest-owed-untracked — THE FAIL-SAFE ENUMERATED (sealed-store#/owed): every verb this house registers either reports the
 * changes its call made (the island's `touched`, even empty) or, answering with none, reads `untracked`: owed by name, never
 * ok. Only the read allow-list (`READ_VERBS`) answers clean with no report. The scan reads every `.register("<verb>"` in
 * the tw5, node and keyhive sources, so a verb added tomorrow lands under the same law with no list to remember.
 * Canon: lar:///ha.ka.ba/kahua/memory/research/signer-refused
 */
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { READ_VERBS, answersUntracked } from "@lararium/mesh/call-touches";

const ROOT = new URL("../../", import.meta.url).pathname;
const SOURCES = ["lararium-tw5/src", "lararium-node/src", "lararium-keyhive/src"];

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.ts$/.test(name) && !/\.generated\.ts$/.test(name) ? [path] : [];
  });
}

/** Every verb a source registers by a literal name. */
function registeredVerbs(): string[] {
  const names = new Set<string>();
  for (const dir of SOURCES) for (const file of filesUnder(join(ROOT, dir))) {
    for (const m of readFileSync(file, "utf8").matchAll(/\.register\(\s*"([a-zA-Z][a-zA-Z0-9:_-]*)"/g)) names.add(m[1]!);
  }
  return [...names].sort();
}

describe("every registered verb reports its changes or answers untracked", () => {
  const verbs = registeredVerbs();
  test("the scan reads the house's verb table (not vacuous)", () => {
    expect(verbs.length).toBeGreaterThan(100);
    for (const known of ["tiddler-put", "tiddler-delete", "kahua-propose", "share-apply", "tiddler-get"]) expect(verbs).toContain(known);
  });
  test("each write verb answering with no report reads untracked; with a report, it reads by its report", () => {
    const writes = verbs.filter((v) => !READ_VERBS.has(v));
    expect(writes.length).toBeGreaterThan(80);
    for (const verb of writes) {
      expect([verb, answersUntracked(verb, false)]).toEqual([verb, true]);
      expect([verb, answersUntracked(verb, true)]).toEqual([verb, false]);
    }
  });
  test("a verb no table names (tomorrow's) reads untracked too: the list allows reads, never writes", () => {
    expect(answersUntracked("a-verb-not-yet-written", false)).toBe(true);
  });
  test("each read verb on the allow-list stands registered (no stale or misspelt name clears a write)", () => {
    for (const verb of READ_VERBS) {
      expect([verb, answersUntracked(verb, false)]).toEqual([verb, false]);
      expect([verb, verbs.includes(verb)]).toEqual([verb, true]);
    }
  });
});
