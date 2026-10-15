/** Source inventory until the W built-image negative probe can exercise every live dial. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { admitCarriageCommit, carriageEntryActCid, openAdmitCarriage } from "../src/carriage-registry.js";
import { carriageAct } from "./fixtures/carriage.js";

const red = process.env.LAR_UNBUILT_REDS === "1" ? test : test.skip;
const root = join(import.meta.dirname, "..", "..");
const callerFiles = [
  "lararium-node/src/authenticated-membership-relay.ts",
  "lararium-node/src/daemon-auth-gate.ts",
  "lararium-mesh/src/lar-ws-client-adapter.ts",
  "lararium-mesh/src/oracle-read-client.ts",
  "lararium-mesh/src/sibling-channel.ts",
];
const code = (file: string) => readFileSync(join(root, file), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");

describe("W cutover reach", () => {
  test("CONTROL: the old-wire inventory names live caller expressions, not comments", () => {
    expect(callerFiles.filter((file) => /\b(runPeerHandshake|mkLarChallenge)\s*\(/.test(code(file)))).toHaveLength(callerFiles.length);
  });

  red("NO_OLD_WIRE_PRODUCTION_CALLER: every enumerated production dial and listener drops the retired handshake", () => {
    expect(callerFiles.filter((file) => /\b(runPeerHandshake|mkLarChallenge)\s*\(/.test(code(file)))).toEqual([]);
  });

  test("CONTROL: changing an existing signed admit field changes its act CID", async () => {
    const entry = await carriageAct(new Uint8Array(32).fill(31), "admit", { kahu: [new Uint8Array(32).fill(32)], epoch: "epoch-cutover" });
    expect(carriageEntryActCid({ ...entry, parents: ["different-parent"] })).not.toBe(carriageEntryActCid(entry));
  });

  // ADMIT_SIGNS_CANON_AND_PIN stands built: admit-carriage.test.ts holds its two-face, two-Nexus vectors.
  test("ADMIT_SIGNS_CANON_AND_PIN: changing the carried canon or gate pin changes the signed admit image", async () => {
    const opening = openAdmitCarriage({ gatePin: "aa".repeat(32), canon: { "bags/lares": "automerge:hearth-a" } });
    const withPin = await carriageAct(new Uint8Array(32).fill(31), "admit", { kahu: [new Uint8Array(32).fill(32)], epoch: "epoch-cutover", carriageCommit: admitCarriageCommit(opening) });
    const withOtherPin = { ...withPin, carriageCommit: admitCarriageCommit({ ...opening, carriage: { ...opening.carriage, gatePin: "bb".repeat(32) } }) };
    const withOtherCanon = { ...withPin, carriageCommit: admitCarriageCommit({ ...opening, carriage: { ...opening.carriage, canon: { "bags/lares": "automerge:hearth-b" } } }) };
    expect(carriageEntryActCid(withOtherPin)).not.toBe(carriageEntryActCid(withPin));
    expect(carriageEntryActCid(withOtherCanon)).not.toBe(carriageEntryActCid(withPin));
  });
});
