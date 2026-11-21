import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { afterEach, expect, test, vi } from "vitest";
import { custodyFrameHandler } from "../src/custody-frames.js";
import { setMountedFace } from "../src/node-vessel-identity.js";
import type { CustodyHolder } from "../src/custody-holder.js";

function harness() {
  const open = new Set(["0"]);
  const holder = {
    unlock: async () => ({ reading: "already-unlocked" }),
    unlockFace: async ({ ordinal }: { ordinal: number }) => { open.add(String(ordinal)); return { reading: "opens", ordinal }; },
    unlockFaces: async () => { open.add("1"); return [{ reading: "opens", ordinal: 1 }]; },
    unlockedFaces: () => [...open],
    faceStanding: async ({ ordinal }: { ordinal: number }) => ({ ordinal, fcid: String(ordinal), unlocked: open.has(String(ordinal)) }),
    lockFace: async (fcid: string) => { open.delete(fcid); },
    // Every face here LANDED: its anchors row stands, so each may take the mount.
    readRecord: async () => ({ reading: "opens", plaintext: new Uint8Array() }),
  } as unknown as CustodyHolder;
  const lightFace = vi.fn(async (_ordinal: number) => {});
  const dropFace = vi.fn(async (_ordinal: number) => {});
  const recompose = vi.fn(async () => ({ standing: "hearth" }));
  const releaseFace = vi.fn((_ordinal: number) => {});
  const closeFaces = vi.fn(async () => {});
  const order: string[] = [];
  const lockFace = holder.lockFace.bind(holder);
  (holder as { lockFace: (fcid: string) => Promise<void> }).lockFace = async (fcid) => { order.push(`lockFace ${fcid}`); await lockFace(fcid); };
  const lock = vi.fn(async () => { order.push("lock"); });
  (holder as unknown as { lock: () => Promise<void>; isUnlocked: () => boolean }).lock = lock;
  (holder as unknown as { isUnlocked: () => boolean }).isUnlocked = () => true;
  const handle = custodyFrameHandler({ holder, lightFace, dropFace, releaseFace, closeFaces, recompose, standing: () => "hearth", onLog: () => {}, testScratch: false,
    runAct: async () => ({ ran: true }) });
  const send = (frame: unknown) => new Promise<Record<string, unknown>>((resolve) => {
    const sock = Object.assign(new EventEmitter(), { end: (line: string) => resolve(JSON.parse(line)) }) as unknown as Socket;
    handle(frame, sock);
  });
  return { send, open, lightFace, dropFace, recompose, releaseFace, closeFaces, order, handle };
}
afterEach(() => setMountedFace(undefined));
test("locking an open sibling drops its provider without recomposition", async () => {
  setMountedFace(0); const h = harness(); h.open.add("1");
  await h.send({ op: "lock", face: 1 });
  expect(h.dropFace).toHaveBeenCalledExactlyOnceWith(1); expect(h.recompose).not.toHaveBeenCalled();
});
test("unlocking a sibling with the mounted face unchanged lights it without recomposition", async () => {
  setMountedFace(0); const h = harness();
  await h.send({ op: "unlock", all: true, credentials: [{ kind: "passphrase", passphrase: "x" }] });
  expect(h.lightFace).toHaveBeenCalledExactlyOnceWith(1); expect(h.recompose).not.toHaveBeenCalled();
});
test("changing the mounted face recomposes", async () => {
  setMountedFace(0); const h = harness();
  await h.send({ op: "unlock", face: 1, credentials: [{ kind: "passphrase", passphrase: "x" }] });
  expect(h.recompose).toHaveBeenCalledWith(true, expect.anything());
});
test("reopening the mounted face recomposes after its lock", async () => {
  setMountedFace(0); const h = harness();
  await h.send({ op: "lock", face: 0 });
  h.recompose.mockClear();
  await h.send({ op: "unlock", face: 0, credentials: [{ kind: "passphrase", passphrase: "x" }] });
  expect(h.recompose).toHaveBeenCalledWith(true, expect.anything());
  expect(h.lightFace).not.toHaveBeenCalled();
});
test("the sibling key stays open until its provider drops", async () => {
  setMountedFace(0); const h = harness(); h.open.add("1");
  let finish!: () => void;
  h.dropFace.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  const pending = h.send({ op: "lock", face: 1 });
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  expect(h.open.has("1")).toBe(true);
  finish(); await pending;
  expect(h.open.has("1")).toBe(false);
});
test("a sibling lock whose provider drop refuses leaves the key open and answers no lock", async () => {
  setMountedFace(0); const h = harness(); h.open.add("1");
  h.dropFace.mockRejectedValueOnce(new Error("island faulted"));
  const answer = await h.send({ op: "lock", face: 1 });
  expect(answer).not.toMatchObject({ locked: true });
  expect(h.open.has("1")).toBe(true);
});

test("SOL R7 (a lock holds the custody line while its drain waits on a session act queued behind it): the face closes ahead of the line, so the act runs and the lock lands", async () => {
  setMountedFace(0); const h = harness(); h.open.add("1");
  // The face's close waits on a session act (admitted work) that rides the custody line itself.
  h.dropFace.mockImplementation(async () => { await h.handle.act("crossing.sign", {}); });
  const answer = await Promise.race([h.send({ op: "lock", face: 1 }), new Promise((r) => setTimeout(() => r("deadlocked"), 3000))]);
  expect(answer).toMatchObject({ locked: true, face: 1 });
  expect(h.open.has("1")).toBe(false);
});

test("SOL R7 (a mounted-face lock drops its key before teardown): the mount closes through its actor before its key locks", async () => {
  setMountedFace(0); const h = harness();
  h.dropFace.mockImplementation(async (ordinal: number) => { h.order.push(`close h${ordinal}`); });
  await h.send({ op: "lock", face: 0 });
  expect(h.order.slice(0, 2)).toEqual(["close h0", "lockFace 0"]);
});

test("SOL R7 (a whole lock tears faces down after the key drops): every face closes through its actor before the vessel's key locks", async () => {
  setMountedFace(0); const h = harness();
  h.closeFaces.mockImplementation(async () => { h.order.push("close every face"); });
  await h.send({ op: "lock" });
  expect(h.order.indexOf("close every face")).toBeGreaterThan(-1);
  expect(h.order.indexOf("close every face")).toBeLessThan(h.order.indexOf("lock"));
});

test("a lock's hold on the face lifts once the key locked, and lifts too when the close faults and the key stays open", async () => {
  setMountedFace(0); const h = harness(); h.open.add("1");
  await h.send({ op: "lock", face: 1 });
  expect(h.releaseFace).toHaveBeenCalledWith(1);
  h.open.add("1"); h.releaseFace.mockClear();
  h.dropFace.mockRejectedValueOnce(new Error("saves still wait"));
  expect(await h.send({ op: "lock", face: 1 })).toMatchObject({ status: "error", refusal: { reason: "face-close-held" } });
  expect(h.open.has("1")).toBe(true);
  expect(h.releaseFace).toHaveBeenCalledWith(1);
});
