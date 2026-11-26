/**
 * floor-adopt (3d, follow-lei S2) — `lares vessel floor adopt` reads the seed a genesis dir offers (its CID, the receipt, and its
 * floor manifest) and prints the preview or the landing: the local floor, its base, what moves, the receipt, the prior kept, and
 * the one next line. A refusal and a replay say so by name.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { GENESIS_FLOOR_TIDDLER } from "@lararium/mesh/floor-manifest";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import { type FloorAdoptOutcome } from "@lararium/mesh/floor-accept";
import { floorAdoptLines, floorSettleLines, seedFloorOf } from "../src/commands/floor.js";

const scratch: string[] = [];
afterEach(() => { for (const d of scratch.splice(0)) rmSync(d, { recursive: true, force: true }); });
const dirWith = (body: string): string => { const d = mkdtempSync("/tmp/lares-floor-adopt-"); scratch.push(d); mkdirSync(join(d, "g")); writeFileSync(join(d, "g", "seed.json"), body); return join(d, "g"); };

describe("the adopt reads the seed and speaks its landing", () => {
  test("RED: the seed's CID and its floor witness read off seed.json; a seed naming no floor says why", () => {
    const body = JSON.stringify({ format: "x", tiddlers: { [GENESIS_FLOOR_TIDDLER]: { tiddler: { cid: "a".repeat(64) } } } });
    expect(seedFloorOf(dirWith(body))).toEqual({ seedCid: sha256HexBytesSync(new TextEncoder().encode(body)), seedFloor: "a".repeat(64) });
    expect(seedFloorOf(dirWith(JSON.stringify({ tiddlers: {} })))).toMatchObject({ why: expect.stringContaining("names no floor") });
    expect(seedFloorOf("/nonexistent-genesis")).toMatchObject({ why: expect.stringContaining("no seed.json") });
  });

  test("RED: the preview names the local floor, its base, the receipt, the prior and the apply line; the landing names commit and revert", () => {
    const local = { base: "b".repeat(64), receipt: "5".repeat(64), prior: { release: null, manifest: "b".repeat(64), base: null, receipt: null }, state: "staged" as const };
    const r = { ok: true, moved: true, applied: false, staged: [], remount: null, moves: ["plugins"], manifestBytes: new Uint8Array(),
      manifest: { format: "lararium-floor", engine: "e".repeat(64), plugins: "c".repeat(64), snapshots: {} },
      prior: { kind: "floor-accept", nexus: "n", release: null, manifest: "b".repeat(64), took: [] },
      accept: { kind: "floor-accept", nexus: "n", release: null, manifest: "d".repeat(64), took: [], local } } as unknown as FloorAdoptOutcome;
    const preview = floorAdoptLines(r).join("\n");
    expect(preview).toContain(`would stage local floor ${"d".repeat(64)}`);
    expect(preview).toContain(`base:     ${"b".repeat(64)}`);
    expect(preview).toContain(`receipt:  seed ${"5".repeat(64)}`);
    expect(preview).toContain("`lares vessel floor adopt --apply`");
    const landed = floorAdoptLines({ ...r, applied: true } as FloorAdoptOutcome).join("\n");
    expect(landed).toContain("STAGED local floor");
    expect(landed).toContain("`lares vessel floor adopt --commit`");
    expect(landed).toContain("`lares vessel floor adopt --revert`");
  });

  test("CONTROL: a refusal and a replay speak by name", () => {
    expect(floorAdoptLines({ ok: false, refusal: "adopt-engine-held", detail: "engine moved" })).toEqual(["floor adopt → REFUSED adopt-engine-held: engine moved"]);
    expect(floorAdoptLines({ ok: true, moved: false, applied: false, why: "the seed offers no plugins past the base", accept: {} as never })[0]).toContain("HELD");
    expect(floorSettleLines("commit", { ok: false, refusal: "adopt-none-local", detail: "no local floor" })[0]).toContain("REFUSED adopt-none-local");
  });
});
