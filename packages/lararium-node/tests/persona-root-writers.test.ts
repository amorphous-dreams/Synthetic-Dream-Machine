/**
 * persona-root-writers.test.ts — ROOT-ON-FOUNDER, pinned: only the FOUNDING act ever writes a persona root.
 *
 * A persona root is the human's sovereign key, and a hosting face, a walker's leaf and a kahu seat all derive
 * from it. If any read could stand one up as a side effect, two vessels could come to hold one root and mint
 * identical acts. So every door that MINTS a root is named here, and each is the founding of a face:
 *
 *   · node `runFoundTheFace` (`lares persona new N` founds the face, its root among it);
 *   · the browser's founding branch and its `persona-mint` verb (the browser twin of founding a face);
 *   · the platform-blind core and its two shores (`persona-vault`, the node and browser identity modules),
 *     which define the mint and are called only through those doors.
 *
 * Every other reader loads a HELD root through a non-minting read and refuses when none is held.
 *
 * Proven, over every package's `src/`:
 *   · RED: no file outside the founding doors calls a root-minting function;
 *   · CONTROL: the scanner finds a planted call in a sample, so a zero means none, never a blind instrument.
 */
import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const PACKAGES = resolve(__dirname, "..", "..");
/** The functions that MINT a persona root when none is held. */
const MINTERS = ["generateOrLoadPersonaRoot", "generateOrLoadPersonaGroupRoot", "generateOrLoadBrowserPersonaRoot"];
/** The founding doors, and the modules that define the mint — the only files that may call one. */
const FOUNDING = new Set([
  "lararium-node/src/commands/init.ts",
  "lararium-browser/src/open-browser-vessel.ts",
  "lararium-mesh/src/persona-vault.ts",
  "lararium-node/src/node-vessel-identity.ts",
  "lararium-browser/src/browser-vessel-identity.ts",
]);

/** The call sites of a minting function in `text` — a call, never a definition, an import or a comment. */
export function mintCalls(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const code = line.replace(/\/\/.*$/, "").trim();
    if (code.startsWith("*") || code.startsWith("/*")) continue;
    for (const name of MINTERS) {
      if (new RegExp(`\\b${name}\\s*\\(`).test(code) && !new RegExp(`function\\s+${name}\\b`).test(code)) out.push(name);
    }
  }
  return out;
}

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (p.endsWith(".ts") && !p.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

describe("ROOT-ON-FOUNDER — only the founding act writes a persona root", () => {
  test("CONTROL: the scanner finds a planted mint call, and passes a definition and a comment", () => {
    expect(mintCalls("  const root = await generateOrLoadPersonaGroupRoot(index);")).toEqual(["generateOrLoadPersonaGroupRoot"]);
    expect(mintCalls("export async function generateOrLoadPersonaGroupRoot(handleIndex = 0) {")).toEqual([]);
    expect(mintCalls("  // generateOrLoadPersonaGroupRoot(0) mints founder-side")).toEqual([]);
  });

  test("RED: no file outside the founding doors calls a root-minting function", () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const pkg of readdirSync(PACKAGES)) {
      const src = join(PACKAGES, pkg, "src");
      try { if (!statSync(src).isDirectory()) continue; } catch { continue; }
      for (const file of sources(src)) {
        scanned++;
        const rel = relative(PACKAGES, file);
        if (FOUNDING.has(rel)) continue;
        for (const name of mintCalls(readFileSync(file, "utf8"))) offenders.push(`${rel}: ${name}`);
      }
    }
    expect(scanned).toBeGreaterThan(100);                                   // the scan walked the tree
    expect(offenders).toEqual([]);
  });
});
