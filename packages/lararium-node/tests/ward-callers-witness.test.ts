/**
 * ward-callers-witness — every source call that opens a face's root names its ward route explicitly (seat-harness#/the-ward).
 *
 * The root doors (`loadPersonaGroupRootSeed`, `generateOrLoadPersonaGroupRoot`, `landPersonaRoot`, `orphanPersonaRootKey`,
 * `wardRootSigner`, `wardRootSession`, `withWardKeyCustody`) take a ward as an argument. A call that leaves it out would fall to the
 * process's seated gatherer, so a daemon would refuse and a CLI would prompt for an act whose caller held the route all along: the
 * witness reads every such call in `src/` and refuses one that passes fewer arguments than the door's ward position. The vault
 * (`makeNodeFsPersonaVault`) lists and counts with no ward; a caller that reads a root through it names one, and the listing
 * callers stand on an allow list by name.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const SRC = join(import.meta.dirname, "..", "src");
/** Each door and the argument count that carries its ward. */
const DOORS: Readonly<Record<string, number>> = {
  loadPersonaGroupRootSeed: 2, generateOrLoadPersonaGroupRoot: 2, landPersonaRoot: 3, orphanPersonaRootKey: 2,
  wardRootSigner: 2, wardRootSession: 2, withWardKeyCustody: 2, makeNodeFsPersonaVault: 1,
};
/** The files that DEFINE a door (their own inner calls thread the ward they were handed). */
const DEFINERS = new Set(["node-vessel-identity.ts", "ward-signer.ts", "custody-seat.ts"]);
/** The vault's listing callers: they read roots' presence and public keys, never a root. */
const VAULT_LISTERS = new Set(["nexus-leaf.ts", "worn-mount.ts"]);

/** The arguments of the call whose `(` stands at `open`, split at top-level commas. */
function argsAt(text: string, open: number): string[] {
  let depth = 0, at = open + 1, quote: string | null = null;
  const out: string[] = [];
  for (let i = open; i < text.length; i++) {
    const c = text[i]!;
    if (quote) { if (c === "\\") { i++; continue; } if (c === quote) quote = null; continue; }
    if (c === "\"" || c === "'" || c === "`") { quote = c; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") { depth--; if (depth === 0) { out.push(text.slice(at, i)); break; } }
    else if (c === "," && depth === 1) { out.push(text.slice(at, i)); at = i + 1; }
  }
  return out.map((a) => a.trim()).filter((a) => a.length > 0);
}

/** Every call of a door in `text` that carries fewer arguments than its ward position, as `door: args`. */
export function wardlessCalls(text: string, file: string): string[] {
  const out: string[] = [];
  for (const [door, need] of Object.entries(DOORS)) {
    if (door === "makeNodeFsPersonaVault" && VAULT_LISTERS.has(file)) continue;
    for (const m of text.matchAll(new RegExp(`(?<![\\w.])${door}\\(`, "g"))) {
      const before = text.slice(Math.max(0, m.index! - 40), m.index!);
      if (/function\s+$|import\s*\{[^}]*$|export\s*\{[^}]*$/.test(before)) continue;
      const args = argsAt(text, m.index! + door.length);
      if (args.length < need) out.push(`${file}: ${door}(${args.join(", ")})`);
    }
  }
  return out;
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? sources(p) : p.endsWith(".ts") ? [p] : []; });
}

describe("every root opener names its ward", () => {
  test("RED (the witness's own control): a planted call with no ward reads by name; CONTROL: the same call with its ward reads clean", () => {
    expect(wardlessCalls("const s = await loadPersonaGroupRootSeed(handleIndex);", "planted.ts")).toEqual(["planted.ts: loadPersonaGroupRootSeed(handleIndex)"]);
    expect(wardlessCalls("const s = await loadPersonaGroupRootSeed(handleIndex, opts.ward);", "planted.ts")).toEqual([]);
    expect(wardlessCalls("rootSigner: () => wardRootSigner(index, ward(f(1, 2)), \"x\"),", "planted.ts")).toEqual([]);
    expect(wardlessCalls("const v = await makeNodeFsPersonaVault();", "recovery-keel.ts")).toEqual(["recovery-keel.ts: makeNodeFsPersonaVault()"]);
  });

  test("every call in src names its ward, and the witness read the callers it must", () => {
    const found: string[] = [];
    let calls = 0;
    for (const path of sources(SRC)) {
      const file = relative(SRC, path).split("/").pop()!;
      if (DEFINERS.has(file)) continue;
      const text = readFileSync(path, "utf8");
      for (const door of Object.keys(DOORS)) calls += [...text.matchAll(new RegExp(`(?<![\\w.])${door}\\(`, "g"))].length;
      found.push(...wardlessCalls(text, file));
    }
    expect(found).toEqual([]);
    expect(calls, "the witness read the root openers across src").toBeGreaterThanOrEqual(16);
  });
});
