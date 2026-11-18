/**
 * genesis-resolve -- ONE resolver names the genesis dir for the founding, the daemon and the CLI, and a cold
 * root reaches the build's shipped seed with no hand copy.
 *
 * The genesis manifest is the CAS sweep's protect set (an empty set means delete), so two readers that
 * resolve differently would let one sweep away a seed the other never saw. An explicit declaration wins and
 * never falls back; only a root that holds NO seed.json falls to the shipped seed; a torn root seed refuses.
 *
 * Every founding records the seed witness: the seed CID it used and the seed's ratchet digests, whatever the seed's
 * source. The oracle island (the founding record) reloads from the store at boot and never compares the seed
 * (measured: `materializeGenesisIsland` returns a persisted doc before it reads the seed). D1 holds a differing
 * seed as an OFFER: the boot names it ratchet by ratchet ("a newer seed waits: ...") and boots, never refusing.
 * A torn witness still refuses by name.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ENGINE_CORE_ID, GENESIS_FLOOR_TIDDLER, LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "@lararium/mesh";
import { afterEach, describe, expect, test } from "vitest";
import { checkGenesisPin, genesisFoundingLine, pinGenesisSeed, resolveGenesis } from "../src/genesis-resolve.js";
import { genesisSeedCid, readGenesisSeedBytes } from "../src/genesis-artifact.js";

const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

/** A seed whose engine core, grammar and floor witness the test may move one at a time. */
function seedBody(tag: string, moved: { grammar?: string; floor?: string } = {}): Record<string, unknown> {
  const blob = (id: string, sha256: string) => ({ id, version: "x", sha256, mimeType: "application/json" });
  return {
    format: "lararium-genesis-seed", actorSeed: tag,
    blobs: {
      [ENGINE_CORE_ID]: { ...blob(ENGINE_CORE_ID, "c".repeat(64)), mimeType: "application/javascript" },
      [LARES_MEMETIC_WIKITEXT_PLUGIN_URI]: blob(LARES_MEMETIC_WIKITEXT_PLUGIN_URI, moved.grammar ?? "a".repeat(64)),
    },
    tiddlers: { [GENESIS_FLOOR_TIDDLER]: { tiddler: { title: GENESIS_FLOOR_TIDDLER, text: "", cid: moved.floor ?? "f".repeat(64) } } },
  };
}

function dirWithSeed(tag: string | null, torn = false, moved: { grammar?: string; floor?: string } = {}): string {
  const dir = mkdtempSync("/tmp/lararium-genesis-resolve-"); roots.push(dir);
  if (tag !== null) {
    mkdirSync(join(dir, "genesis"), { recursive: true });
    writeFileSync(join(dir, "genesis", "seed.json"), torn ? "{ torn" : JSON.stringify(seedBody(tag, moved)));
  } else mkdirSync(join(dir, "genesis"), { recursive: true });
  return dir;
}

describe("which genesis dir a cold root reaches", () => {
  test("a root holding no seed reaches the shipped seed, read in place", () => {
    const root = dirWithSeed(null); const shipped = dirWithSeed("shipped");
    expect(resolveGenesis({ corpusRoot: root, shippedRoot: shipped })).toEqual({ dir: join(shipped, "genesis"), source: "shipped" });
  });

  test("CONTROL: a root that holds a seed keeps it", () => {
    const root = dirWithSeed("mine"); const shipped = dirWithSeed("shipped");
    expect(resolveGenesis({ corpusRoot: root, shippedRoot: shipped })).toEqual({ dir: join(root, "genesis"), source: "root" });
  });

  test("CONTROL: an explicit declaration wins and never falls back, a bare one included", () => {
    const root = dirWithSeed(null); const shipped = dirWithSeed("shipped");
    expect(resolveGenesis({ explicit: "/nowhere/genesis", corpusRoot: root, shippedRoot: shipped })).toEqual({ dir: "/nowhere/genesis", source: "explicit" });
    expect(resolveGenesis({ configured: "/cfg/genesis", corpusRoot: root, shippedRoot: shipped })).toEqual({ dir: "/cfg/genesis", source: "configured" });
  });

  test("CONTROL: a torn seed at the root does not fall back; it stays the root's to refuse", () => {
    const root = dirWithSeed("x", true); const shipped = dirWithSeed("shipped");
    expect(resolveGenesis({ corpusRoot: root, shippedRoot: shipped })).toEqual({ dir: join(root, "genesis"), source: "root" });
  });

  test("CONTROL: with no shipped seed either, the root path stays as it reads today", () => {
    const root = dirWithSeed(null); const shipped = dirWithSeed(null);
    expect(resolveGenesis({ corpusRoot: root, shippedRoot: shipped })).toEqual({ dir: join(root, "genesis"), source: "root" });
  });
});

