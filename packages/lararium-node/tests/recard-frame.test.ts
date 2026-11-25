/**
 * The custody door's `recard` frame: a face served here and dark for want of a prekey secret lights again under its own
 * identity (`face-recard`).
 *
 *   C1  a face whose last light refused `FaceHoldsNoPrekeySecret` recards: the vessel's route proves, the door arms its next light
 *       and awaits THAT light's settling, then reads the refusals; it answers `recarded` once the face lights; the door logs no route.
 *   C2  A HEALTHY FACE REFUSES: lit (no refused light), dark for another cause, or shut refuses before any route is read or any
 *       light is armed.
 *   C3  a route that opens no slot refuses `no-slot-opens` and arms nothing.
 *   C4  a recarded face that stays dark refuses `recard-refused` with its cause, though its light settles on a later tick.
 *   C6  the arm never outlives the act: a light that throws, or one that refuses without taking the arm, leaves nothing armed.
 *   C7  a face whose recard refused for its Archive stays a stale face: a direct recard arms again.
 *   C5  a hand act: an AI seat refuses `hand-act-only`; a frame beside its three keys refuses whole; under a pūlama with no grant
 *       standing it refuses `recard-ungranted`, naming the pūlama's runnable recard.
 *   C9  UNDER A PŪLAMA the face's own route proves at the pūlama's hand door, where its key rests: the vessel's frame carries no
 *       route, the guard reads first, and the door spends the pūlama's one grant before it arms; a frame carrying a route refuses.
 */
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { describe, expect, test } from "vitest";
import type { Credential } from "@lararium/mesh";
import { custodyFrameHandler } from "../src/custody-frames.js";
import type { CustodyHolder } from "../src/custody-holder.js";

const ROUTE = "recard-frame-face-route";
const VESSEL_ROUTE = "recard-frame-vessel-route";
const STALE = "Error: face 0xabc refused: FaceHoldsNoPrekeySecret: [daemon-keyhive] face abc… holds no prekey secret: its Archive was absent or older than its latest card";

function door(opts: { faces?: Record<number, { unlocked: boolean }>; refused?: Array<{ ordinal: number; cause: string; heldSaves?: number }>; proves?: boolean;
  staysDark?: boolean; lightThrows?: boolean; lightHeld?: boolean; armUntaken?: boolean; peer?: "ai" | "hand" | "unknown"; pulama?: boolean; granted?: boolean } = {}) {
  const armed: number[] = [];
  const disarmed: number[] = [];
  let taken = false;
  const lit: number[] = [];
  const proved: Array<readonly Credential[]> = [];
  const vesselProved: Array<readonly Credential[]> = [];
  const whileOpen: boolean[] = [];
  const logs: string[] = [];
  const spent: number[] = [];
  let grant = opts.granted === true;
  let refused = opts.refused ?? [{ ordinal: 2, cause: STALE }];
  const holder = {
    isUnlocked: () => true,
    faceStanding: async ({ ordinal }: { ordinal: number }) => {
      const f = (opts.faces ?? { 2: { unlocked: true } })[ordinal];
      return f ? { ordinal, fcid: `${ordinal}`.padStart(32, "0"), group: null, ask: null, unlocked: f.unlocked } : null;
    },
    // THE VESSEL'S ROUTE OPENS THE VESSEL'S TREE, the face's route its own: the recard asks the face's, as the rehive does.
    proves: async (credentials: readonly Credential[]) => { vesselProved.push(credentials); return { reading: "proves", opener: [] }; },
    openFaceForAct: async ({ ordinal }: { ordinal: number }, credentials: readonly Credential[], act?: { whileOpen?: boolean }) => {
      proved.push(credentials); whileOpen.push(act?.whileOpen === true);
      const route = credentials.some((c) => c.kind === "passphrase" && c.passphrase === ROUTE);
      return route && opts.proves !== false
        ? { reading: "opens", fcid: `${ordinal}`.padStart(32, "0"), ordinal, groupDigest: null, fck: new Uint8Array(32).fill(7) }
        : { reading: "no-slot-opens", fcid: `${ordinal}`.padStart(32, "0"), attemptsLeft: 4 };
    },
  } as unknown as CustodyHolder;
  const handle = custodyFrameHandler({
    holder, testScratch: false, standing: () => "hearth", recompose: async () => ({ standing: "hearth" }), onLog: (l) => logs.push(l),
    refusedLights: () => refused,
    armRecard: (ordinal) => { armed.push(ordinal); },
    // THE LIGHT SETTLES ON A LATER TICK, as the face's actor does: a door that does not await THIS light reads the refusals too early.
    lightFace: async (ordinal: number) => {
      lit.push(ordinal);
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (opts.lightThrows) throw new Error("composition unavailable");
      // THE REAL HELD CASE: a lock ran ahead, the actor answers refused at once, and the refusal list leaves a held face out.
      if (opts.lightHeld) { refused = refused.filter((r) => r.ordinal !== ordinal); return "refused" as const; }
      taken = opts.armUntaken !== true;
      if (!opts.staysDark) refused = refused.filter((r) => r.ordinal !== ordinal);
      else refused = refused.map((r) => ({ ...r, cause: "FaceRecardRefused: [daemon-keyhive] recard refused (archive-unrested): no row took it" }));
      return opts.staysDark ? "refused" as const : "lit" as const;
    },
    disarmRecard: (ordinal: number) => { disarmed.push(ordinal); return !taken; },
    replayLend: async () => { throw new Error("the recard lights its own face, never the whole lend"); },
    peerOf: async () => opts.peer ?? "hand",
    ...(opts.pulama ? { pulama: { standing: () => ({ session: true, waits: null }), dial: async () => ({ session: true, waits: null }), lent: () => [0, 2], tellWorn: async () => {},
      takeRecard: async (ordinal: number) => { spent.push(ordinal); const had = grant; grant = false; return had; } } } : {}),
  });
  const send = (frame: unknown): Promise<Record<string, unknown>> => new Promise((resolve) => {
    const sock = Object.assign(new EventEmitter(), { end: (line: string) => resolve(JSON.parse(line) as Record<string, unknown>) }) as unknown as Socket;
    handle(frame, sock);
  });
  return { send, armed, disarmed, lit, proved, vesselProved, whileOpen, logs, spent };
}
const frame = (face: number, over: Record<string, unknown> = {}) => ({ op: "recard", credentials: [{ kind: "passphrase", passphrase: ROUTE }], face, ...over });

