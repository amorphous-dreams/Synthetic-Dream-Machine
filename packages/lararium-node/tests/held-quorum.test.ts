/**
 * held-quorum — the ONE selector both quorum doors (membership `nexus contract`, antigen `nexus kapae`) read
 * their signers through, and the refusal each door still words for its own act.
 *
 * Proven, against real seat keys on a temp LAR_ROOT:
 *   · it picks exactly `threshold` distinct HELD seat keys that sit IN the roster, and nothing outside it,
 *   · a sub-quorum hands the door's own refusal the held count and the threshold, and throws THAT error,
 *   · CONTROL: a roster seating none of the held roots refuses at zero held.
 */
import { beforeEach, describe, expect } from "vitest";
import type { KahuQuorumSeats } from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot } from "../src/node-vessel-identity.js";
import { selectHeldQuorumSigners } from "../src/held-quorum.js";
import { seatChairs } from "./seat-fixture.js";
import { scratchRoot as root, it } from "./support/scratch-fixture.js";


beforeEach(async () => {
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
});

class DoorRefusal extends Error {}
const refuse = (held: number, k: number): Error => new DoorRefusal(`door: ${held} of ${k}`);

const rosterOf = (keys: string[], threshold: number): KahuQuorumSeats => ({ keys, threshold, sealEpochCid: "nexus-x" });

describe("selectHeldQuorumSigners — one selector, each door's own refusal", () => {
  it("selects exactly threshold distinct held seat keys seated in the roster", async () => {
    await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    const { keys: [a, b] = [] } = await seatChairs([0, 1]);
    await seatChairs([2]);   // held, never seated — must not be picked

    const picked = await selectHeldQuorumSigners(rosterOf([a!.toUpperCase(), b!, "f".repeat(64)], 2), refuse);

    expect(picked.map((s) => s.verifyingKey).sort()).toEqual([a, b].sort());
  });

  it("a sub-quorum throws the DOOR's refusal, handed the held count and the threshold", async () => {
    await generateOrLoadPersonaGroupRoot(0);
    const { keys: [a] = [] } = await seatChairs([0]);
    await expect(selectHeldQuorumSigners(rosterOf([a, "e".repeat(64)], 2), refuse))
      .rejects.toThrow(new DoorRefusal("door: 1 of 2"));
  });

  it("CONTROL: a roster seating none of the held seats refuses at zero held", async () => {
    await generateOrLoadPersonaGroupRoot(0);
    await expect(selectHeldQuorumSigners(rosterOf(["d".repeat(64)], 1), refuse))
      .rejects.toBeInstanceOf(DoorRefusal);
  });
});