describe("every founding records the seed witness; a differing seed reads as an offer", () => {
  const stage = () => { const root = dirWithSeed(null); const storage = mkdtempSync("/tmp/lararium-genesis-pin-"); roots.push(storage); return { root, storage }; };
  const cidOf = (dir: string) => genesisSeedCid(readGenesisSeedBytes(join(dir, "genesis"))!);

  test("a boot whose seed differs from the seed witness names the offer ratchet by ratchet, and does not throw", () => {
    const { root, storage } = stage();
    const buildA = dirWithSeed("A"); const buildB = dirWithSeed("B", false, { grammar: "b".repeat(64), floor: "e".repeat(64) });
    pinGenesisSeed(storage, resolveGenesis({ corpusRoot: root, shippedRoot: buildA }));
    let line = "";
    expect(() => { line = checkGenesisPin(storage, resolveGenesis({ corpusRoot: root, shippedRoot: buildB })); }).not.toThrow();
    expect(line).toContain("[genesis seed] a newer seed waits: engine same · grammar moved · plugins same · floor moved");
    expect(line).toContain(`seed (offered) ${cidOf(buildB)} (shipped at ${join(buildB, "genesis")})`);
    expect(line).toContain(`seed witness ${cidOf(buildA)}`);
    expect(line).toContain("the founding record keeps serving");
  });

  test("CONTROL: a torn seed witness still refuses by name", () => {
    const { root, storage } = stage();
    writeFileSync(join(storage, "genesis-pin.json"), "{ torn");
    expect(() => checkGenesisPin(storage, resolveGenesis({ corpusRoot: root, shippedRoot: dirWithSeed("A") }))).toThrow(/genesis seed.*does not read/);
    writeFileSync(join(storage, "genesis-pin.json"), JSON.stringify({ dir: "/x" }));
    expect(() => checkGenesisPin(storage, resolveGenesis({ corpusRoot: root, shippedRoot: dirWithSeed("A") }))).toThrow(/genesis seed.*names no seed CID/);
  });

  test("the seed witness records for every source: root, explicit and configured seeds as well as shipped", () => {
    const makers = [
      (seedRoot: string, shippedRoot: string) => resolveGenesis({ corpusRoot: seedRoot, shippedRoot }),
      (seedRoot: string, shippedRoot: string) => resolveGenesis({ explicit: join(seedRoot, "genesis"), corpusRoot: dirWithSeed(null), shippedRoot }),
      (seedRoot: string, shippedRoot: string) => resolveGenesis({ configured: join(seedRoot, "genesis"), corpusRoot: dirWithSeed(null), shippedRoot }),
    ];
    for (const make of makers) {
      const { storage } = stage();
      const held = dirWithSeed("mine"); const shipped = dirWithSeed("other", false, { grammar: "b".repeat(64) });
      const resolution = make(held, shipped);
      expect(resolution.source).not.toBe("shipped");
      pinGenesisSeed(storage, resolution);
      expect(checkGenesisPin(storage, resolution)).toBe(`[genesis seed] witnessed ${cidOf(held)} — this boot's seed matches the seed witness (self-consistency)`);
      // Another seed now reads as an offer against this founding's witness.
      expect(checkGenesisPin(storage, resolveGenesis({ explicit: join(shipped, "genesis"), corpusRoot: dirWithSeed(null), shippedRoot: shipped })))
        .toContain("a newer seed waits: engine same · grammar moved · plugins same · floor same");
    }
  });

  test("a re-found on another seed replaces the earlier witness", () => {
    const { root, storage } = stage();
    const buildA = dirWithSeed("A"); const held = dirWithSeed("mine");
    pinGenesisSeed(storage, resolveGenesis({ corpusRoot: root, shippedRoot: buildA }));
    pinGenesisSeed(storage, resolveGenesis({ corpusRoot: held, shippedRoot: buildA }));
    expect(checkGenesisPin(storage, resolveGenesis({ corpusRoot: held, shippedRoot: buildA }))).toContain(`witnessed ${cidOf(held)}`);
  });

  test("the founding output names the directory and the CID it used", () => {
    const shipped = dirWithSeed("A");
    const resolution = resolveGenesis({ corpusRoot: dirWithSeed(null), shippedRoot: shipped });
    const line = genesisFoundingLine(resolution);
    expect(line).toContain(join(shipped, "genesis"));
    expect(line).toContain(cidOf(shipped));
  });

  test("R4: a LAR_GENESIS override that diverges from the witness reads as an offer, naming the witness it compared against", () => {
    const { root, storage } = stage();
    const buildA = dirWithSeed("A"); const override = dirWithSeed("B");
    pinGenesisSeed(storage, resolveGenesis({ corpusRoot: root, shippedRoot: buildA }));
    const line = checkGenesisPin(storage, resolveGenesis({ explicit: join(override, "genesis"), corpusRoot: root, shippedRoot: buildA }));
    expect(line).toContain(`seed (offered) ${cidOf(override)} (explicit at ${join(override, "genesis")})`);
    expect(line).toContain(`seed witness ${cidOf(buildA)} (founded at ${join(buildA, "genesis")}; ${join(storage, "genesis-pin.json")})`);
    // Seeds that differ only in their actor seed differ on no ratchet: the offer names that plainly.
    expect(line).toContain("engine same · grammar same · plugins same · floor same");
  });

  test("R4: the check reads back witnessed or unwitnessed, and a hearth with no witness says unwitnessed", () => {
    const { root, storage } = stage();
    const buildA = dirWithSeed("A");
    const cidA = cidOf(buildA);
    expect(checkGenesisPin(storage, resolveGenesis({ corpusRoot: root, shippedRoot: buildA })))
      .toBe(`[genesis seed] unwitnessed — no seed witness at ${join(storage, "genesis-pin.json")}; this boot serves seed ${cidA} (shipped at ${join(buildA, "genesis")}) and holds nothing to compare it against`);
    pinGenesisSeed(storage, resolveGenesis({ corpusRoot: root, shippedRoot: buildA }));
    expect(checkGenesisPin(storage, resolveGenesis({ corpusRoot: root, shippedRoot: buildA })))
      .toBe(`[genesis seed] witnessed ${cidA} — this boot's seed matches the seed witness (self-consistency)`);
  });
});
