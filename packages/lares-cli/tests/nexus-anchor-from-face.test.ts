/**
 * nexus-anchor-from-face — `seal anchor --from <carriage partial>` follows the roll's shape: the reporting face's session
 * opens before the carriage lands (a face that cannot open one refuses by the vessel's name, with nothing landed), and a
 * face that locks after that preflight costs the edge report alone, by name, while the landed carriage reports whole.
 * The store door stands in for a running vessel at its two seams: the face preflight and the rows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const vessel = vi.hoisted(() => ({ lockedAtPreflight: false, lockedAtStanding: false, rows: [] as string[] }));

vi.mock("../src/store-door.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/store-door.js")>();
  return {
    ...real,
    proveFaceSession: async () => {
      if (vessel.lockedAtPreflight) throw new real.RoutedVerbRefused("local session refused: face-locked", "face-locked");
    },
    storeVerb: async (verb: string) => {
      vessel.rows.push(verb);
      if (verb === "nexus-roll-anchor-edge-standing" && vessel.lockedAtStanding) throw new real.RoutedVerbRefused("local session refused: face-locked", "face-locked");
      if (verb === "nexus-roll-anchor-edge-standing") return { output: { edgeAnchors: [] }, via: "daemon" };
      return { output: { verdict: "landed", signed: ["ab".repeat(32)], partial: { aid: "nexus-aid-synthetic" },
        landed: { anchorCid: "cd".repeat(32), parents: [], boardUrl: "automerge:board" } }, via: "daemon" };
    },
  };
});

import { cmdSealAnchor } from "../src/commands/nexus-anchor-cmd.js";
import { parseArgs } from "../src/parse-args.js";

describe("seal anchor --from a carriage partial", () => {
  let dir: string;
  let from: string;
  const out: string[] = [];
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "anchor-from-face-"));
    from = join(dir, "partial.json");
    writeFileSync(from, JSON.stringify({ carriage: "synthetic" }));
    vessel.lockedAtPreflight = false; vessel.lockedAtStanding = false; vessel.rows = [];
    out.length = 0;
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { out.push(String(chunk)); return true; });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }); });
  const run = () => cmdSealAnchor(parseArgs(["nexus", "seal", "anchor", "--from", from, "--face", "2", "--json"]));
  const answer = () => JSON.parse(out.join("").trim()) as Record<string, unknown>;

  it("RED: a named face whose session cannot open refuses by the vessel's name, and the carriage never lands", async () => {
    vessel.lockedAtPreflight = true;
    expect(await run()).not.toBe(0);
    expect(answer()).toMatchObject({ ok: false, error: { code: "face-locked" } });
    expect(vessel.rows).toEqual([]);
  });

  it("RED: a face that locks after the preflight costs the edge report alone; the landed carriage reports whole", async () => {
    vessel.lockedAtStanding = true;
    expect(await run()).toBe(0);
    expect(answer()).toMatchObject({ ok: true, data: { verdict: "landed", edgeFace: "face-locked", landed: { anchorCid: "cd".repeat(32) } } });
    expect(vessel.rows).toEqual(["nexus-roll-anchor-partial", "nexus-roll-anchor-edge-standing"]);
  });

  it("CONTROL: an open face lands the carriage and reads its edges", async () => {
    expect(await run()).toBe(0);
    expect(answer()).toMatchObject({ ok: true, data: { verdict: "landed", edgeAnchors: [] } });
  });
});
