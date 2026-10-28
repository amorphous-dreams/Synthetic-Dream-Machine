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
  } as unknown as CustodyHolder;
  const lightFace = vi.fn(async (_ordinal: number) => {});
  const dropFace = vi.fn(async (_ordinal: number) => {});
  const recompose = vi.fn(async () => ({ standing: "hearth" }));
  const handle = custodyFrameHandler({ holder, lightFace, dropFace, recompose, standing: () => "hearth", onLog: () => {}, testScratch: false });
  const send = (frame: unknown) => new Promise<Record<string, unknown>>((resolve) => {
    const sock = Object.assign(new EventEmitter(), { end: (line: string) => resolve(JSON.parse(line)) }) as unknown as Socket;
    handle(frame, sock);
  });
  return { send, open, lightFace, dropFace, recompose };
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
  expect(h.recompose).toHaveBeenCalledWith(true);
});
test("reopening the mounted face recomposes after its lock", async () => {
  setMountedFace(0); const h = harness();
  await h.send({ op: "lock", face: 0 });
  h.recompose.mockClear();
  await h.send({ op: "unlock", face: 0, credentials: [{ kind: "passphrase", passphrase: "x" }] });
  expect(h.recompose).toHaveBeenCalledWith(true);
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
