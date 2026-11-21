/**
 * The custody door's `rehive` frame: a SHUT face stands its hive again from its own seed (`face-rehive`).
 *
 *   E1  a shut face's rehive runs with the face and its own route, answers the outcome, and the door logs no route.
 *   E2  a face that stands open (its key open in the holder) or worn refuses `face-open`, and nothing runs.
 *   E3  a locked vessel refuses `custody-locked`; a face that stands nowhere refuses `face-not-standing`; nothing runs.
 *   E4  a frame beside its three keys, or with no usable route, refuses whole before anything runs.
 *   E5  a rehive that refuses answers its own reason; a door with no rehive wired refuses `rehive-unavailable`.
 *   E6  A HAND ACT: a frame whose peer reads as an AI seat refuses `hand-act-only` before any route reaches the holder.
 *   E7  under a pūlama (the face's custody rests with it, and it lights faces on its own hand) the rehive refuses
 *       `rehive-under-pulama`, and nothing runs.
 */
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import type { Credential } from "@lararium/mesh";
import { custodyFrameHandler } from "../src/custody-frames.js";
import type { CustodyHolder } from "../src/custody-holder.js";
import { RehiveRefused, type RehiveOutcome } from "../src/face-rehive.js";
import { mountedFaceOrdinal, setMountedFace } from "../src/node-vessel-identity.js";

const ROUTE = "rehive-frame-face-route";
const OUTCOME: RehiveOutcome = { outcome: "stood-from-seed", foreignIdentity: "4719534d".padEnd(20, "0"), ownIdentity: "1a2b3c4d".padEnd(20, "0"), aside: `veil-archive-g${"a".repeat(64)}.bin.mismatch-${"c".repeat(16)}` };
const priorMount = mountedFaceOrdinal();
afterEach(() => { setMountedFace(priorMount); });

function door(opts: { unlocked?: boolean; faces?: Record<number, { unlocked: boolean }>; rehive?: ((face: number, credentials: readonly Credential[]) => Promise<RehiveOutcome>) | null; peer?: "ai" | null; pulama?: boolean } = {}) {
  const asked: Array<{ face: number; credentials: readonly Credential[] }> = [];
  const logs: string[] = [];
  const holder = {
    isUnlocked: () => opts.unlocked ?? true,
    faceStanding: async ({ ordinal }: { ordinal: number }) => {
      const f = (opts.faces ?? { 1: { unlocked: false } })[ordinal];
      return f ? { fcid: `${ordinal}`.padStart(32, "0"), unlocked: f.unlocked } : null;
    },
  } as unknown as CustodyHolder;
  const rehive = opts.rehive === null ? undefined : (opts.rehive ?? (async (face: number, credentials: readonly Credential[]) => { asked.push({ face, credentials }); return OUTCOME; }));
  const handle = custodyFrameHandler({
    holder, testScratch: false, standing: () => "hearth", recompose: async () => ({ standing: "hearth" }), onLog: (l) => logs.push(l),
    ...(rehive ? { rehive } : {}),
    peerOf: async () => opts.peer ?? null,
    ...(opts.pulama ? { pulama: { standing: () => ({ session: true, waits: null }), dial: async () => ({ session: true, waits: null }), lent: () => [0, 1], tellWorn: async () => {} } } : {}),
  });
  const send = (frame: unknown): Promise<Record<string, unknown>> => new Promise((resolve) => {
    const sock = Object.assign(new EventEmitter(), { end: (line: string) => resolve(JSON.parse(line) as Record<string, unknown>) }) as unknown as Socket;
    handle(frame, sock);
  });
  return { send, asked, logs };
}
const frame = (face: number, over: Record<string, unknown> = {}) => ({ op: "rehive", credentials: [{ kind: "passphrase", passphrase: ROUTE }], face, ...over });

describe("the custody door's rehive frame", () => {
  test("E1 a shut face rehives under its own route; the door logs no route", async () => {
    setMountedFace(0);
    const d = door();
    expect(await d.send(frame(1))).toEqual({ op: "rehive", face: 1, ...OUTCOME });
    expect(d.asked).toEqual([{ face: 1, credentials: [{ kind: "passphrase", passphrase: ROUTE }] }]);
    expect(d.logs.join("\n")).toContain("rehive h1: stood-from-seed");
    expect(d.logs.join("\n")).not.toContain(ROUTE);
  });

  test("E2 a face open in the holder, or worn, refuses face-open and nothing runs", async () => {
    setMountedFace(0);
    const lit = door({ faces: { 1: { unlocked: true } } });
    expect(await lit.send(frame(1))).toMatchObject({ op: "rehive", status: "error", refusal: { reason: "face-open" } });
    expect(lit.asked).toEqual([]);
    setMountedFace(1);
    const worn = door({ faces: { 1: { unlocked: false } } });
    expect(await worn.send(frame(1))).toMatchObject({ refusal: { reason: "face-open" } });
    expect(worn.asked).toEqual([]);
  });

  test("E3 a locked vessel and a face standing nowhere refuse, and nothing runs", async () => {
    setMountedFace(0);
    const locked = door({ unlocked: false });
    expect(await locked.send(frame(1))).toMatchObject({ refusal: { reason: "custody-locked" } });
    const nowhere = door();
    expect(await nowhere.send(frame(7))).toMatchObject({ refusal: { reason: "face-not-standing" } });
    expect([...locked.asked, ...nowhere.asked]).toEqual([]);
  });

  test("E4 a frame beside its keys, or with no route, refuses whole", async () => {
    const d = door();
    expect(await d.send(frame(1, { key: "x" }))).toMatchObject({ refusal: { reason: "bad-custody-frame" } });
    expect(await d.send({ op: "rehive", face: 1 })).toMatchObject({ refusal: { reason: "bad-custody-frame" } });
    expect(await d.send(frame(-1))).toMatchObject({ refusal: { reason: "bad-custody-frame" } });
    expect(d.asked).toEqual([]);
  });

  test("E5 a refusing rehive answers its reason; an unwired door refuses rehive-unavailable", async () => {
    setMountedFace(0);
    const refusing = door({ rehive: async () => { throw new RehiveRefused("row-is-own", "nothing to rehive"); } });
    expect(await refusing.send(frame(1))).toMatchObject({ refusal: { reason: "row-is-own" }, errorMessage: "nothing to rehive" });
    expect(await door({ rehive: null }).send(frame(1))).toMatchObject({ refusal: { reason: "rehive-unavailable" } });
  });

  test("E6 an AI seat's peer refuses hand-act-only, and no route reaches the rehive", async () => {
    setMountedFace(0);
    const d = door({ peer: "ai" });
    expect(await d.send(frame(1))).toMatchObject({ op: "rehive", status: "error", refusal: { reason: "hand-act-only" } });
    expect(d.asked).toEqual([]);
  });

  test("E7 under a pūlama the rehive refuses rehive-under-pulama, and nothing runs", async () => {
    setMountedFace(0);
    const d = door({ pulama: true });
    expect(await d.send(frame(1))).toMatchObject({ refusal: { reason: "rehive-under-pulama" } });
    expect(d.asked).toEqual([]);
  });
});
