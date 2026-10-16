/**
 * hearth-dial-choice — the dial's url and pin are chosen as ONE pair, and every kept pin files under the hearth that issued it.
 *
 *   K1  RED: two kept bundles from two hearths file each pin under its own hearth, never both under the dialed one
 *   K2  RED: the bootstrap names hearth A, a kept bundle names hearth B: the dial goes to A with A's pin, never B's,
 *       and the note names the disagreement
 *   K3  RED: an explicit url at hearth B dials B with B's kept pin, never the bootstrap's pin for A
 *   K4  RED: a kept bundle whose opening does not answer its admit's commitment files nothing (re-read at seeding)
 *   K5  RED: a kept bundle whose pin stands at another Nexus, or is signed by another gate, files nothing
 *   K6  CONTROL: one kept bundle, no bootstrap: its url and pin are the dial
 *   K7  a kept bundle naming no sync url files nowhere, and says so
 *   K8  RED: the bootstrap's pin and a kept pin share the dialed hearth and differ: the bootstrap's pin is the dial, and a
 *       WARNING names the disagreement (never silent) / CONTROL: the same pin twice warns nothing
 *   K9  RED (house ruling "The admit's gate pin", carrier (b)): the floor pins a signed fleet-join answer carried, kept for the dialed
 *       pin's Nexus, file under the dialed hearth; a kept pin at another Nexus or at sovereign tier files nothing, and with
 *       no dial pin none file
 */
import { describe, expect, it } from "vitest";
import {
  admitCarriageCommit, custodyRootDoor, deriveGateBundle, sovereignGateRoot, sovereignRoute, hearthPinIndex,
  floorGateRoot, floorKeyDoor, floorRoute,
  type AdmitOpening, type GateBundlePin,
} from "@lararium/mesh";
import { chooseHearthDial, fileHearthPins, hearthNameOf } from "../src/hearth-gate-pins.js";
import type { AdmitBundle } from "../src/admit-bundle.js";

const SALT = "ab".repeat(32);
const pinAt = (aid: string, tag: number): GateBundlePin =>
  deriveGateBundle(sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(tag) })), new TextEncoder().encode(aid), sovereignRoute("/ws")).pin;
const openingFor = (gatePin: GateBundlePin): AdmitOpening => ({ carriage: { gatePin, canon: {} }, salt: SALT });
const bundle = (aid: string, pin: GateBundlePin, syncUrl?: string, over: Partial<{ commit: string; gatePubKey: string }> = {}): AdmitBundle => ({
  aid, gatePubKey: over.gatePubKey ?? pin.signingKey,
  admit: { carriageCommit: over.commit ?? admitCarriageCommit(openingFor(pin)) } as unknown as AdmitBundle["admit"],
  lineage: [], opening: openingFor(pin), ...(syncUrl ? { syncUrl } : {}),
});

const A_URL = "wss://hearth-a.example/ws";
const B_URL = "wss://hearth-b.example/ws";
const A = hearthNameOf(A_URL);
const B = hearthNameOf(B_URL);
const pinA = pinAt("nexus-a", 1);
const pinB = pinAt("nexus-b", 2);
const floorAt = (aid: string, route = "/oracle", tag = 8): GateBundlePin =>
  deriveGateBundle(floorGateRoot(floorKeyDoor({ derive: () => new Uint8Array(32).fill(tag) })), new TextEncoder().encode(aid), floorRoute(route)).pin;

