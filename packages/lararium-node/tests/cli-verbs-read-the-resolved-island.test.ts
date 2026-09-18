/**
 * The 12 CLI-verb sites (7 files) that address a per-Nexus board through the vessel's OWN key instead
 * of the resolved island - the same defect class `device-admit.ts` already cured (`91ce09afb` +
 * `5251f49b2`, see `device-admit-reads-the-resolved-island.test.ts`), left standing at the CLI layer.
 *
 * WHAT THIS PINS. A structural WELD sweep, mirroring the device-admit weld: for each of the six files,
 * strip comments (docblocks NAME the old spelling to explain why it was wrong - a token-only sweep over
 * raw source would match the prose and red over code that is already correct), then assert every
 * board-door call's ARGUMENT reads the RESOLVED island rather than a bare vessel-key variable.
 *
 * `boot-invite-burn.ts:74,95` carry NO board (they stamp the vessel key as the Nexus IDENTITY into an
 * invite/policy decision) and `nexus-contract.ts:201,409` read a nym/ownKey, not an island - both
 * EXCLUDED from the sweep by design (curing them by the board recipe is a category error).
 *
 * Each site sits CORRECT for an un-climbed vessel by construction (`nodeNexusIsland` returns the own
 * key at the `own` notch) - a behavioural vector over a never-climbed vessel greens on the defect, so
 * this test measures the SOURCE STRUCTURE (the same class of proof the device-admit weld already
 * trusts) rather than driving each verb's full ceremony.
 *
 * `nexus-contract.ts` carries a SECOND `carriageDocUrl(` call (`runNexusMembersList`, ~:414) that is
 * NOT one of the 12 sites and stays deliberately on the vessel's own key - its own docblock states
 * "THIS VESSEL'S OWN BOARD, AND ONLY EVER ITS OWN" (the carry-split membership registry is per-vessel
 * by design, never Nexus-shared). The sweep for that file allows exactly one `Island`-resolved call
 * and one deliberately-bare `ownKey` call.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const ROOT = new URL("../src/", import.meta.url);

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function read(rel: string): string {
  return readFileSync(new URL(rel, ROOT), "utf8");
}

/** Every door name in the 12-site table, keyed by the file that calls it. Captures the ARGUMENT. */
const SITES: Array<{ file: string; door: RegExp; count: number }> = [
  { file: "commands/handle.ts",         door: /whoBoardDocUrl\(([^)]*)\)/g,        count: 2 },
  { file: "commands/handle.ts",         door: /personaKelBoardDocUrl\(([^)]*)\)/g, count: 2 },
  { file: "persona-admit-flow.ts",      door: /personaKelBoardDocUrl\(([^)]*)\)/g, count: 1 },
  { file: "commands/nexus-kapae.ts",    door: /kapaeAntigenDocUrl\(([^)]*)\)/g,    count: 2 },
  { file: "commands/cabal-vouch.ts",    door: /vouchBoardDocUrl\(([^)]*)\)/g,      count: 1 },
  { file: "commands/edge-kapae-cmd.ts", door: /edgeKapaeBoardDocUrl\(([^)]*)\)/g,  count: 1 },
  { file: "commands/nexus-contract.ts", door: /carriageDocUrl\(([^)]*)\)/g,        count: 2 },
];

/** Sites where NOT every match of the door regex is the cured one - see the file-level docblock. */
const PARTIAL_SITES = new Set(["commands/nexus-contract.ts"]);

describe("the 12 CLI-verb sites resolve the island the boot resolved, not the raw vessel key", () => {
  for (const { file, door, count } of SITES) {
    test(`WELD - ${file} :: ${door.source} composes the resolved island, never a bare vessel-key read`, () => {
      const raw  = read(file);
      const code = stripComments(raw);

      // Vacuity pin - the strip must not have eaten the calls themselves.
      const matches = [...code.matchAll(door)];
      expect(matches.length, `expected ${count} call(s) of ${door.source} in ${file}, found ${matches.length} - the comment strip or the site count drifted`).toBe(count);

      // Each door call's ARGUMENT must read the RESOLVED island (a variable naming it as such), not a
      // bare vessel-key variable - the positive characterization mirrors the device-admit weld's own
      // "the composed resolver's name appears at the call site" check.
      if (PARTIAL_SITES.has(file)) {
        // At least one call resolves through the island; the deliberately-excluded own-board call
        // (documented "ONLY EVER ITS OWN") is allowed to stay bare.
        const resolved = matches.filter((m) => /Island/i.test(m[1]));
        expect(resolved.length, `no call of ${door.source} in ${file} resolves the island - the cure never landed`).toBeGreaterThanOrEqual(1);
      } else {
        for (const m of matches) {
          const arg = m[1];
          expect(arg, `a board keyed on a raw vessel key, not the resolved island: ${m[0]}`).toMatch(/Island/i);
        }
      }
    });
  }

  test("CONTROL - the module composes `nodeNexusIsland`, imported from nexus-standing", () => {
    for (const file of ["commands/handle.ts", "persona-admit-flow.ts", "commands/nexus-kapae.ts",
                         "commands/cabal-vouch.ts", "commands/edge-kapae-cmd.ts", "commands/nexus-contract.ts"]) {
      const src = read(file);
      expect(src, `${file} does not import nodeNexusIsland`).toMatch(/nodeNexusIsland/);
    }
  });

  test("CONTROL - nexus-contract.ts's nym/ownKey reads (bystanders, out of scope) stay bare", () => {
    // These read a vessel identity for something OTHER than a board address (a nym, an own-key label) -
    // curing them by the board recipe would be a category error. This control pins they still exist as
    // bare loadVesselVerifyingKey reads, so a future refactor that removes them updates this test rather
    // than silently drifting the count below.
    const code = stripComments(read("commands/nexus-contract.ts"));
    const bareReads = [...code.matchAll(/loadVesselVerifyingKey\(\)/g)];
    // Two bystanders (nym, ownKey) plus the ONE feeding the board site's resolution.
    expect(bareReads.length, "nexus-contract.ts's bare loadVesselVerifyingKey count drifted from the 3 expected (board-feed + nym + ownKey)").toBe(3);
  });

  test("CONTROL - boot-invite-burn.ts carries NO board and stays untouched (category error to cure)", () => {
    const code = stripComments(read("boot-invite-burn.ts"));
    // No board-door call anywhere in this file.
    expect(code).not.toMatch(/BoardDocUrl\(|kapaeAntigenDocUrl\(|carriageDocUrl\(/);
    // And it still reads the vessel key directly, twice, as documented (the invite IDENTITY, not a board).
    const bareReads = [...code.matchAll(/loadVesselVerifyingKey\(\)/g)];
    expect(bareReads.length).toBe(2);
  });
});
