/**
 * socket-sort — the gate classes every proven socket once, before its verdict, and answers a stranger only when
 * some Nexus it carries reads OPEN; the wire names no gate key and carries no refusal.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/siege-resilience#/the-active-prober
 */
import { describe, expect, test } from "vitest";
import * as mesh from "../src/index.js";
import { classifySocket, answersStrangers } from "../src/federation-gate.js";
import { isLarAuthMsg, mkLarChallenge, mkLarAuth, runPeerHandshake } from "../src/auth-wire.js";
import { knockPath, knockedUrl, knockSegment } from "../src/gate-knock.js";
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

describe("the wire confesses nothing", () => {
  test("RED: the challenge names no gate key, and no refusal message exists", () => {
    expect(Object.keys(mkLarChallenge("ab".repeat(32))).sort()).toEqual(["nonce", "type"]);
    for (const gone of ["mkLarAuthDenied", "isLarAuthDeniedMsg"]) expect(gone in mesh, gone).toBe(false);
  });

  test("RED: one presentation slot — the retired `presentedAdmit` field is refused, `presented` carries the admit", async () => {
    const admit = await carriageAct(new Uint8Array(32).fill(5), "admit", { kahu: [new Uint8Array(32).fill(3)], epoch: "e".repeat(64), parents: [] });
    const base = mkLarAuth("card", "ab".repeat(32), "cd".repeat(64), "ef".repeat(32));
    expect(isLarAuthMsg({ ...base, presented: { kind: "admit", admit, lineage: [] } })).toBe(true);
    expect(isLarAuthMsg({ ...base, presentedAdmit: { admit, lineage: [] } })).toBe(false);
    expect(isLarAuthMsg({ ...base, presented: { kind: "admit", admit, lineage: [] }, edge: {} })).toBe(false);
    expect(isLarAuthMsg({ ...base, presented: { kind: "nothing" } })).toBe(false);
    expect(isLarAuthMsg(base)).toBe(true);   // CONTROL: a bare proof parses
  });

  test("RED: a gate that answers nothing ends the handshake as no answer, never a hang", async () => {
    const frames: unknown[] = [mkLarChallenge("ab".repeat(32))];
    const verdict = await runPeerHandshake({
      recv: async () => frames.shift(), send: () => {},
      contactCard: "{}", peerPubKey: "aa".repeat(32), gatePubKey: "bb".repeat(32), aud: "lar:///x",
      sign: () => "00".repeat(64),
    });
    expect(verdict).toEqual({ ok: false, reason: "no answer" });
  });
});

describe("the knock — the upgrade path derives from the pinned gate key", () => {
  const K1 = "11".repeat(32);
  const K2 = "22".repeat(32);

  test("RED: the path is the route plus a key-derived segment, and differs per key and per route", () => {
    expect(knockPath(K1, "/ws")).toMatch(/^\/ws\/[0-9a-f]{32}$/);
    expect(knockPath(K1, "/ws")).not.toBe(knockPath(K2, "/ws"));
    expect(knockSegment(K1, "/ws")).not.toBe(knockSegment(K1, "/oracle"));
    expect(knockPath(K1, "/ws/")).toBe(knockPath(K1, "/ws"));
  });

  test("RED: a dialer's URL carries the knock its own pin derives", () => {
    expect(knockedUrl("ws://h:1/ws", K1)).toBe(`ws://h:1${knockPath(K1, "/ws")}`);
    expect(knockedUrl("wss://h/oracle", K2)).toBe(`wss://h${knockPath(K2, "/oracle")}`);
    expect(() => knockedUrl("ws://h:1/ws", "not-a-key")).toThrow();
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
