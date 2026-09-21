/**
 * Genesis bundle retirement controls.
 *
 * The production source is seed.json + manifest.json + cas/<cid>. The
 * deterministic Automerge document is reconstructed only here as an integrity
 * witness. Each assertion is deliberately weakened by the failure it names:
 * altered seed, wrong manifest/CAS bytes, or a resurrected binary-era output.
 */
import { describe, expect, test } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import {
  materializeGenesisDoc,
  sha256HexBytesSync,
  validateGenesisBundleCoherence,
  type GenesisSeed,
} from "@lararium/mesh";
import { readGenesisManifest, readGenesisSeed } from "../src/genesis-artifact.js";

const GENESIS_DIR = join(repoRoot, "genesis");

describe("production genesis bundle — seed + manifest + CAS", () => {
  test("canonical bundle stands and retired binary/sidecar outputs are absent", () => {
    expect(existsSync(join(GENESIS_DIR, "seed.json"))).toBe(true);
    expect(existsSync(join(GENESIS_DIR, "manifest.json"))).toBe(true);
    expect(existsSync(join(GENESIS_DIR, "cas"))).toBe(true);
    for (const retired of [
      "island.bin", "island.sha256", "island.sha256-pre", "island.cid",
      "island.cid-engine", "island.cid-grammar", "island.cid-plugins",
      "island.genesis.json", "island.manifest.json",
    ]) expect(existsSync(join(GENESIS_DIR, retired)), retired).toBe(false);
  });

  test("altering seed data changes the deterministic witness", () => {
    const seed = JSON.parse(readFileSync(join(GENESIS_DIR, "seed.json"), "utf8")) as GenesisSeed;
    const altered: GenesisSeed = { ...seed, schemaVersion: `${seed.schemaVersion}-altered` };
    expect(materializeGenesisDoc(altered)).not.toEqual(materializeGenesisDoc(seed));
  });

  test("manifest CIDs match every immutable CAS member", () => {
    const manifest = readGenesisManifest(GENESIS_DIR);
    const seed = readGenesisSeed(GENESIS_DIR);
    expect(manifest).not.toBeNull();
    expect(seed).not.toBeNull();
    expect(() => validateGenesisBundleCoherence(seed!, manifest!)).not.toThrow();
    for (const blob of manifest!.blobs) {
      const bytes = new Uint8Array(readFileSync(join(GENESIS_DIR, "cas", blob.cid)));
      expect(sha256HexBytesSync(bytes), blob.id).toBe(blob.cid);
    }
    expect(seed?.format).toBe("lararium-genesis-seed/v1");
  });

  test("canonical manifest closes the retained genesis CAS directory", () => {
    const manifest = readGenesisManifest(GENESIS_DIR);
    expect(manifest).not.toBeNull();
    const retained = readdirSync(join(GENESIS_DIR, "cas"), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
    const named = manifest!.blobs.map((blob) => blob.cid).sort();
    expect(retained).toEqual(named);
  });
});
