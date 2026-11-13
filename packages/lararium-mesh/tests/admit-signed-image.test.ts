/**
 * The admit's signed image: every signed field, the carried canon and the gate pin among them, moves its act CID.
 */
import { describe, expect, test } from "vitest";
import { admitCarriageCommit, carriageEntryActCid, openAdmitCarriage } from "../src/carriage-registry.js";
import { carriageAct } from "./fixtures/carriage.js";
import { sovereignPinAt } from "./fixtures/sovereign-pin.js";

describe("the admit's signed image", () => {
  test("CONTROL: changing an existing signed admit field changes its act CID", async () => {
    const entry = await carriageAct(new Uint8Array(32).fill(31), "admit", { kahu: [new Uint8Array(32).fill(32)], epoch: "epoch-admit" });
    expect(carriageEntryActCid({ ...entry, parents: ["different-parent"] })).not.toBe(carriageEntryActCid(entry));
  });

  // ADMIT_SIGNS_CANON_AND_PIN stands built: admit-carriage.test.ts holds its two-face, two-Nexus vectors.
  test("ADMIT_SIGNS_CANON_AND_PIN: changing the carried canon or gate pin changes the signed admit image", async () => {
    const opening = openAdmitCarriage({ gatePin: sovereignPinAt("nexus-admit", 1), canon: { "bags/lares": "automerge:hearth-a" } });
    const withPin = await carriageAct(new Uint8Array(32).fill(31), "admit", { kahu: [new Uint8Array(32).fill(32)], epoch: "epoch-admit", carriageCommit: admitCarriageCommit(opening) });
    const withOtherPin = { ...withPin, carriageCommit: admitCarriageCommit({ ...opening, carriage: { ...opening.carriage, gatePin: sovereignPinAt("nexus-admit", 2) } }) };
    const withOtherCanon = { ...withPin, carriageCommit: admitCarriageCommit({ ...opening, carriage: { ...opening.carriage, canon: { "bags/lares": "automerge:hearth-b" } } }) };
    expect(carriageEntryActCid(withOtherPin)).not.toBe(carriageEntryActCid(withPin));
    expect(carriageEntryActCid(withOtherCanon)).not.toBe(carriageEntryActCid(withPin));
  });
});
