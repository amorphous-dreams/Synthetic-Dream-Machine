/**
 * session-contract.test — the contract a session holds with the vessel it rides.
 *
 * A pure contract with no caller proves itself by vectors alone. Proven here:
 *   · the id ROUTES and the binding AUTHORIZES: a copied id on another binding opens nothing;
 *   · the owner's epoch fences a restarted owner, and a generation fences an effect of an earlier one;
 *   · a switch commits only from `switching`, at the expected generation, onto a lawful face, and a refused
 *     commit changes nothing;
 *   · a face holds references alone: a root, a seed or a byte array fails the type and the validator;
 *   · a closed session leaves no trace, and the table offers no roster;
 *   · the refusals read in one fixed order, and the state machine admits its legal steps and no other;
 *   · the module stays out of the package barrel and reads no clock.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test, expect } from "vitest";
import {
  CAPABILITY_PROFILES, HAND_PROFILES, SessionContractError, isCapabilityProfile, refuseBeyondProfile, SessionTable, sessionBinding,
  sessionTransitionLegal, validateSessionEnvelope, validateSessionFace,
  type SessionFace, type SessionState,
} from "../src/session-contract.js";

const face = (suffix = "a"): SessionFace => ({
  personaGroup: `persona-${suffix}`, proofSubject: `proof-${suffix}`, admitRef: `admit-${suffix}`,
  causalRevision: `revision-${suffix}`,
  planes: { persona: `plane-persona-${suffix}`, circles: `plane-circles-${suffix}`, identities: `plane-identities-${suffix}`, sessions: `plane-sessions-${suffix}` },
});
const envelope = (sessionId: string, ownerEpoch = "epoch-a", generation = 0) => ({ ownerEpoch, sessionId, generation });
const opened = (table: SessionTable, binding = sessionBinding("port"), wearing: SessionFace = face()) => {
  const result = table.open(binding, wearing, "face");
  if (!result.ok) throw new Error(result.refusal);
  return result.session;
};

describe("session contract", () => {
  test("a copied id routes but only its bound binding authorizes", () => {
    const table = new SessionTable("epoch-a", () => "session-a");
    const own = sessionBinding("port");
    const stranger = sessionBinding("port");
    const session = opened(table, own);
    expect(table.check(envelope(session.sessionId), stranger)).toEqual({ ok: false, refusal: "unbound-session" });
    expect(table.check(envelope(session.sessionId), own)).toMatchObject({ ok: true, session });
  });

  test("owner epochs and generations fence stale effects", () => {
    const table = new SessionTable("epoch-a", () => "session-a");
    const binding = sessionBinding("socket");
    const session = opened(table, binding);
    expect(table.check(envelope(session.sessionId, "epoch-b"), binding)).toEqual({ ok: false, refusal: "stale-owner-epoch" });
    const restarted = new SessionTable("epoch-b", () => "other");
    expect(restarted.check(envelope(session.sessionId), binding)).toEqual({ ok: false, refusal: "stale-owner-epoch" });
    table.transition(session.sessionId, "switching");
    const advanced = table.advance(session.sessionId, 0, face("b"));
    expect(advanced.ok).toBe(true);
    expect(table.check(envelope(session.sessionId, "epoch-a", 0), binding)).toEqual({ ok: false, refusal: "stale-generation" });
    expect(table.check(envelope(session.sessionId, "epoch-a", 2), binding)).toEqual({ ok: false, refusal: "stale-generation" });
    expect(table.check(envelope(session.sessionId, "epoch-a", 1), binding).ok).toBe(true);
  });

  test("advance refusals do not mutate and a valid commit advances once", () => {
    const table = new SessionTable("epoch-a", () => "session-a");
    const binding = sessionBinding("port");
    const session = opened(table, binding);
    const before = table.check(envelope(session.sessionId), binding);
    expect(table.advance(session.sessionId, 1, face("b"))).toEqual({ ok: false, refusal: "session-not-switching" });
    expect(table.advance("absent", 0, face("b"))).toEqual({ ok: false, refusal: "unknown-session" });
    expect(table.check(envelope(session.sessionId), binding)).toEqual(before);
    expect(table.advance(session.sessionId, 0, face("b"))).toEqual({ ok: false, refusal: "session-not-switching" });
    expect(table.check(envelope(session.sessionId), binding)).toEqual(before);
    table.transition(session.sessionId, "switching");
    const switching = table.check(envelope(session.sessionId), binding);
    expect(table.advance(session.sessionId, 0, { ...face("b"), root: "synthetic-root" })).toEqual({ ok: false, refusal: "face-malformed" });
    expect(table.advance(session.sessionId, 1, face("b"))).toEqual({ ok: false, refusal: "stale-generation" });
    expect(table.check(envelope(session.sessionId), binding)).toEqual(switching);
    expect(switching).toEqual({ ok: false, refusal: "session-not-live" });
    const committed = table.advance(session.sessionId, 0, face("b"));
    expect(committed).toMatchObject({ ok: true, session: { generation: 1, face: face("b"), state: "live" } });
    // A committed switch spends its generation: the same commit asked again finds a live session and changes nothing.
    expect(table.advance(session.sessionId, 0, face("c"))).toEqual({ ok: false, refusal: "session-not-switching" });
    expect(table.check(envelope(session.sessionId, "epoch-a", 1), binding)).toMatchObject({ ok: true, session: { generation: 1, face: face("b") } });
  });

  test("face types and runtime validation exclude roots and byte subjects", () => {
    const lawful: SessionFace = face();
    expect(validateSessionFace(lawful)).not.toBeNull();
    const rooted: SessionFace = {
      ...face(),
      // @ts-expect-error root material is not part of a session face
      root: "synthetic-root",
    };
    expect(validateSessionFace(rooted)).toBeNull();
    const seeded: SessionFace = {
      ...face(),
      // @ts-expect-error seed material is not part of a session face
      seed: "synthetic-seed",
    };
    expect(validateSessionFace(seeded)).toBeNull();
    expect(validateSessionFace({ ...face(), proofSubject: new Uint8Array([1]) })).toBeNull();
    expect(validateSessionFace({ ...face(), planes: { ...face().planes, root: "synthetic-root" } })).toBeNull();
    expect(validateSessionFace({ ...face(), admitRef: "" })).toBeNull();
    // A session opens on no such face, and what a lawful open hands back carries exactly the face's own keys.
    const table = new SessionTable("epoch-a");
    expect(table.open(sessionBinding("port"), rooted, "face")).toEqual({ ok: false, refusal: "face-malformed" });
    expect(table.size).toBe(0);
    const session = opened(table);
    expect(Object.keys(session.face).sort()).toEqual(["admitRef", "causalRevision", "personaGroup", "planes", "proofSubject"]);
    expect(Object.isFrozen(session) && Object.isFrozen(session.face) && Object.isFrozen(session.face.planes)).toBe(true);
  });

  test("close drops routing and releases the binding without retaining the id", () => {
    let next = 0;
    const table = new SessionTable("epoch-a", () => `session-${++next}`);
    const binding = sessionBinding("socket");
    const first = opened(table, binding);
    expect(table.close(first.sessionId)).toBe(true);
    expect(table.check(envelope(first.sessionId), binding)).toEqual({ ok: false, refusal: "unknown-session" });
    expect(table.size).toBe(0);
    const second = opened(table, binding);
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(JSON.stringify(table)).not.toContain(first.sessionId);
    // The table offers no roster: nothing enumerable holds a live session's id or its face either.
    expect(JSON.stringify(table)).not.toContain(second.sessionId);
    expect(JSON.stringify(table)).not.toContain(second.face.personaGroup);
    expect(Object.keys(table)).toEqual([]);
    expect(JSON.stringify(second)).toContain(second.sessionId);   // KNOWN POSITIVE: the probe sees an id where one rides
    expect(table.close(first.sessionId)).toBe(false);
  });

  test("refusal order picks the first applicable condition", () => {
    const table = new SessionTable("epoch-a", () => "session-a");
    const binding = sessionBinding("port");
    const other = sessionBinding("port");
    const session = opened(table, binding);
    expect(table.check({ ...envelope(session.sessionId), ownerEpoch: "" }, other)).toMatchObject({ refusal: "malformed-message" });
    expect(table.check(envelope("absent", "epoch-b"), other)).toMatchObject({ refusal: "stale-owner-epoch" });
    expect(table.check(envelope("absent"), other)).toMatchObject({ refusal: "unknown-session" });
    expect(table.check(envelope(session.sessionId, "epoch-a", 1), other)).toMatchObject({ refusal: "unbound-session" });
    expect(table.check(envelope(session.sessionId, "epoch-a", 1), binding)).toMatchObject({ refusal: "stale-generation" });
    table.transition(session.sessionId, "switching");
    expect(table.check(envelope(session.sessionId), binding)).toMatchObject({ refusal: "session-not-live" });
  });

  test("every ordered state pair follows the transition law", () => {
    const states: SessionState[] = ["opening", "live", "switching", "revoked", "closing", "closed"];
    const legal: Readonly<Record<SessionState, readonly SessionState[]>> = {
      opening: ["live", "closing", "closed"], live: ["switching", "revoked", "closing"],
      switching: ["live", "revoked", "closing"], revoked: ["closing", "closed"],
      closing: ["closed"], closed: [],
    };
    for (const from of states) for (const to of states) {
      expect(sessionTransitionLegal(from, to)).toBe(legal[from].includes(to));
      if (from === "live" || from === "switching" || from === "revoked" || from === "closing") {
        const table = new SessionTable("epoch-a", () => "session-a");
        opened(table);
        const setup: Readonly<Record<SessionState, readonly SessionState[]>> = {
          opening: [], live: [], switching: ["switching"], revoked: ["revoked"],
          closing: ["closing"], closed: [],
        };
        for (const step of setup[from]) table.transition("session-a", step);
        if (legal[from].includes(to)) expect(() => table.transition("session-a", to)).not.toThrow();
        else expect(() => table.transition("session-a", to)).toThrow(new RegExp(`illegal-session-transition: ${from} -> ${to}`));
        if (to === "closed" && legal[from].includes(to)) expect(table.size).toBe(0);
      }
    }
  });

  test("a minted id never repeats within one table", () => {
    const ids = ["session-a", "session-a", "session-b"];
    const table = new SessionTable("epoch-a", () => ids.shift() ?? "session-z");
    expect(opened(table).sessionId).toBe("session-a");
    expect(opened(table).sessionId).toBe("session-b");
    const stuck = new SessionTable("epoch-a", () => "session-a");
    opened(stuck);
    expect(() => stuck.open(sessionBinding("port"), face(), "face")).toThrow(SessionContractError);
    expect(stuck.size).toBe(1);
    const a = opened(new SessionTable("epoch-a")), b = opened(new SessionTable("epoch-a"));
    expect(a.sessionId).not.toBe(b.sessionId);
  });

  test("★ a closed id never routes again: an envelope kept from a closed session opens nothing ★", () => {
    // A mint that repeats itself: the id of a session that closed comes back for the next open.
    const ids = ["session-a", "session-a", "session-b"];
    const table = new SessionTable("epoch-a", () => ids.shift() ?? "session-z");
    const binding = sessionBinding("socket");
    const first = opened(table, binding);
    const kept = envelope(first.sessionId);                                  // generation 0, as a fresh session reads
    expect(table.check(kept, binding).ok).toBe(true);                        // CONTROL: live, it routes
    table.close(first.sessionId);
    const second = opened(table, binding, face("b"));                        // the SAME binding, another face
    expect(second.sessionId).toBe("session-b");
    expect(table.check(kept, binding)).toEqual({ ok: false, refusal: "unknown-session" });
    expect(table.check(envelope(second.sessionId), binding)).toMatchObject({ ok: true, session: { face: face("b") } });
    // What the table keeps of a closed session is its id alone: no face, no binding, nothing a caller can read.
    expect(table.size).toBe(1);
    expect(JSON.stringify(table)).toBe("{}");
  });

  test("a guard never throws at a hostile object", () => {
    const thrower = new Proxy({}, { ownKeys() { throw new Error("hostile"); }, get() { throw new Error("hostile"); } });
    const getter = { ...face(), get proofSubject(): string { throw new Error("hostile"); } };
    const table = new SessionTable("epoch-a");
    for (const hostile of [thrower, getter]) {
      expect(validateSessionFace(hostile)).toBeNull();
      expect(validateSessionEnvelope(hostile)).toBeNull();
      expect(table.open(sessionBinding("port"), hostile, "face")).toEqual({ ok: false, refusal: "face-malformed" });
      expect(table.check(hostile, sessionBinding("port"))).toEqual({ ok: false, refusal: "malformed-message" });
    }
    // A face whose getter answers lawfully gets COPIED by value: what the session wears never re-reads its source.
    let reads = 0;
    const shifting = { ...face(), get admitRef(): string { reads++; return reads === 1 ? "admit-first" : "admit-later"; } };
    const worn = validateSessionFace(shifting);
    expect(worn?.admitRef).toBe("admit-first");
    expect(worn?.admitRef).toBe("admit-first");
    expect(table.size).toBe(0);
  });

  test("hands differ by profile: the owner names one at the open, and a switch of face keeps it", () => {
    // Every hand the law names carries a profile the law names, and no two hands share one.
    expect(Object.keys(HAND_PROFILES).sort()).toEqual(["cli", "seat", "tab", "watcher"]);
    expect([...new Set(Object.values(HAND_PROFILES))].sort()).toEqual([...CAPABILITY_PROFILES].sort());
    const table = new SessionTable("epoch-a", (() => { let id = 0; return () => `session-${++id}`; })());
    for (const profile of CAPABILITY_PROFILES) {
      const result = table.open(sessionBinding("socket"), face(), profile);
      expect(result).toMatchObject({ ok: true, session: { profile } });
    }
    // A profile the law does not name opens nothing: a nonsense word, an absent one, an object, a wider-sounding one.
    for (const unknown of ["root", "", undefined, null, { profile: "face" }, "face ", "FACE"]) {
      expect(isCapabilityProfile(unknown)).toBe(false);
      expect(table.open(sessionBinding("socket"), face(), unknown)).toEqual({ ok: false, refusal: "profile-unknown" });
    }
    expect(table.size).toBe(CAPABILITY_PROFILES.length);
    // A seat that switches its face stays a seat.
    const seat = table.open(sessionBinding("socket"), face("a"), HAND_PROFILES.seat);
    if (!seat.ok) throw new Error(seat.refusal);
    table.transition(seat.session.sessionId, "switching");
    expect(table.advance(seat.session.sessionId, 0, face("b"))).toMatchObject({ ok: true, session: { profile: "seat", generation: 1, face: face("b") } });
    // A verb beyond a profile refuses by a name that carries both.
    expect(refuseBeyondProfile("seat", "write")).toEqual({ ok: false, refusal: "beyond-profile", profile: "seat", verb: "write" });
  });

  test("one binding holds one session and can reopen after close", () => {
    const table = new SessionTable("epoch-a", (() => { let id = 0; return () => `session-${++id}`; })());
    const binding = sessionBinding("port");
    const first = opened(table, binding);
    expect(table.open(binding, face("b"), "face")).toEqual({ ok: false, refusal: "binding-already-bound" });
    table.close(first.sessionId);
    expect(table.open(binding, face("b"), "face").ok).toBe(true);
  });

  test.each(["switching", "revoked", "closing"] as const)("check refuses %s sessions", (state) => {
    const table = new SessionTable("epoch-a", () => "session-a");
    const binding = sessionBinding("port");
    const session = opened(table, binding);
    table.transition(session.sessionId, state);
    expect(table.check(envelope(session.sessionId), binding)).toEqual({ ok: false, refusal: "session-not-live" });
  });

  test("envelope validator accepts only a lawful envelope", () => {
    const lawful = envelope("session-a");
    expect(validateSessionEnvelope(lawful)).toEqual(lawful);
    for (const invalid of [
      { ...lawful, ownerEpoch: "" }, { ...lawful, generation: -1 }, { ...lawful, generation: 0.5 },
      { ...lawful, generation: "0" }, { ...lawful, sessionId: "" },
    ]) expect(validateSessionEnvelope(invalid)).toBeNull();
  });

  // "A pure library names its caller. A module built ahead of its consumer stays out of the package barrel until the
  // commit that consumes it" (stable-founding-road, the rulings). The node's dial consumes the table and the binding a
  // session opens on (`open-node-vessel`, `dialSessions`); the barrel names those three and no other part of the contract.
  test("the public barrel names only the session table and binding its dialer consumes", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const barrel = readFileSync(resolve(here, "../src/index.ts"), "utf8");
    expect(barrel).toContain("island-protocol");
    const named = [...barrel.matchAll(/^export (?:type )?\{([^}]*)\} from "\.\/session-contract\.js";$/gm)].flatMap((m) => m[1]!.split(",").map((n) => n.trim()).filter(Boolean));
    expect(named.sort()).toEqual(["SessionBinding", "SessionTable", "sessionBinding"]);
    expect(barrel.match(/session-contract/g)?.length).toBe(2);
    const caller = readFileSync(resolve(here, "../../lararium-node/src/open-node-vessel.ts"), "utf8");
    expect(caller).toMatch(/\bSessionTable, sessionBinding\b[^;]*from "@lararium\/mesh"/);
  });

  test("session source has no clock, timer, or platform imports", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(here, "../src/session-contract.ts"), "utf8");
    expect(source).not.toMatch(/\bDate\b/);
    expect(source).not.toMatch(/performance\./);
    expect(source).not.toMatch(/setTimeout|setInterval/);
    expect(source).not.toMatch(/node:/);
    const knownDateSource = readFileSync(resolve(here, "../src/tiddler-store.ts"), "utf8");
    expect(knownDateSource).toMatch(/\bDate\b/);
  });
});

