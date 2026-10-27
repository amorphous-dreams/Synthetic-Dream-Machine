import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LegacyPlaceBytesRefused, refuseLegacyPlaceBytes } from "../src/legacy-place-bytes.js";
import { larIdentityDir } from "../src/vessel-paths.js";
import { openNodeVessel } from "../src/open-node-vessel.js";
import { runInit } from "../src/commands/init.js";

describe("retired place Keyhive bytes", () => {
  it("accepts a fresh store and refuses a planted place archive by name", () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-place-archive-"));
    expect(() => refuseLegacyPlaceBytes(dir)).not.toThrow();
    writeFileSync(join(dir, "place-archive.bin"), new Uint8Array([1, 2, 3]));
    expect(() => refuseLegacyPlaceBytes(dir)).toThrow(LegacyPlaceBytesRefused);
    expect(() => refuseLegacyPlaceBytes(dir)).toThrow(/re-found this vessel from a fresh store/);
  });
  it("accepts a fresh store and refuses a planted Keyhive vessel card by name", () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-vessel-card-"));
    expect(() => refuseLegacyPlaceBytes(dir)).not.toThrow();
    writeFileSync(join(dir, ".vessel-card.json"), JSON.stringify({ id: "old-place-individual" }));
    expect(() => refuseLegacyPlaceBytes(dir)).toThrow(LegacyPlaceBytesRefused);
  });
});

describe("retired bytes at the node entrances", () => {
  for (const row of ["place-archive.bin", ".vessel-card-old.json"] as const) {
    it(`refuses ${row} at both boot and founding before either entrance uses its options`, async () => {
      const root = mkdtempSync(join(tmpdir(), "lares-old-entrances-"));
      const prior = process.env["LAR_ROOT"];
      process.env["LAR_ROOT"] = root;
      try {
        const identityDir = larIdentityDir();
        mkdirSync(identityDir, { recursive: true });
        expect(() => refuseLegacyPlaceBytes(identityDir)).not.toThrow(); // fresh-store control
        writeFileSync(join(identityDir, row), new Uint8Array([1, 2, 3]));
        await expect(openNodeVessel({} as never)).rejects.toBeInstanceOf(LegacyPlaceBytesRefused);
        await expect(runInit({} as never)).rejects.toBeInstanceOf(LegacyPlaceBytesRefused);
      } finally {
        if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
});
