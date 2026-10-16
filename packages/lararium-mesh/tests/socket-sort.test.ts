/**
 * socket-sort — the gate classes every proven socket once, before its verdict, and answers a stranger only when
 * some Nexus it carries reads OPEN; the wire names no gate key and carries no refusal.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/siege-resilience#/the-active-prober
 */
import { describe, expect, test } from "vitest";
import * as mesh from "../src/index.js";
import { classifySocket, answersStrangers } from "../src/federation-gate.js";
import { knockSegment } from "../src/gate-bundle.js";
import { carriageAct } from "./fixtures/carriage.js";

const proven = (over: Partial<Parameters<typeof classifySocket>[0]> = {}) => ({
  sameOperator: false, contracted: false, walker: false, answersStrangers: false, ...over,
});

describe("classifySocket — four classes, and silence", () => {
  test("RED: a PRIVATE stranger is silence; an OPEN stranger is a stranger", () => {
    expect(classifySocket(proven())).toBeNull();
    expect(classifySocket(proven({ answersStrangers: true }))).toBe("stranger");
  });

  test("RED: contracted and walker sockets stand whatever the posture", () => {
    for (const open of [false, true]) {
      expect(classifySocket(proven({ contracted: true, answersStrangers: open }))).toBe("contracted");
      expect(classifySocket(proven({ walker: true, answersStrangers: open }))).toBe("walker");
    }
  });

  test("CONTROL: same-operator admits under both postures, and outranks every other fact", () => {
    for (const open of [false, true]) {
      expect(classifySocket(proven({ sameOperator: true, contracted: true, walker: true, answersStrangers: open }))).toBe("same-operator");
    }
  });

  test("answersStrangers: any carried Nexus OPEN answers; none carried answers none; the default is PRIVATE", () => {
    expect(mesh.DEFAULT_FEDERATION_POSTURE).toBe("private");
    expect(answersStrangers([])).toBe(false);
    expect(answersStrangers(["private"])).toBe(false);
    expect(answersStrangers(["private", "open"])).toBe(true);
  });

  test("RED: the classifiers the sort replaced are gone from the mesh surface", () => {
    for (const gone of ["classifyCrossOperatorAdmission", "postureGatesCrossOperator", "admitCrossOperatorUnderPosture"]) {
      expect(gone in mesh, gone).toBe(false);
    }
  });
});

describe("the knock — the upgrade segment derives from the pinned key", () => {
  const K1 = "11".repeat(32);
  const K2 = "22".repeat(32);

  test("RED: the segment is 32 hex characters, and differs per key and per route", () => {
    expect(knockSegment(K1, "/ws")).toMatch(/^[0-9a-f]{32}$/);
    expect(knockSegment(K1, "/ws")).not.toBe(knockSegment(K2, "/ws"));
    expect(knockSegment(K1, "/ws")).not.toBe(knockSegment(K1, "/oracle"));
    expect(knockSegment(K1, "/ws/")).toBe(knockSegment(K1, "/ws"));
    expect(() => knockSegment("not-a-key", "/ws")).toThrow();
  });
});

describe("the carriage pins every peer it pulls", () => {
  test("RED: a bootstrap peer names its gate key in the fragment; an entry without one names no gate", async () => {
    const { parseMeshPeer } = await import("../src/carriage-caps.js");
    expect(parseMeshPeer(`http://boot:8080#${"AB".repeat(32)}`)).toEqual({ endpoint: "http://boot:8080", gatePubKey: "ab".repeat(32) });
    expect(parseMeshPeer("http://boot:8080")).toBeNull();
    expect(parseMeshPeer("http://boot:8080#short")).toBeNull();
    expect(parseMeshPeer(`ws://boot:8080#${"ab".repeat(32)}`)).toBeNull();
  });

  test("RED: discovery carries each dial's key as its pin and skips a dial with no key", async () => {
    const { discoverPeers } = await import("../src/carriage-caps.js");
    const { dialEntryToRecord } = await import("../src/mesh-palace.js");
    const keyed   = dialEntryToRecord({ bearing: "lar:///b/1", verifyingKeyHex: "c".repeat(64), endpoint: "http://one:1", scale: "dreamnet" }, "t");
    const keyless = dialEntryToRecord({ bearing: "lar:///b/2", verifyingKeyHex: "not-a-key", endpoint: "http://two:2", scale: "dreamnet" }, "t");
    const doc = { tiddlers: { [keyed.tiddler.title]: keyed, [keyless.tiddler.title]: keyless } };
    const boot = { endpoint: "http://boot:8080", gatePubKey: "b".repeat(64) };
    expect(discoverPeers(doc, [boot], undefined, 16)).toEqual([boot, { endpoint: "http://one:1", gatePubKey: "c".repeat(64) }]);
  });
});
