/**
 * pulama-session-drops-with-socket — over a real unix socket, a session lives exactly as long as its connection: a vessel
 * that goes away releases the custody claim it held and leaves nothing serving, and the vessel's side reads locked at once.
 */
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CustodyLocked } from "../src/custody-holder.js";
import { makePulamaHolder } from "../src/pulama-holder.js";
import { dialPulama, listenPulama } from "../src/pulama-socket.js";
import type { PulamaChannel } from "../src/pulama-wire.js";
import { openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const HOT = ".persona-admissions.json";
let fx: PulamaFixture | null = null;
let dir: string | null = null;
let listener: { close(): Promise<void> } | null = null;
afterEach(async () => {
  await listener?.close(); listener = null;
  await fx?.drop(); fx = null;
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe("RED pulama-session-drops-with-socket", () => {
  test("a dropped connection ends the session, releases its claim and locks the vessel's side; CONTROL: a fresh dial serves again", async () => {
    fx = await standPulama("pulama-socket", () => openGate({ face: null, coldReads: [] }));
    dir = mkdtempSync(join(tmpdir(), "lar-pulama-sock-"));
    const path = join(dir, "pulama.sock");
    listener = await listenPulama(path, (channel) => fx!.server.accept(channel));
    expect(statSync(path).mode & 0o777).toBe(0o600);
    // A second pūlama refuses the path a live one answers.
    await expect(listenPulama(path, () => {})).rejects.toMatchObject({ reading: "pulama-already-stands" });

    let channel: PulamaChannel | null = null;
    const vessel = makePulamaHolder({ homes: fx.seat.homes, offer: () => ({}), dial: async () => (channel = await dialPulama(path)) });
    expect((await vessel.unlock([])).reading).toBe("opens");
    await vessel.writeRow("identity", HOT, Uint8Array.from([5]));
    expect(fx.server.sessions()).toBe(1);
    let closed = 0;
    vessel.onClosed(() => { closed += 1; });

    // The vessel takes the custody claim and never returns it: its process ends mid-act.
    let entered!: () => void;
    const inside = new Promise<void>((resolve) => { entered = resolve; });
    const stuck = vessel.exclusive(() => { entered(); return new Promise<never>(() => {}); });
    stuck.catch(() => undefined);
    await inside;
    let localRan = false;
    const waiting = fx.local.exclusive(async () => { localRan = true; });
    expect(localRan).toBe(false);

    channel!.close();
    await vi.waitFor(() => expect(fx!.server.sessions()).toBe(0));
    await waiting;                                   // the claim the dead session held went back
    expect(localRan).toBe(true);
    await vi.waitFor(() => expect(closed).toBe(1));
    expect(vessel.isUnlocked()).toBe(false);
    await expect(vessel.writeRow("identity", HOT, Uint8Array.from([6]))).rejects.toBeInstanceOf(CustodyLocked);
    expect(await vessel.readRow("identity", HOT)).toEqual({ reading: "locked" });
    // The pūlama stays lit through the drop, and the row the session wrote stands.
    expect(fx.kept.isUnlocked()).toBe(true);
    expect(await fx.kept.readRow("identity", HOT)).toEqual({ reading: "opens", plaintext: Uint8Array.from([5]) });

    // CONTROL: the same vessel dials again and the pūlama serves it.
    expect((await vessel.unlock([])).reading).toBe("opens");
    expect(await vessel.readRow("identity", HOT)).toEqual({ reading: "opens", plaintext: Uint8Array.from([5]) });
    // The listener's close drops the session too, and removes the socket file.
    await listener.close(); listener = null;
    await vi.waitFor(() => expect(vessel.isUnlocked()).toBe(false));
    await expect(dialPulama(path)).rejects.toMatchObject({ reading: "pulama-unreachable" });
  });
});