describe("chooseHearthDial", () => {
  it("K1 RED: each kept pin files under the hearth that issued it", () => {
    const c = chooseHearthDial({ kept: [bundle("nexus-a", pinA, A_URL), bundle("nexus-b", pinB, B_URL)] });
    expect(c.filings.map((f) => [f.hearth, f.pin.signingKey])).toEqual([[A, pinA.signingKey], [B, pinB.signingKey]]);
    const index = hearthPinIndex();
    expect(fileHearthPins(index, c.filings)).toBe(2);
    expect(index.get({ hearth: A, nexus: pinA.nexus, route: pinA.route, tier: pinA.tier })?.signingKey).toBe(pinA.signingKey);
    expect(index.get({ hearth: A, nexus: pinB.nexus, route: pinB.route, tier: pinB.tier })).toBeFalsy();
    expect(c.syncUrl).toBeNull();                                   // two urls: no kept default
    expect(c.notes.join("\n")).toMatch(/2 sync urls/);
  });

  it("K2 RED: the bootstrap's hearth dials with its own pin, never another hearth's kept pin", () => {
    const c = chooseHearthDial({ hearthPin: { syncUrl: A_URL, gatePin: pinA }, kept: [bundle("nexus-b", pinB, B_URL)] });
    expect(c.syncUrl).toBe(A_URL);
    expect(c.pin?.signingKey).toBe(pinA.signingKey);
    expect(c.notes.join("\n")).toMatch(new RegExp(`goes to ${A.replace(/[.]/g, "\\.")}.*${B.replace(/[.]/g, "\\.")}`));
    // A bootstrap with no pin dials A with NO pin: B's kept pin is not A's.
    const bare = chooseHearthDial({ hearthPin: { syncUrl: A_URL }, kept: [bundle("nexus-b", pinB, B_URL)] });
    expect(bare.syncUrl).toBe(A_URL);
    expect(bare.pin).toBeNull();
  });

  it("K3 RED: an explicit url dials its own hearth's pin, never the bootstrap's", () => {
    const c = chooseHearthDial({ explicitUrl: B_URL, hearthPin: { syncUrl: A_URL, gatePin: pinA }, kept: [bundle("nexus-b", pinB, B_URL)] });
    expect(c.syncUrl).toBe(B_URL);
    expect(c.pin?.signingKey).toBe(pinB.signingKey);
  });

  it("K4 RED: an opening that does not answer its admit's commitment files nothing", () => {
    const c = chooseHearthDial({ kept: [bundle("nexus-a", pinA, A_URL, { commit: "00".repeat(32) })] });
    expect(c.filings).toEqual([]);
    expect(c.pin).toBeNull();
    expect(c.notes.join("\n")).toMatch(/does not answer its admit's commitment/);
  });

  it("K5 RED: a pin at another Nexus, or signed by another gate, files nothing", () => {
    const other = chooseHearthDial({ kept: [bundle("nexus-a", pinB, A_URL)] });
    expect(other.filings).toEqual([]);
    expect(other.notes.join("\n")).toMatch(/pin-other-nexus/);
    const gate = chooseHearthDial({ kept: [bundle("nexus-a", pinA, A_URL, { gatePubKey: pinB.signingKey })] });
    expect(gate.filings).toEqual([]);
    expect(gate.notes.join("\n")).toMatch(/another gate/);
  });

  it("K6 CONTROL: one kept bundle is the dial", () => {
    const c = chooseHearthDial({ kept: [bundle("nexus-a", pinA, A_URL)], walkRelay: B_URL });
    expect(c.syncUrl).toBe(A_URL);
    expect(c.pin?.signingKey).toBe(pinA.signingKey);
    expect(c.notes).toEqual([]);
  });

  it("K7 a kept bundle naming no sync url files nowhere", () => {
    const c = chooseHearthDial({ kept: [bundle("nexus-a", pinA)], walkRelay: B_URL });
    expect(c.filings).toEqual([]);
    expect(c.syncUrl).toBe(B_URL);
    expect(c.pin).toBeNull();
    expect(c.notes.join("\n")).toMatch(/names no sync url/);
  });

  it("K8 RED: a bootstrap pin and a differing kept pin at the same hearth: the bootstrap's is the dial, and a warning says so", () => {
    const moved = pinAt("nexus-a", 3);
    const c = chooseHearthDial({ hearthPin: { syncUrl: A_URL, gatePin: pinA }, kept: [bundle("nexus-a", moved, A_URL)] });
    expect(c.pin?.signingKey).toBe(pinA.signingKey);
    expect(c.warnings.join("\n")).toMatch(/bootstrap's pin.*differ/);
    // CONTROL: the kept bundle holds the bootstrap's own pin: nothing to warn.
    const same = chooseHearthDial({ hearthPin: { syncUrl: A_URL, gatePin: pinA }, kept: [bundle("nexus-a", pinA, A_URL)] });
    expect(same.warnings).toEqual([]);
  });

  it("K9 RED: kept floor pins at the dialed pin's Nexus file under the dialed hearth, and nothing else does", () => {
    const oracle = floorAt("nexus-a");
    const asked: string[] = [];
    const keptFloor = (nexusHex: string) => { asked.push(nexusHex); return [oracle, floorAt("nexus-b", "/shelf"), { ...pinA }]; };
    const c = chooseHearthDial({ hearthPin: { syncUrl: A_URL, gatePin: pinA }, kept: [], keptFloor });
    expect(asked).toEqual([pinA.nexus]);
    expect(c.filings.map((f) => [f.hearth, f.pin.tier, f.pin.route])).toEqual([[A, "sovereign", "/ws"], [A, "floor", "/oracle"]]);
    const index = hearthPinIndex();
    fileHearthPins(index, c.filings);
    expect(index.get({ hearth: A, nexus: oracle.nexus, route: "/oracle", tier: "floor" })).toEqual(oracle);
    // No dial pin: no floor pin files.
    const bare = chooseHearthDial({ hearthPin: { syncUrl: A_URL }, kept: [], keptFloor });
    expect(bare.filings).toEqual([]);
  });
});
