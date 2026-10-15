/**
 * Genesis bundle retirement controls.
 *
 * The production source is seed.json + cas/<cid>. The
 * deterministic Automerge document is reconstructed only here as an integrity
 * witness. Each assertion is deliberately weakened by the failure it names:
 * altered seed or wrong CAS bytes.
 */
import { describe, expect, test } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import {
  materializeGenesisDoc,
  sha256HexBytesSync,
  genesisCasManifestFromSeed,
  type GenesisSeed,
} from "@lararium/mesh";
import { parseGenesisSeed, readGenesisCasManifest, readGenesisSeed } from "../src/genesis-artifact.js";

const GENESIS_DIR = join(repoRoot, "genesis");

describe("production genesis bundle — seed + CAS", () => {
  test("canonical bundle holds only its seed and CAS roots", () => {
    expect(existsSync(join(GENESIS_DIR, "seed.json"))).toBe(true);
    expect(existsSync(join(GENESIS_DIR, "cas"))).toBe(true);
  });

  test("altering seed data changes the deterministic witness", () => {
    const seed = JSON.parse(readFileSync(join(GENESIS_DIR, "seed.json"), "utf8")) as GenesisSeed;
    const altered: GenesisSeed = { ...seed, actorSeed: `${seed.actorSeed.slice(0, -2)}${seed.actorSeed.endsWith("00") ? "01" : "00"}` };
    expect(materializeGenesisDoc(altered)).not.toEqual(materializeGenesisDoc(seed));
  });

  test("RED: the production seed carries no version, and a seed that carries one reads as no seed", () => {
    const bytes = readFileSync(join(GENESIS_DIR, "seed.json"));
    const seed = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(seed, "schemaVersion")).toBe(false);
    expect(parseGenesisSeed(new Uint8Array(bytes))).not.toBeNull();                       // CONTROL
    const versioned = { ...seed, schemaVersion: "0.1" };
    expect(parseGenesisSeed(new TextEncoder().encode(JSON.stringify(versioned)))).toBeNull();
    expect(() => genesisCasManifestFromSeed(versioned as unknown as GenesisSeed)).toThrow(/carries a version/);
  });

  test("seed-derived CIDs match every immutable CAS member", () => {
    const manifest = readGenesisCasManifest(GENESIS_DIR);
    const seed = readGenesisSeed(GENESIS_DIR);
    expect(manifest).not.toBeNull();
    expect(seed).not.toBeNull();
    expect(() => genesisCasManifestFromSeed(seed!)).not.toThrow();
    for (const blob of manifest!.blobs) {
      const bytes = new Uint8Array(readFileSync(join(GENESIS_DIR, "cas", blob.cid)));
      expect(sha256HexBytesSync(bytes), blob.id).toBe(blob.cid);
    }
    expect(seed?.format).toBe("lararium-genesis-seed/v1");
  });

  test("seed-derived inventory closes the retained genesis CAS directory", () => {
    const manifest = readGenesisCasManifest(GENESIS_DIR);
    expect(manifest).not.toBeNull();
    const retained = readdirSync(join(GENESIS_DIR, "cas"), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
    const named = manifest!.blobs.map((blob) => blob.cid).sort();
    expect(retained).toEqual(named);
  });
});
