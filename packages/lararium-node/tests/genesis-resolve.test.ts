/**
 * genesis-resolve -- ONE resolver names the genesis dir for the founding, the daemon and the CLI, and a cold
 * root reaches the build's shipped seed with no hand copy.
 *
 * The genesis manifest is the CAS sweep's protect set (an empty set means delete), so two readers that
 * resolve differently would let one sweep away a seed the other never saw. An explicit declaration wins and
 * never falls back; only a root that holds NO seed.json falls to the shipped seed; a torn root seed refuses.
 *
 * A vessel founded on the shipped seed pins the seed CID it used. The oracle island reloads from the store at
 * boot and never compares the seed (measured: `materializeGenesisIsland` returns a persisted doc before it
 * reads the seed), so a boot on a build whose shipped seed differs stood silent; the pin makes it refuse by name.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { checkGenesisPin, genesisFoundingLine, pinGenesisSeed, resolveGenesis } from "../src/genesis-resolve.js";
import { genesisSeedCid, readGenesisSeedBytes } from "../src/genesis-artifact.js";

const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

function dirWithSeed(tag: string | null, torn = false): string {
  const dir = mkdtempSync("/tmp/lararium-genesis-resolve-"); roots.push(dir);
  if (tag !== null) {
    mkdirSync(join(dir, "genesis"), { recursive: true });
    writeFileSync(join(dir, "genesis", "seed.json"), torn ? "{ torn" : JSON.stringify({ format: "lararium-genesis-seed/v1", actorSeed: tag, blobs: {}, tiddlers: {} }));
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

describe("a vessel founded on the shipped seed pins the CID it used", () => {
  const stage = () => { const root = dirWithSeed(null); const storage = mkdtempSync("/tmp/lararium-genesis-pin-"); roots.push(storage); return { root, storage }; };

  test("a boot whose resolved seed differs from the pin refuses by name, naming both CIDs", () => {
    const { root, storage } = stage();
    const buildA = dirWithSeed("A"); const buildB = dirWithSeed("B");
    pinGenesisSeed(storage, resolveGenesis({ corpusRoot: root, shippedRoot: buildA }));
    const cidA = genesisSeedCid(readGenesisSeedBytes(join(buildA, "genesis"))!);
    const cidB = genesisSeedCid(readGenesisSeedBytes(join(buildB, "genesis"))!);
    expect(() => checkGenesisPin(storage, resolveGenesis({ corpusRoot: root, shippedRoot: buildB })))
      .toThrow(new RegExp(`genesis seed.*${cidA}.*${cidB}|genesis seed.*${cidB}.*${cidA}`));
  });

  test("CONTROL: the same seed passes; a vessel with no pin passes; a root-held seed pins nothing", () => {
    const { root, storage } = stage();
    const buildA = dirWithSeed("A");
    expect(() => checkGenesisPin(storage, resolveGenesis({ corpusRoot: root, shippedRoot: buildA }))).not.toThrow();
    pinGenesisSeed(storage, resolveGenesis({ corpusRoot: root, shippedRoot: buildA }));
    expect(() => checkGenesisPin(storage, resolveGenesis({ corpusRoot: root, shippedRoot: buildA }))).not.toThrow();
    const held = stage();
    pinGenesisSeed(held.storage, resolveGenesis({ corpusRoot: dirWithSeed("mine"), shippedRoot: buildA }));
    expect(() => checkGenesisPin(held.storage, resolveGenesis({ corpusRoot: held.root, shippedRoot: dirWithSeed("other") }))).not.toThrow();
  });

  test("a re-found on another source clears the earlier pin, so no stale pin outlives it", () => {
    const { root, storage } = stage();
    pinGenesisSeed(storage, resolveGenesis({ corpusRoot: root, shippedRoot: dirWithSeed("A") }));
    pinGenesisSeed(storage, resolveGenesis({ corpusRoot: dirWithSeed("mine"), shippedRoot: dirWithSeed("A") }));
    expect(() => checkGenesisPin(storage, resolveGenesis({ corpusRoot: root, shippedRoot: dirWithSeed("B") }))).not.toThrow();
  });

  test("the founding output names the directory and the CID it used", () => {
    const shipped = dirWithSeed("A");
    const resolution = resolveGenesis({ corpusRoot: dirWithSeed(null), shippedRoot: shipped });
    const cid = genesisSeedCid(readGenesisSeedBytes(join(shipped, "genesis"))!);
    const line = genesisFoundingLine(resolution);
    expect(line).toContain(join(shipped, "genesis"));
    expect(line).toContain(cid);
  });
});
