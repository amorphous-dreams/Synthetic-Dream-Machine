/**
 * genesis-pin-founding -- the genesis pin moves only when a founding SUCCEEDS.
 *
 * A vessel pinned to seed A that attempts `found --force` on a shifted build and refuses (custody locked) must
 * keep seed A's pin: its unchanged store boots on the shifted build, and the boot must still refuse. A pin
 * replaced before custody opens would let the refused founding launder the shift. A successful re-found pins
 * the seed it used.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { repoRoot } from "@lararium/mesh/node";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { runInit } from "../src/commands/init.js";
import { ownedStore } from "../src/owned-store.js";
import { seatCustody } from "../src/custody-seat.js";
import { checkGenesisPin, resolveGenesis } from "../src/genesis-resolve.js";
import { foundDirect } from "./found-route.js";

const SHIPPED = join(repoRoot, "genesis");
const roots: string[] = [];
const priorGenesis = process.env["LAR_GENESIS"];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  if (priorGenesis === undefined) delete process.env["LAR_GENESIS"]; else process.env["LAR_GENESIS"] = priorGenesis;
});

describe("the pin moves with a successful founding only", () => {
  test("RED: a refused `found --force` keeps the old pin, so the boot on the shifted build still refuses — CONTROL: a successful re-found pins the new seed", async () => {
    delete process.env["LAR_GENESIS"];
    expect(existsSync(join(SHIPPED, "seed.json"))).toBe(true);
    const r = mkdtempSync(join(tmpdir(), "lar-pin-founding-")); roots.push(r);
    const storage = join(r, "data", "lares", "vessel");
    mkdirSync(storage, { recursive: true });
    const pinPath = join(storage, "genesis-pin.json");

    await withLarRoot(r, async () => {
      await foundDirect({ storageDir: storage, genesisDir: SHIPPED });
      const pinned = JSON.parse(readFileSync(pinPath, "utf8")) as { seedCid: string };
      expect(pinned.seedCid).toMatch(/^[0-9a-f]{64}$/);

      // The build shifts: the pin now names a seed (A) that the shipped one (B) no longer matches.
      const seedA = "a".repeat(64);
      writeFileSync(pinPath, JSON.stringify({ seedCid: seedA, dir: "/build-a/genesis", source: "shipped" }));

      // A founding that refuses at custody (nothing seated) must leave A's pin standing.
      seatCustody(null);
      await expect(ownedStore(storage, (repo) =>
        runInit({ repo, storageDir: storage, genesisDir: SHIPPED, force: true, custody: { slots: [] } }))).rejects.toThrow(/rests unopened|CustodyLocked|locked/i);
      expect((JSON.parse(readFileSync(pinPath, "utf8")) as { seedCid: string }).seedCid).toBe(seedA);
      // ...so the boot on the shifted build refuses by name.
      expect(() => checkGenesisPin(storage, resolveGenesis({ corpusRoot: r, shippedRoot: repoRoot }))).toThrow(/genesis seed/);

      // CONTROL: a founding that succeeds pins the seed it used, and the boot passes.
      await foundDirect({ storageDir: storage, genesisDir: SHIPPED, force: true });
      expect((JSON.parse(readFileSync(pinPath, "utf8")) as { seedCid: string }).seedCid).toBe(pinned.seedCid);
      expect(() => checkGenesisPin(storage, resolveGenesis({ corpusRoot: r, shippedRoot: repoRoot }))).not.toThrow();
    });
  }, 120_000);
});
