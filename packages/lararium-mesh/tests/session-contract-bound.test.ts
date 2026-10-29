import { describe, expect, test } from "vitest";
import { SessionTable, sessionBinding, validateSessionBoundEnvelope, type SessionFace } from "../src/session-contract.js";

const face = (name: string): SessionFace => ({
  personaGroup: `group-${name}`, proofSubject: `proof-${name}`, admitRef: `admit-${name}`,
  causalRevision: `revision-${name}`,
  planes: { persona: `persona-${name}`, circles: `circles-${name}`, identities: `identities-${name}`,
    sessions: `sessions-${name}`, intents: `intents-${name}` },
});

describe("bound session envelopes", () => {
  test("the first fault wins, refusals leave both sessions acting, and bound carries references alone", () => {
    let id = 0;
    const table = new SessionTable("epoch", () => `session-${++id}`);
    const own = sessionBinding("socket");
    const sibling = sessionBinding("socket");
    const a = table.open(own, face("a"), "seat");
    const b = table.open(sibling, face("b"), "seat");
    if (!a.ok || !b.ok) throw new Error("fixture open refused");
    const envelope = { ownerEpoch: a.session.ownerEpoch, sessionId: a.session.sessionId,
      generation: a.session.generation, faceRef: a.session.face.proofSubject };
    const other = { ownerEpoch: b.session.ownerEpoch, sessionId: b.session.sessionId,
      generation: b.session.generation, faceRef: b.session.face.proofSubject };
    expect(table.checkBound(envelope, own).ok).toBe(true);
    expect(table.bound(own)).toEqual({ ownerEpoch: "epoch", sessionId: a.session.sessionId,
      generation: 0, faceRef: "proof-a", profile: "seat" });
    expect(Object.isFrozen(table.bound(own))).toBe(true);
    expect(JSON.stringify(table.bound(own))).not.toContain("planes");
    expect(Object.values(table.bound(own)!).every((value) => typeof value === "string" || typeof value === "number")).toBe(true);
    expect(validateSessionBoundEnvelope({ ...envelope, faceRef: "" })).toBeNull();
    const faults: Array<[unknown, typeof own, string]> = [
      [{ ownerEpoch: "epoch", sessionId: a.session.sessionId, generation: 0 }, own, "malformed-message"],
      [{ ...envelope, faceRef: "" }, sibling, "malformed-message"],
      [{ ...envelope, ownerEpoch: "old" }, sibling, "stale-owner-epoch"],
      [{ ...envelope, sessionId: "absent" }, sibling, "unknown-session"],
      [envelope, sibling, "unbound-session"],
      [{ ...envelope, generation: 1, faceRef: "proof-b" }, own, "stale-generation"],
      [{ ...envelope, faceRef: "proof-b" }, own, "wrong-face"],
    ];
    for (const [message, binding, refusal] of faults) {
      expect(table.checkBound(message, binding)).toEqual({ ok: false, refusal });
      expect(table.checkBound(envelope, own).ok).toBe(true);
      expect(table.checkBound(other, sibling).ok).toBe(true);
      expect(table.size).toBe(2);
    }
    table.transition(a.session.sessionId, "switching");
    expect(table.checkBound(envelope, own)).toMatchObject({ refusal: "session-not-live" });
    expect(table.checkBound(other, sibling).ok).toBe(true);
    expect(table.advance(a.session.sessionId, 0, face("a")).ok).toBe(true);
    expect(table.checkBound(envelope, own)).toMatchObject({ refusal: "stale-generation" });
    // The advanced session stays switching until its owner's commit steps it live.
    expect(table.checkBound({ ...envelope, generation: 1 }, own)).toMatchObject({ refusal: "session-not-live" });
    table.transition(a.session.sessionId, "live");
    expect(table.checkBound({ ...envelope, generation: 1 }, own).ok).toBe(true);
  });
});
