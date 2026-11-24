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
 *   C5  a hand act: an AI seat refuses `hand-act-only`; a frame beside its three keys refuses whole; under a pūlama it refuses.
 */
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { describe, expect, test } from "vitest";
import type { Credential } from "@lararium/mesh";
import { custodyFrameHandler } from "../src/custody-frames.js";
import type { CustodyHolder } from "../src/custody-holder.js";

const ROUTE = "recard-frame-vessel-route";
const STALE = "Error: face 0xabc refused: FaceHoldsNoPrekeySecret: [daemon-keyhive] face abc… holds no prekey secret: its Archive was absent or older than its latest card";

function door(opts: { faces?: Record<number, { unlocked: boolean }>; refused?: Array<{ ordinal: number; cause: string }>; proves?: boolean;
  staysDark?: boolean; lightThrows?: boolean; lightHeld?: boolean; peer?: "ai" | "hand" | "unknown"; pulama?: boolean } = {}) {
  const armed: number[] = [];
  const disarmed: number[] = [];
  const lit: number[] = [];
  const proved: Array<readonly Credential[]> = [];
  const logs: string[] = [];
  let refused = opts.refused ?? [{ ordinal: 2, cause: STALE }];
  const holder = {
    isUnlocked: () => true,
    faceStanding: async ({ ordinal }: { ordinal: number }) => {
      const f = (opts.faces ?? { 2: { unlocked: true } })[ordinal];
      return f ? { ordinal, fcid: `${ordinal}`.padStart(32, "0"), group: null, ask: null, unlocked: f.unlocked } : null;
    },
    proves: async (credentials: readonly Credential[]) => { proved.push(credentials); return opts.proves === false ? { reading: "no-slot-opens", attemptsLeft: 4 } : { reading: "proves", opener: [] }; },
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
      if (opts.lightHeld) return;
      if (!opts.staysDark) refused = refused.filter((r) => r.ordinal !== ordinal);
      else refused = refused.map((r) => ({ ...r, cause: "FaceRecardRefused: [daemon-keyhive] recard refused (archive-unrested): no row took it" }));
    },
    disarmRecard: (ordinal: number) => { disarmed.push(ordinal); },
    replayLend: async () => { throw new Error("the recard lights its own face, never the whole lend"); },
    peerOf: async () => opts.peer ?? "hand",
    ...(opts.pulama ? { pulama: { standing: () => ({ session: true, waits: null }), dial: async () => ({ session: true, waits: null }), lent: () => [0, 2], tellWorn: async () => {} } } : {}),
  });
  const send = (frame: unknown): Promise<Record<string, unknown>> => new Promise((resolve) => {
    const sock = Object.assign(new EventEmitter(), { end: (line: string) => resolve(JSON.parse(line) as Record<string, unknown>) }) as unknown as Socket;
    handle(frame, sock);
  });
  return { send, armed, disarmed, lit, proved, logs };
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
    expect(await held.send(frame(2))).toMatchObject({ refusal: { reason: "recard-refused" } });
    expect(held.disarmed).toEqual([2]);
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
    expect(await pulama.send(frame(2))).toMatchObject({ refusal: { reason: "recard-under-pulama" } });
    for (const d of [ai, stray, pulama]) { expect(d.armed).toEqual([]); expect(d.proved).toEqual([]); }
  });
});
