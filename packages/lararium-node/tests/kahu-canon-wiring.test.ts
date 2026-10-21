/**
 * kahu-canon-wiring — the node boot's joints for the Kahu realm's live canon, read off the boot's own source.
 *
 * `openNodeVessel` founds a hearth and cannot stand in a unit test (`node-who-face-parity` records the same constraint), so
 * every behavioural vector for slice 3 rides the modules the boot calls (`kahu-canon-stand`, `vessel-assembly-system-canon`,
 * `register-bags`, `disk-mirrors`). This pin reads the WIRING, and bites a weakening that leaves each of them green:
 *
 *   · the keel names its system canon from `standKahuCanon` and from nothing else (no mint, no catalog reconcile),
 *   · the registered bag set takes the system bags only where the keel named canon,
 *   · the `bags/lares` and `bags/lararium` disk mirrors are granted only where the keel named that bag's document.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const boot = readFileSync(join(import.meta.dirname, "..", "src", "open-node-vessel.ts"), "utf8");
const code = boot.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

describe("the node boot's Kahu canon wiring", () => {
  test("the keel's system canon rests on standKahuCanon, over the face pin the bootstrap carries", () => {
    expect(code).toMatch(/systemCanon:\s*async\s*\(\)\s*=>\s*\{[\s\S]{0,400}standKahuCanon\(\{[\s\S]{0,300}PERSONA_GROUP_ID_TIDDLER/);
  });
  test("no genesis office mints a system document and no reconcile writes a catalog row for one", () => {
    expect(code).not.toMatch(/mintLaresIfAbsent|mintLarariumIfAbsent|reconcileWellKnownTiddlers/);
  });
  test("the registered set takes the system bags only where the keel named canon", () => {
    expect(code).toMatch(/\.\.\.\(kahuCanon\.lares \|\| kahuCanon\.lararium \? \{ systemCanon: true \} : \{\}\)/);
  });
  test("each bags/ mirror is granted only where the keel named that bag's document", () => {
    expect(code).toMatch(/\.\.\.\(kahuCanon\.lares\s*\?\s*\[\{ bagId: LARES_DOC_URI,[^\]]*bags\/lares"/);
    expect(code).toMatch(/\.\.\.\(kahuCanon\.lararium\s*\?\s*\[\{ bagId: LARARIUM_DOC_URI,[^\]]*bags\/lararium"/);
    expect(code).not.toMatch(/^\s*\{ bagId: LARES_DOC_URI,/m);                   // never a literal grant beside the conditional one
  });
});