describe("the custody door's recard frame", () => {
  test("C1 a stale face recards: the route proves, its next light arms, and it lights; the door logs no route", async () => {
    const d = door();
    expect(await d.send(frame(2))).toEqual({ op: "recard", face: 2, recarded: true });
    expect(d.armed).toEqual([2]);
    expect(d.lit).toEqual([2]);
    expect(d.disarmed).toEqual([2]);
    expect(d.proved).toHaveLength(1);
    expect(d.logs.join("\n")).toContain("recard h2: lit");
    expect(d.logs.join("\n")).not.toContain(ROUTE);
  });

  test("C2 a healthy face refuses before any route is read or any light armed: lit, dark for another cause, shut, or absent", async () => {
    const lit = door({ refused: [] });
    const a = await lit.send(frame(2));
    expect(a).toMatchObject({ op: "recard", status: "error", refusal: { reason: "face-not-stale" } });
    expect(String(a["errorMessage"])).toContain("lares vault status");
    const other = door({ refused: [{ ordinal: 2, cause: "the edge reads aside" }] });
    expect(await other.send(frame(2))).toMatchObject({ refusal: { reason: "face-not-stale" } });
    // THE GUARD READS THE REFUSAL'S NAME, never its prose: another refusal that quotes the words reads not stale.
    const prose = door({ refused: [{ ordinal: 2, cause: "Error: face 0xabc refused: SomeOtherRefusal: it holds no prekey secret, it says" }] });
    expect(await prose.send(frame(2))).toMatchObject({ refusal: { reason: "face-not-stale" } });
    const shut = door({ faces: { 2: { unlocked: false } }, refused: [] });
    const b = await shut.send(frame(2));
    expect(b).toMatchObject({ refusal: { reason: "face-shut" } });
    expect(String(b["errorMessage"])).toContain("lares vault unlock --face 2");
    const absent = door({ faces: {} });
    expect(await absent.send(frame(2))).toMatchObject({ refusal: { reason: "face-not-standing" } });
    for (const d of [lit, other, prose, shut, absent]) { expect(d.armed).toEqual([]); expect(d.proved).toEqual([]); }
  });

  test("C3 a route that opens no slot refuses and arms nothing", async () => {
    const d = door({ proves: false });
    expect(await d.send(frame(2))).toMatchObject({ refusal: { reason: "no-slot-opens", attemptsLeft: 4 } });
    expect(d.armed).toEqual([]);
  });

  test("C8 THE FACE'S ROUTE GATES, as the rehive's: the vessel's route refuses and arms nothing; the face's lands, one prover", async () => {
    const d = door();
    const vessel = await d.send(frame(2, { credentials: [{ kind: "passphrase", passphrase: VESSEL_ROUTE }] }));
    expect(vessel).toMatchObject({ op: "recard", status: "error", refusal: { reason: "no-slot-opens", attemptsLeft: 4 } });
    expect(String(vessel["errorMessage"])).toContain("face h2");
    expect(d.armed).toEqual([]);
    expect(await d.send(frame(2))).toEqual({ op: "recard", face: 2, recarded: true });
    expect(d.armed).toEqual([2]);
    // The proof rides the holder's per-face opening for an act (open face allowed), never the vessel's own `proves`.
    expect(d.whileOpen).toEqual([true, true]);
    expect(d.vesselProved).toEqual([]);
  });

  test("C4 a recarded face that stays dark refuses with its cause", async () => {
    const d = door({ staysDark: true });
    const a = await d.send(frame(2));
    expect(a).toMatchObject({ refusal: { reason: "recard-refused" } });
    expect(String(a["errorMessage"])).toContain("archive-unrested");
    expect(String(a["errorMessage"])).toContain("lares vault recard --face 2");
  });

  test("C6 the arm never outlives the act: a light that throws, or a stale face whose light refuses unread, leaves nothing armed", async () => {
    const throws = door({ lightThrows: true });
    expect(await throws.send(frame(2))).toMatchObject({ refusal: { reason: "recard-failed" } });
    expect(throws.disarmed).toEqual([2]);
    const held = door({ lightHeld: true });
    const heldAnswer = await held.send(frame(2));
    expect(heldAnswer).toMatchObject({ refusal: { reason: "recard-refused" } });
    expect(heldAnswer).not.toHaveProperty("recarded");
    expect(String(heldAnswer["errorMessage"])).toContain("untaken");
    expect(held.disarmed).toEqual([2]);
    // A light that ran before the door armed leaves the arm untaken: the answer names it.
    const early = door({ staysDark: true, lightHeld: false, armUntaken: true });
    expect(String((await early.send(frame(2)))["errorMessage"])).toContain("untaken");
  });

  test("C7 a face whose recard refused for its Archive still reads stale: a direct recard arms again", async () => {
    for (const reason of ["archive-unrested", "archive-unrouted"]) {
      const d = door({ refused: [{ ordinal: 2, cause: `FaceRecardRefused: [daemon-keyhive] recard refused (${reason}): the Archive did not rest` }] });
      expect(await d.send(frame(2))).toEqual({ op: "recard", face: 2, recarded: true });
      expect(d.armed).toEqual([2]);
    }
    const still = door({ refused: [{ ordinal: 2, cause: "FaceRecardRefused: [daemon-keyhive] recard refused (still-refuses): held no prekey secret" }] });
    expect(await still.send(frame(2))).toMatchObject({ refusal: { reason: "face-not-stale" } });
  });

  test("C5 an AI seat, a stray key and a pūlama each refuse, and nothing arms", async () => {
    const ai = door({ peer: "ai" });
    expect(await ai.send(frame(2))).toMatchObject({ refusal: { reason: "hand-act-only" } });
    const stray = door();
    expect(await stray.send(frame(2, { yes: true }))).toMatchObject({ refusal: { reason: "bad-custody-frame" } });
    const pulama = door({ pulama: true });
    const ungranted = await pulama.send(frame(2, { credentials: [] }));
    expect(ungranted).toMatchObject({ refusal: { reason: "recard-ungranted" } });
    expect(String(ungranted["errorMessage"])).toContain("tools/lares-container.sh pulama recard 2");
    expect(String(ungranted["errorMessage"])).toContain("lares vault recard --face 2");
    for (const d of [ai, stray, pulama]) { expect(d.armed).toEqual([]); expect(d.proved).toEqual([]); }
  });

  test("C8b a refused face that holds waiting saves still reads stale: the guard reads the refusal's name, and the recard arms and lights", async () => {
    const d = door({ pulama: true, granted: true, refused: [{ ordinal: 2, cause: "FaceHoldsNoPrekeySecret: [daemon-keyhive] face abc… holds no prekey secret", heldSaves: 1 }] });
    expect(await d.send(frame(2, { credentials: [] }))).toEqual({ op: "recard", face: 2, recarded: true });
    expect(d.armed).toEqual([2]);
    expect(d.lit).toEqual([2]);
  });

  test("C9 under a pūlama the guard reads first, the pūlama's grant spends once, and the face lights; a route in the frame refuses", async () => {
    const d = door({ pulama: true, granted: true });
    expect(await d.send(frame(2, { credentials: [] }))).toEqual({ op: "recard", face: 2, recarded: true });
    expect(d.spent).toEqual([2]);
    expect(d.armed).toEqual([2]);
    expect(d.lit).toEqual([2]);
    expect(d.disarmed).toEqual([2]);
    expect(d.proved, "the vessel opens no face key under a pūlama").toEqual([]);
    // THE GUARD READS BEFORE THE GRANT SPENDS: a face that needs no recard leaves the pūlama's grant standing.
    const healthy = door({ pulama: true, granted: true, refused: [] });
    expect(await healthy.send(frame(2, { credentials: [] }))).toMatchObject({ refusal: { reason: "face-not-stale" } });
    expect(healthy.spent).toEqual([]);
    // A ROUTE NEVER RIDES TO A VESSEL UNDER A PŪLAMA: the frame that carries one refuses whole, and nothing spends.
    const routed = door({ pulama: true, granted: true });
    const r = await routed.send(frame(2));
    expect(r).toMatchObject({ refusal: { reason: "route-at-the-pulama" } });
    expect(String(r["errorMessage"])).toContain("tools/lares-container.sh pulama recard 2");
    expect(routed.spent).toEqual([]);
    expect(routed.armed).toEqual([]);
    expect(routed.logs.join("\n")).not.toContain(ROUTE);
    // A vessel off the pūlama's frame still asks the face's route: an empty one refuses whole.
    expect(await door().send(frame(2, { credentials: [] }))).toMatchObject({ refusal: { reason: "bad-custody-frame" } });
  });
});
