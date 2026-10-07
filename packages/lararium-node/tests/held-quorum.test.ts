/**
 * held-quorum — the ONE selector both quorum doors (membership `nexus contract`, antigen `nexus kapae`) read
 * their signers through, and the refusal each door still words for its own act.
 *
 * Proven, against real persona-roots on a temp LAR_ROOT:
 *   · it picks exactly `threshold` distinct HELD roots that sit IN the roster, and nothing outside it,
 *   · a sub-quorum hands the door's own refusal the held count and the threshold, and throws THAT error,
 *   · CONTROL: a roster seating none of the held roots refuses at zero held.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { KahuQuorumSeats } from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot } from "../src/node-vessel-identity.js";
import { selectHeldQuorumSigners } from "../src/held-quorum.js";

let root: string;
let priorLarRoot: string | undefined;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "lares-held-quorum-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  await generateOrLoadVesselIdentity();
});
afterEach(() => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(root, { recursive: true, force: true });
});

class DoorRefusal extends Error {}
const refuse = (held: number, k: number): Error => new DoorRefusal(`door: ${held} of ${k}`);

const rosterOf = (keys: string[], threshold: number): KahuQuorumSeats => ({ keys, threshold, sealEpochCid: "epoch0-x" });

describe("selectHeldQuorumSigners — one selector, each door's own refusal", () => {
  it("selects exactly threshold distinct held roots seated in the roster", async () => {
    const a = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey.toLowerCase();
    const b = (await generateOrLoadPersonaGroupRoot(1)).verifyingKey.toLowerCase();
    await generateOrLoadPersonaGroupRoot(2);   // held, never seated — must not be picked

    const picked = await selectHeldQuorumSigners(rosterOf([a.toUpperCase(), b, "f".repeat(64)], 2), refuse);

    expect(picked.map((s) => s.verifyingKey).sort()).toEqual([a, b].sort());
    expect(picked.map((s) => s.handleIndex).sort()).toEqual([0, 1]);
  });

  it("a sub-quorum throws the DOOR's refusal, handed the held count and the threshold", async () => {
    const a = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey;
    await expect(selectHeldQuorumSigners(rosterOf([a, "e".repeat(64)], 2), refuse))
      .rejects.toThrow(new DoorRefusal("door: 1 of 2"));
  });

  it("CONTROL: a roster seating none of the held roots refuses at zero held", async () => {
    await generateOrLoadPersonaGroupRoot(0);
    await expect(selectHeldQuorumSigners(rosterOf(["d".repeat(64)], 1), refuse))
      .rejects.toBeInstanceOf(DoorRefusal);
  });
});
