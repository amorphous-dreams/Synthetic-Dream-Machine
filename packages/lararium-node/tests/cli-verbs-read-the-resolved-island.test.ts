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
 * `nexus-contract.ts`'s carry-for reads a nym, not an island - EXCLUDED from the sweep by design (curing it by
 * the board recipe is a category error). The hosting door (`commands/host.ts`) addresses no board at all: it lands
 * its act on the hearth's own HOSTING DOC, named by the Nexus AID and the hearth's gate key — the two things a
 * walker's invite names — and it never writes the carriage board.
 *
 * Each site sits CORRECT for an un-climbed vessel by construction (`nodeNexusIsland` returns the own
 * key at the `own` notch) - a behavioural vector over a never-climbed vessel greens on the defect, so
 * this test measures the SOURCE STRUCTURE (the same class of proof the device-admit weld already
 * trusts) rather than driving each verb's full ceremony.
 *
 * `nexus-contract.ts` carries THREE `carriageDocUrl(` calls - the admit WRITE (`runNexusContract`), the
 * roll-anchor WRITE (`runNexusRollAnchor`) and the members-list READ (`runNexusMembersList`). All read the
 * resolved island over the home holding the charter, so the writes and the read land on one board; a bare
 * vessel key at any one splits them.
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
  { file: "commands/nexus-contract.ts", door: /carriageDocUrl\(([^)]*)\)/g,        count: 3 },
];


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
      for (const m of matches) {
        const arg = m[1];
        expect(arg, `a board keyed on a raw vessel key, not the resolved island: ${m[0]}`).toMatch(/Island/i);
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

  test("CONTROL - nexus-contract.ts reads the vessel key once per board feed and once for the carry-for nym", () => {
    // Three reads FEED the island resolution (the admit write, the roll-anchor write, the members-list read);
    // one is the carry-for nym, a bystander that names a place rather than a board. Pinned so a refactor that
    // adds a bare read updates this test rather than silently drifting the count.
    const code = stripComments(read("commands/nexus-contract.ts"));
    const bareReads = [...code.matchAll(/loadVesselVerifyingKey\(\)/g)];
    expect(bareReads.length, "nexus-contract.ts's bare loadVesselVerifyingKey count drifted from the 4 expected (three board feeds + carry-for nym)").toBe(4);
    // No vessel-key variable survives as a board address.
    expect(code).not.toMatch(/carriageDocUrl\(\s*ownKey\s*\)/);
  });

  test("the hosting door lands its act on the hearth's hosting doc — the Nexus AID and its gate key — never a board", () => {
    const code = stripComments(read("commands/host.ts"));
    expect(code).toMatch(/hostingDocUrl\(aid, await loadVesselVerifyingKey\(\)\)/);
    expect(code, "the hosting door writes no carriage board").not.toMatch(/carriageDocUrl\(/);
    // The act is signed by the face's per-Nexus leaf, never the vessel key.
    expect(code).toMatch(/heldNexusLeaves\(/);
    expect(code).not.toMatch(/loadVesselSigningSeed/);
  });
});
