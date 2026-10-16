/**
 * dial-presentation — the dial composes a presentation only from a readable pin, a face group, a kept admit and a charter
 * held here; each absence names itself and opens no session.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { custodyRootDoor, deriveGateBundle, sovereignGateRoot, sovereignRoute, hex, type GateBundlePin } from "@lararium/mesh";
import { SessionTable, sessionBinding } from "../../lararium-mesh/src/session-contract.js";
import { admitBundlePathFor } from "../src/admit-bundle.js";
import { composeDialPresentation, nexusAidOfPin } from "../src/dial-presentation.js";

const AID = `nexus-${"ab".repeat(32)}`;
const pinAt = (aid: string): GateBundlePin => {
  const bundle = deriveGateBundle(sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(6) })), new TextEncoder().encode(aid), sovereignRoute("/ws"));
  try { return bundle.pin; } finally { bundle.drop(); }
};

let sealHome: string;
beforeEach(() => { sealHome = mkdtempSync(join(tmpdir(), "lares-dial-presentation-")); });
afterEach(() => { rmSync(sealHome, { recursive: true, force: true }); });

const compose = (over: Partial<Parameters<typeof composeDialPresentation>[0]> = {}) => {
  const table = new SessionTable("owner-epoch-dial");
  return composeDialPresentation({ sealHome, pin: pinAt(AID), personaGroup: "0xb7f1c2a9d4e60381", table, binding: sessionBinding("socket"), profile: "verb", ...over })
    .then((made) => ({ made, table }));
};

describe("what the dial presents", () => {
  test("the Nexus is the AID text the pin's hex names, and a hex that is not text names none", () => {
    expect(nexusAidOfPin(pinAt(AID))).toBe(AID);
    expect(nexusAidOfPin({ nexus: hex(Uint8Array.from([0xff, 0xfe])) })).toBeNull();
  });

  test("each absence names itself and opens nothing", async () => {
    const bad = await compose({ pin: { ...pinAt(AID), nexus: hex(Uint8Array.from([0xff, 0xfe])) } });
    expect(bad.made).toEqual({ refusal: "pin-nexus-unreadable" });
    expect((await compose({ personaGroup: null })).made).toEqual({ refusal: "face-group-absent" });
    const none = await compose();
    expect(none.made).toEqual({ refusal: "admit-absent" });
    expect(none.table.size).toBe(0);
    // A kept bundle with no charter held here reads no root.
    const path = admitBundlePathFor(sealHome, AID);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "{}");
    expect((await compose()).made).toEqual({ refusal: "admit-absent" });
  });
});
