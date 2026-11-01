/**
 * session-sign-door — the vessel's book answers the daemon island from the session that placed one call, and from no
 * other: its certificate, its subject and the vessel's own chain, then each signature, signed on this thread.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, test } from "vitest";
import { SessionSignBook } from "../src/session-sign-door.js";
import { answerSessionSign, setSessionSignDoor } from "../src/worker-handle.js";
import type { UdsSessionSigner } from "../src/uds-channel.js";

const CHAIN = { scope: { faceKey: "aa".repeat(32), nexus: "nexus-one" }, vesselFaceKey: "bb".repeat(32) };
const NEXUS = { kind: "nexus" as const, aid: "nexus-one" };
const PLACE = { kind: "place" as const, aid: "place-one", head: "head-one" };

function signer(): UdsSessionSigner & { signed: Uint8Array[] } {
  const signed: Uint8Array[] = [];
  let dropped = false;
  return {
    signed,
    get dropped() { return dropped; },
    drop() { dropped = true; },
    certificate: { scope: CHAIN.scope, vesselFaceKey: CHAIN.vesselFaceKey, sessionKey: "cc".repeat(32) },
    async sign(purpose, payload) {
      if (dropped) return { refusal: "signer-dropped" };
      signed.push(payload);
      return { signature: `sig-${purpose}-${payload.length}` };
    },
  };
}
const payload = new Uint8Array([1, 2, 3]);

describe("the session sign door answers from the session that placed the call", () => {
  test("a Nexus session's booked call reads its certificate, subject and the vessel's own chain, and signs on this thread", async () => {
    const book = new SessionSignBook();
    const s = signer();
    const release = book.hold("req-1", "sealed-seal", { signer: s, anchor: NEXUS, subject: "subject-1" });
    const door = book.door(() => CHAIN, async () => ({ read: true, counted: ["raise-1", "raise-2"], unanswered: ["raise-2"] }));
    expect(await door({ op: "read", ask: "req-1", verb: "sealed-seal" })).toEqual({ certificate: s.certificate, subject: "subject-1", chain: CHAIN, foldRead: true, counted: ["raise-1", "raise-2"], unanswered: ["raise-2"] });
    expect(await door({ op: "sign", ask: "req-1", verb: "sealed-seal", payload })).toEqual({ signature: "sig-act-3" });
    expect(s.signed).toEqual([payload]);
    release();
    expect(book.size).toBe(0);
  });

  test("an ask no session booked, or one naming another verb under a booked id, borrows no signer", async () => {
    const book = new SessionSignBook();
    const s = signer();
    book.hold("req-1", "sealed-open", { signer: s, anchor: NEXUS, subject: "subject-1" });
    const door = book.door(() => CHAIN);
    expect(await door({ op: "sign", ask: "req-2", verb: "sealed-open", payload })).toEqual({ refusal: "signer-unavailable" });
    expect(await door({ op: "sign", ask: "req-1", verb: "sealed-seal", payload })).toEqual({ refusal: "signer-unavailable" });
    expect(s.signed).toEqual([]);
  });

  test("a second call under a booked id books nothing: the in-flight call keeps its own session's signer", async () => {
    const book = new SessionSignBook();
    const first = signer(), second = signer();
    book.hold("req-1", "sealed-seal", { signer: first, anchor: NEXUS, subject: "subject-1" });
    const releaseSecond = book.hold("req-1", "sealed-seal", { signer: second, anchor: NEXUS, subject: "subject-2" });
    const door = book.door(() => CHAIN);
    expect(await door({ op: "read", ask: "req-1", verb: "sealed-seal" })).toMatchObject({ subject: "subject-1" });
    await door({ op: "sign", ask: "req-1", verb: "sealed-seal", payload });
    releaseSecond();
    expect(await door({ op: "read", ask: "req-1", verb: "sealed-seal" })).toMatchObject({ subject: "subject-1" });
    expect([first.signed.length, second.signed.length]).toEqual([1, 0]);
  });

  test("a released call answers nothing more: the booking lives for the call alone", async () => {
    const book = new SessionSignBook();
    const release = book.hold("req-1", "sealed-seal", { signer: signer(), anchor: NEXUS, subject: "subject-1" });
    release();
    expect(await book.door(() => CHAIN)({ op: "read", ask: "req-1", verb: "sealed-seal" })).toEqual({ refusal: "signer-unavailable" });
  });

  test("a place session reaches no sealed store: `session-anchor-place`, and it signs nothing", async () => {
    const book = new SessionSignBook();
    const s = signer();
    book.hold("req-1", "sealed-seal", { signer: s, anchor: PLACE, subject: "subject-1" });
    const door = book.door(() => CHAIN);
    expect(await door({ op: "read", ask: "req-1", verb: "sealed-seal" })).toEqual({ refusal: "session-anchor-place" });
    expect(await door({ op: "sign", ask: "req-1", verb: "sealed-seal", payload })).toEqual({ refusal: "session-anchor-place" });
    expect(s.signed).toEqual([]);
  });

  test("a lock, a close or a switch drops the signer, and the next ask refuses `signer-refused`", async () => {
    const book = new SessionSignBook();
    const s = signer();
    book.hold("req-1", "sealed-seal", { signer: s, anchor: NEXUS, subject: "subject-1" });
    s.drop();
    expect(await book.door(() => CHAIN)({ op: "sign", ask: "req-1", verb: "sealed-seal", payload })).toEqual({ refusal: "signer-refused" });
  });

  test("a fold that fails answers `signer-unavailable`: the island never reads it as nothing owed", async () => {
    const book = new SessionSignBook();
    book.hold("req-1", "sealed-seal", { signer: signer(), anchor: NEXUS, subject: "subject-1" });
    expect(await book.door(() => CHAIN, async () => { throw new Error("board unread"); })({ op: "read", ask: "req-1", verb: "sealed-seal" })).toEqual({ refusal: "signer-unavailable" });
  });

  test("no own chain standing (no dial presentation composed) answers `signer-unavailable`", async () => {
    const book = new SessionSignBook();
    book.hold("req-1", "sealed-seal", { signer: signer(), anchor: NEXUS, subject: "subject-1" });
    expect(await book.door(() => null)({ op: "read", ask: "req-1", verb: "sealed-seal" })).toEqual({ refusal: "signer-unavailable" });
  });

  test("the worker door: no door standing, or a malformed ask, refuses by name on the same request id", async () => {
    setSessionSignDoor(null);
    expect(await answerSessionSign({ requestId: "w1", op: "read", ask: "req-1", verb: "sealed-seal" })).toEqual({ type: "session:signed", requestId: "w1", refusal: "signer-unavailable" });
    const book = new SessionSignBook();
    book.hold("req-1", "sealed-seal", { signer: signer(), anchor: NEXUS, subject: "subject-1" });
    setSessionSignDoor(book.door(() => CHAIN));
    try {
      expect(await answerSessionSign({ requestId: "w2", op: "sign", ask: "req-1", verb: "sealed-seal" })).toEqual({ type: "session:signed", requestId: "w2", refusal: "signer-unavailable" });
      expect(await answerSessionSign({ requestId: "w3", op: "sign", ask: "req-1", verb: "sealed-seal", payload })).toEqual({ type: "session:signed", requestId: "w3", signature: "sig-act-3" });
    } finally { setSessionSignDoor(null); }
  });
});
