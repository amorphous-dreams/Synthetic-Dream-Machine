/**
 * floor-drift-live — the lay's real drift door (`liveFloorDrift`), and `vessel lay --lag` riding it with no injected reader.
 *
 * Only the two edges it touches answer from a fake: the socket probe (`udsAlive`) and the store door (`storeVerb`). Everything
 * between them runs as shipped, so the reading the lag prints is the reading the door made.
 *
 * REDS, each with its control:
 *   · no vessel stands: the drift reads null, names why, and the store door is never asked (the lag opens no store);
 *   · a standing vessel's reading passes through whole;
 *   · a vessel whose build carries no drift reading answers no `floorDrift` field: null, named as such, never 0;
 *   · a vessel that reads the drift null hands its own reason on; a refused or throwing read names its fault;
 *   · `vessel lay --lag --json` with the default reader carries the door's reading beside `lag`, lag untouched.
 *
 * The house root is a scratch LAR_ROOT per test (LAR_BAGS set per test, never globally).
 * Meme: lar:///ha.ka.ba/lararium/node/genesis-island#/the-floor-rides-releases
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedArgs } from "../src/parse-args.js";

const door = vi.hoisted(() => ({ alive: false, answer: (): Record<string, unknown> => ({}), calls: 0 }));
vi.mock("../src/local-connector.js", async (orig) => ({ ...(await orig<typeof import("../src/local-connector.js")>()), udsAlive: vi.fn(async () => door.alive) }));
vi.mock("../src/store-door.js", async (orig) => ({
  ...(await orig<typeof import("../src/store-door.js")>()),
  storeVerb: vi.fn(async (verb: string) => { door.calls++; if (verb !== "floor-status") throw new Error(`unexpected ${verb}`); return { output: door.answer(), via: "socket" }; }),
}));
vi.mock("../src/commands/act.js", () => ({ cmdAct: vi.fn(async () => 0) }));
vi.mock("../src/commands/ingest.js", async (orig) => ({ ...(await orig<typeof import("../src/commands/ingest.js")>()), cmdIngest: vi.fn(async () => 0) }));

const CREST = "lar:///ha.ka.ba/lararium/mesh/wave-crest";
const DRIFT = { manifest: "f".repeat(64), count: 1, carriers: [CREST], slugs: [{ slug: "lararium", missing: [CREST], older: [] }], unread: [] };

describe("the lay's live floor-drift door", () => {
  let root: string;
  const prior = { root: process.env["LAR_ROOT"], bags: process.env["LAR_BAGS"] };
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-floor-drift-live-"));
    process.env["LAR_ROOT"] = join(root, "lar");
    door.alive = false; door.answer = () => ({}); door.calls = 0;
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (prior.root === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior.root;
    if (prior.bags === undefined) delete process.env["LAR_BAGS"]; else process.env["LAR_BAGS"] = prior.bags;
  });

  it("RED: no standing vessel reads null by name and never asks the store door", async () => {
    const { liveFloorDrift } = await import("../src/commands/lay.js");
    expect(await liveFloorDrift()).toEqual({ drift: null, why: "no standing vessel answers the floor read" });
    expect(door.calls).toBe(0);
  });

  it("RED: a standing vessel's reading passes through; an older vessel's missing field reads null by name, never 0", async () => {
    const { liveFloorDrift } = await import("../src/commands/lay.js");
    door.alive = true;
    door.answer = () => ({ verb: "floor-status", floorDrift: DRIFT });
    expect(await liveFloorDrift()).toEqual({ drift: DRIFT });
    door.answer = () => ({ verb: "floor-status", pinSource: "genesis" });
    expect(await liveFloorDrift()).toEqual({ drift: null, why: expect.stringMatching(/answers no drift reading/) });
  });

  it("RED: the vessel's own reason rides on; a refused read names its refusal", async () => {
    const { liveFloorDrift } = await import("../src/commands/lay.js");
    door.alive = true;
    door.answer = () => ({ floorDrift: null, floorDriftWhy: "no catalog names live canon beside this store, so no live canon reads here" });
    expect(await liveFloorDrift()).toEqual({ drift: null, why: "no catalog names live canon beside this store, so no live canon reads here" });
    door.answer = () => ({ refused: "this place holds no bootstrap", refusal: "floor-no-vessel" });
    expect(await liveFloorDrift()).toEqual({ drift: null, why: "the floor read refused: this place holds no bootstrap" });
  });

  it("RED: `vessel lay --lag --json` with the default reader carries the door's reading beside lag; a throwing door names its fault", async () => {
    const { cmdLay } = await import("../src/commands/lay.js");
    const bags = join(root, "corpus", "bags");
    mkdirSync(join(bags, "notes", "ha.ka.ba", "notes"), { recursive: true });
    writeFileSync(join(bags, "notes", "ha.ka.ba", "notes", "one.tid"), "title: lar:///ha.ka.ba/notes/one\n\nthe first\n");
    process.env["LAR_BAGS"] = bags;
    const { LIVE_MIRROR_DOORS } = await import("../src/seed-mirrors.js");
    const doors = { ...LIVE_MIRROR_DOORS, faces: async () => [], heldSlugs: async () => new Set<string>(), benchSeat: async () => ({ writeSlot: "working" as const, bound: true }), canonWikis: () => null };
    const lagOnce = async (): Promise<Record<string, unknown>> => {
      const written: string[] = [];
      const write = process.stdout.write;
      process.stdout.write = ((chunk: unknown) => { written.push(String(chunk)); return true; }) as typeof process.stdout.write;
      try { expect(await cmdLay({ command: "vessel", positional: [], options: {}, flags: { lag: true, json: true } } as unknown as ParsedArgs, doors)).toBe(0); }
      finally { process.stdout.write = write; }
      return (JSON.parse(written.join("").trim().split("\n").at(-1)!) as { data: Record<string, unknown> }).data;
    };
    door.alive = true;
    door.answer = () => ({ floorDrift: DRIFT });
    expect(await lagOnce()).toMatchObject({ lag: 1, floorDrift: DRIFT });
    door.answer = () => { throw new Error("the socket went"); };
    expect(await lagOnce()).toMatchObject({ lag: 1, floorDrift: null, floorDriftWhy: "the floor read faulted: the socket went" });
  });
});
