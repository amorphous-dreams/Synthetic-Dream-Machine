import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { afterEach, expect, test, vi } from "vitest";
import { custodyFrameHandler } from "../src/custody-frames.js";
import { setMountedFace } from "../src/node-vessel-identity.js";
import type { CustodyHolder } from "../src/custody-holder.js";

function harness(opts: { pulama?: boolean; lockThrows?: boolean; unlockGate?: Promise<void> } = {}) {
  const open = new Set(["0"]);
  const holder = {
    unlock: async () => ({ reading: "already-unlocked" }),
    unlockFace: async ({ ordinal }: { ordinal: number }) => { open.add(String(ordinal)); return { reading: "opens", ordinal }; },
    unlockFaces: async () => { await opts.unlockGate; open.add("1"); return [{ reading: "opens", ordinal: 1 }]; },
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
  const releaseFaces = vi.fn(() => {});
  const holdFace = vi.fn((_ordinal: number) => true);
  const holdFaces = vi.fn(() => true);
  let unlocked = true;
  const order: string[] = [];
  const lockFace = holder.lockFace.bind(holder);
  (holder as { lockFace: (fcid: string) => Promise<void> }).lockFace = async (fcid) => { order.push(`lockFace ${fcid}`); await lockFace(fcid); };
  const lock = vi.fn(async () => { order.push("lock"); });
  (holder as unknown as { lock: () => Promise<void>; isUnlocked: () => boolean }).lock = lock;
  (holder as unknown as { isUnlocked: () => boolean }).isUnlocked = () => unlocked;
  if (opts.pulama === true || opts.lockThrows === true) {
    // A pūlama's lent holder refuses every face lock (the person's own act at the pūlama); a local holder may throw.
    (holder as { lockFace: (fcid: string) => Promise<void> }).lockFace = async () => { order.push("lockFace refused"); throw new Error("needs-the-human: a face's lock"); };
  }
  const handle = custodyFrameHandler({ holder, lightFace, dropFace, releaseFace, releaseFaces, holdFace, holdFaces, closeFaces, recompose, standing: () => "hearth", onLog: () => {}, testScratch: false,
    runAct: async () => ({ ran: true }),
    ...(opts.pulama === true ? { pulama: { standing: () => ({ session: true, waits: null }), dial: async () => ({ session: true, waits: null }), lent: () => [], tellWorn: () => {} } } : {}) } as unknown as Parameters<typeof custodyFrameHandler>[0]);
  const send = (frame: unknown) => new Promise<Record<string, unknown>>((resolve) => {
    const sock = Object.assign(new EventEmitter(), { end: (line: string) => resolve(JSON.parse(line)) }) as unknown as Socket;
    handle(frame, sock);
  });
  /** A caller who leaves once the frame went in: its socket reads destroyed and every answer goes nowhere. */
  const sendAndLeave = (frame: unknown): void => {
    const sock = Object.assign(new EventEmitter(), { destroyed: false, end: () => {} }) as unknown as Socket & { destroyed: boolean };
    handle(frame, sock);
    sock.destroyed = true;
  };
  const setUnlocked = (yes: boolean): void => { unlocked = yes; };
  return { send, sendAndLeave, open, lightFace, dropFace, recompose, releaseFace, releaseFaces, holdFace, holdFaces, closeFaces, lock, order, handle, setUnlocked };
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

test("FINDING 1 (a refused lock darkened the mount): under a pūlama the face lock cannot land here, so no close runs ahead of it: the mount and every sibling keep standing", async () => {
  setMountedFace(0); const h = harness({ pulama: true }); h.open.add("1");
  const answer = await h.send({ op: "lock", face: 0 });
  expect(answer).toMatchObject({ status: "error" });
  expect(h.dropFace, "no drain, no dark mount").not.toHaveBeenCalled();
  expect(h.recompose).not.toHaveBeenCalled();
  expect(h.open.has("0")).toBe(true);
});

test("FINDING 1: a local lock whose key did not lock (the holder threw) answers the fault and lifts the hold its close set", async () => {
  setMountedFace(0); const h = harness({ lockThrows: true });
  const answer = await h.send({ op: "lock", face: 0 });
  expect(answer).toMatchObject({ status: "error" });
  expect(h.dropFace).toHaveBeenCalledWith(0);
  expect(h.releaseFace).toHaveBeenCalledWith(0);
  expect(h.open.has("0")).toBe(true);
});

test("FINDING 2 (a caller who leaves strands the hold): a face lock whose close ran ahead runs to its end though its caller left: the key locks and the hold lifts", async () => {
  setMountedFace(0); const h = harness(); h.open.add("1");
  h.sendAndLeave({ op: "lock", face: 1 });
  await vi.waitFor(() => expect(h.releaseFace).toHaveBeenCalledWith(1));
  expect(h.dropFace).toHaveBeenCalledWith(1);
  expect(h.open.has("1"), "the key locked behind the caller who left").toBe(false);
});

test("FINDING 2: a whole lock whose faces closed ahead runs to its end though its caller left: the vessel key locks", async () => {
  setMountedFace(0); const h = harness();
  h.sendAndLeave({ op: "lock" });
  await vi.waitFor(() => expect(h.lock).toHaveBeenCalledOnce());
  expect(h.closeFaces).toHaveBeenCalledOnce();
});

test("FINDING 2: a whole lock over a key already shut lifts every hold its close set", async () => {
  setMountedFace(0); const h = harness(); h.setUnlocked(false);
  expect(await h.send({ op: "lock" })).toMatchObject({ locked: true, was: "locked" });
  expect(h.releaseFaces).toHaveBeenCalledOnce();
  expect(h.lock).not.toHaveBeenCalled();
});

test("FINDING 3 (a whole lock over unsealed saves): a face that did not close whole leaves the vessel key open, names the fault, and lifts every hold", async () => {
  setMountedFace(0); const h = harness();
  h.closeFaces.mockRejectedValueOnce(new Error("face h1 did not close whole, so the key stays open: seal refused"));
  const answer = await h.send({ op: "lock" });
  expect(answer).toMatchObject({ status: "error", refusal: { reason: "face-close-held" } });
  expect(String(answer["errorMessage"])).toContain("face h1");
  expect(h.lock, "the key never locked over unsealed saves").not.toHaveBeenCalled();
  expect(h.releaseFaces).toHaveBeenCalledOnce();
});

test("FINDING 4 (a lock queued behind a recompose): a face lit again under a new composition before its key locks leaves the key open", async () => {
  setMountedFace(0); const h = harness(); h.open.add("1");
  h.holdFace.mockReturnValueOnce(false);
  const answer = await h.send({ op: "lock", face: 1 });
  expect(answer).toMatchObject({ status: "error" });
  expect(String(answer["errorMessage"])).toMatch(/stands lit/);
  expect(h.open.has("1"), "the new life's key stays open").toBe(true);
  expect(h.holdFace).toHaveBeenCalledWith(1);
});

test("B1 (a lock queued behind an unlock locks a lit face with no close): the face read shut at the frame, so no close ran ahead; the unlock lit it; the lock finds it lit in its line and leaves the key open", async () => {
  setMountedFace(0);
  let letUnlock!: () => void;
  const h = harness({ unlockGate: new Promise<void>((r) => { letUnlock = r; }) });
  const lit = new Set<number>([0]);
  h.lightFace.mockImplementation(async (ordinal: number) => { lit.add(ordinal); });
  h.holdFace.mockImplementation((ordinal: number) => !lit.has(ordinal));
  // THE UNLOCK runs first and waits on its route; the lock arrives while face 1 still reads shut.
  const unlocked = h.send({ op: "unlock", all: true, credentials: [{ kind: "passphrase", passphrase: "x" }] });
  const locked = h.send({ op: "lock", face: 1 });
  await new Promise((r) => setTimeout(r, 20));
  expect(h.dropFace, "the face read shut at the frame: no close ran ahead").not.toHaveBeenCalled();
  letUnlock();
  await unlocked;
  expect(lit.has(1), "the unlock lit face 1").toBe(true);
  const answer = await locked;
  expect(answer).toMatchObject({ status: "error" });
  expect(String(answer["errorMessage"])).toMatch(/stands lit/);
  expect(h.open.has("1"), "no key locks under a lit face no close reached").toBe(true);
  expect(h.order).not.toContain("lockFace 1");
});

test("F7: a whole lock finds a face lit in its line (a composition stood again after its close) and leaves the vessel key open, lifting every hold", async () => {
  setMountedFace(0); const h = harness();
  h.holdFaces.mockReturnValueOnce(false);
  const answer = await h.send({ op: "lock" });
  expect(answer).toMatchObject({ status: "error" });
  expect(String(answer["errorMessage"])).toMatch(/stands lit/);
  expect(h.lock).not.toHaveBeenCalled();
  expect(h.releaseFaces).toHaveBeenCalledOnce();
});

