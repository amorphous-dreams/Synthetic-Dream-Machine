/**
 * seed-holdings — `lares vessel seed`'s holdings map (seed.ts discoverHoldings).
 *
 * The map DISCOVERS every dir under the bags dir, never hardcodes: files, dotted
 * entries, and a missing bags dir all stay out; order sorts stable; each holding
 * carries its disk source + its `lar:///ha.ka.ba/bags/…` bag address.
 *
 * The bags dir sites on its own cap: `LAR_BAGS`, else `<LAR_ROOT>/bags`. A vessel whose
 * state and corpus rest on two mounts seeds from the bags mount, never from `<state>/bags`.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverHoldings, SYSTEM_HOLDINGS, cmdSeed } from "../src/commands/seed.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { LARES_DOC_URI, LARARIUM_DOC_URI, identitySlug } from "@lararium/mesh";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lares-seed-holdings-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("discoverHoldings — the discovered holdings map", () => {
  test("maps every dir, sorted, with source path + lar bag address", () => {
    mkdirSync(join(root, "bags", "lares"), { recursive: true });
    mkdirSync(join(root, "bags", "elyncia"), { recursive: true });
    mkdirSync(join(root, "bags", "sdm"), { recursive: true });
    const holdings = discoverHoldings(join(root, "bags"));
    expect(holdings.map((h) => h.holding)).toEqual(["elyncia", "lares", "sdm"]);
    expect(holdings[0]).toEqual({
      holding: "elyncia",
      source: join(root, "bags", "elyncia"),
      toBag: "lar:///ha.ka.ba/bags/elyncia",
    });
  });

  test("holds every dir; files and dotted entries stay out", () => {
    mkdirSync(join(root, "bags", "lares"), { recursive: true });
    mkdirSync(join(root, "bags", "scratch"), { recursive: true });
    mkdirSync(join(root, "bags", ".git"), { recursive: true });
    writeFileSync(join(root, "bags", "note.md"), "not a holding\n");
    const holdings = discoverHoldings(join(root, "bags"));
    expect(holdings.map((h) => h.holding)).toEqual(["lares", "scratch"]);
  });

  test("★ SYSTEM_HOLDINGS spells what discoverHoldings returns ★", () => {
    // THE GUARD THE DEAD BRANCH NEEDED. `seed.ts` gates the infrastructure bags on set membership, and
    // membership compares against directory names read off `bags/`. When the two spellings drifted the
    // test answered false for every holding and NOTHING said so — the diff-gate simply stopped running.
    // Comparing the two vocabularies directly is the only reading that catches a silent miss.
    mkdirSync(join(root, "bags", "lares"),    { recursive: true });
    mkdirSync(join(root, "bags", "lararium"), { recursive: true });
    const found = new Set(discoverHoldings(join(root, "bags")).map((h) => h.holding));
    for (const sys of SYSTEM_HOLDINGS) {
      expect(found.has(sys), `SYSTEM_HOLDINGS names "${sys}", which no bags/ directory spells`).toBe(true);
    }
  });

  test("a missing bags/ answers the empty map (no throw)", () => {
    expect(discoverHoldings(join(root, "nope"))).toEqual([]);
  });

  test("★ the seed reads the BAGS cap: with LAR_BAGS apart from LAR_ROOT it names the bags mount, never <root>/bags ★", async () => {
    // The container's shape: state on one mount, corpus on another. `<root>/bags` holds a decoy holding that a
    // root-joined read would find and plant; the bags mount stands empty, so the seed must answer not-found
    // and NAME the bags mount. (An empty mount keeps this vector off the daemon: no holding, no gesture.)
    const stateRoot = join(root, "state");
    const bagsMount = join(root, "workspace", "bags");
    mkdirSync(join(stateRoot, "bags", "decoy"), { recursive: true });
    mkdirSync(bagsMount, { recursive: true });
    const prior = { root: process.env["LAR_ROOT"], bags: process.env["LAR_BAGS"] };
    process.env["LAR_ROOT"] = stateRoot;
    process.env["LAR_BAGS"] = bagsMount;
    const errors: string[] = [];
    const realError = console.error;
    console.error = (...a: unknown[]) => { errors.push(a.join(" ")); };
    try {
      const code = await cmdSeed({ command: "vessel", positional: [], options: {}, flags: { json: false } } as unknown as ParsedArgs);
      expect(code).toBe(3);
      expect(errors.join("\n")).toContain(`no holdings under ${bagsMount}`);
      // CONTROL: with no LAR_BAGS the cap falls to `<LAR_ROOT>/bags`, where the decoy stands as a holding.
      delete process.env["LAR_BAGS"];
      expect(discoverHoldings(join(stateRoot, "bags")).map((h) => h.holding)).toEqual(["decoy"]);
    } finally {
      console.error = realError;
      if (prior.root === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior.root;
      if (prior.bags === undefined) delete process.env["LAR_BAGS"]; else process.env["LAR_BAGS"] = prior.bags;
    }
  });

  test("★ SYSTEM_HOLDINGS derives from the LARES/LARARIUM bag constants, not hand-typed strings ★", () => {
    // The single owner of "what names lares/lararium" is the bag URI constants
    // (`LARES_DOC_URI`/`LARARIUM_DOC_URI` in @lararium/mesh/lar-uris). SYSTEM_HOLDINGS must read
    // back exactly the slugs those constants name — never a re-typed literal that can drift out
    // from under them.
    const derived = new Set(
      [identitySlug(LARES_DOC_URI), identitySlug(LARARIUM_DOC_URI)].filter(
        (s): s is string => s !== null,
      ),
    );
    expect(SYSTEM_HOLDINGS).toEqual(derived);
  });
});
