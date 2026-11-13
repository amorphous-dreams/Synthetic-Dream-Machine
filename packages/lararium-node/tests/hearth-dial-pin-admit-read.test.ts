/**
 * hearth-dial-pin reads the bootstrap's pin as an ADMIT's pin (`readAdmitGatePin`): the sovereign tier, the sovereign sync
 * route, and the Nexus where the bootstrap names it (a charter island's scope). A pin of another tier, route or Nexus
 * refuses the whole dial; it never files under a key the dial would not ask.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { custodyRootDoor, deriveGateBundle, sovereignGateRoot, sovereignRoute, type GateBundlePin } from "@lararium/mesh";
import { world } from "../../lararium-mesh/tests/face-gate-fixture.js";
import { hearthDialTiddlers, readHearthDialPin } from "../src/hearth-dial-pin.js";

const door = custodyRootDoor({ derive: () => new Uint8Array(32).fill(4) });
const sovereignAt = (nexus: string, route = "/ws"): GateBundlePin => {
  const b = deriveGateBundle(sovereignGateRoot(door), new TextEncoder().encode(nexus), sovereignRoute(route));
  try { return b.pin; } finally { b.drop(); }
};
/** A floor-tier pin on the sync route: the floor key's own bundle, as the gate fixture's floor world derives it. */
const floorPin = async (): Promise<GateBundlePin> => (await world({ tier: "floor", route: "/ws" })).pin;

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const bootstrapWith = (tiddlers: Record<string, unknown>): string => {
  const dir = mkdtempSync(join(tmpdir(), "lares-hearth-pin-read-"));
  dirs.push(dir);
  const path = join(dir, "social-bootstrap.json");
  writeFileSync(path, JSON.stringify({ title: "$:/plugins/lares/bootstrap", text: JSON.stringify({ tiddlers }) }));
  return path;
};
const URL_ = "ws://127.0.0.1:4242/ws";
const AID = `nexus-${"cd".repeat(32)}`;

describe("the bootstrap's pin reads as an admit's pin", () => {
  test("CONTROL: a sovereign sync pin at the charter's Nexus reads whole", () => {
    const pin = sovereignAt(AID);
    const read = readHearthDialPin(bootstrapWith(hearthDialTiddlers(URL_, pin.signingKey, { kind: "charter", scope: AID }, pin)));
    expect(read?.gatePin).toEqual(pin);
  });
  test("RED: a floor-tier pin refuses the dial", async () => {
    const pin = await floorPin();
    expect(readHearthDialPin(bootstrapWith(hearthDialTiddlers(URL_, pin.signingKey, null, pin)))).toBeNull();
  });
  test("RED: a sovereign pin on another route refuses the dial", () => {
    const pin = sovereignAt(AID, "/other");
    expect(readHearthDialPin(bootstrapWith(hearthDialTiddlers(URL_, pin.signingKey, null, pin)))).toBeNull();
  });
  test("RED: a pin at another Nexus than the charter island names refuses the dial", () => {
    const pin = sovereignAt(`nexus-${"ef".repeat(32)}`);
    expect(readHearthDialPin(bootstrapWith(hearthDialTiddlers(URL_, pin.signingKey, { kind: "charter", scope: AID }, pin)))).toBeNull();
  });
  test("CONTROL: an anchor island names no Nexus for the pin, so any Nexus's sovereign sync pin reads", () => {
    const pin = sovereignAt(AID);
    const read = readHearthDialPin(bootstrapWith(hearthDialTiddlers(URL_, pin.signingKey, { kind: "anchor", scope: "ab".repeat(32) }, pin)));
    expect(read?.gatePin).toEqual(pin);
  });
});
