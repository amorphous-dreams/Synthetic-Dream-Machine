/**
 * pulama-unlock-door — the custody door of a vessel whose custody a pūlama holds: an `unlock` reads no credential and opens
 * nothing here; it asks the pūlama again and names a session or what the pūlama waits on.
 */
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { describe, expect, test } from "vitest";
import { custodyFrameHandler } from "../src/custody-frames.js";
import type { CustodyHolder } from "../src/custody-holder.js";

const ROUTE = "a-route-typed-at-the-wrong-door";

function fakeSock(): { sock: Socket; answer: Promise<Record<string, unknown>> } {
  let settle!: (a: Record<string, unknown>) => void;
  const answer = new Promise<Record<string, unknown>>((resolve) => { settle = resolve; });
  const sock = Object.assign(new EventEmitter(), { end: (line: string) => settle(JSON.parse(line) as Record<string, unknown>) }) as unknown as Socket;
  return { sock, answer };
}

function door(pulama: { session: boolean; waits: string | null; onDial?: () => { session: boolean; waits: string | null } } | null) {
  const heard: unknown[] = [], logs: string[] = [], recomposed: boolean[] = [];
  let dials = 0;
  const state = pulama ? { session: pulama.session, waits: pulama.waits } : null;
  const holder = {
    unlock: async (creds: unknown) => { heard.push(creds); return { reading: "no-slot-opens", attemptsLeft: 2 }; },
    unlockFaces: async (creds: unknown) => { heard.push(creds); return []; },
    unlockFace: async (_face: unknown, creds: unknown) => { heard.push(creds); return { reading: "face-absent" }; },
    proves: async (creds: unknown) => { heard.push(creds); return { reading: "locked" }; },
    lock: async () => {}, isUnlocked: () => state?.session === true, attemptsLeft: () => 0, openedSlot: () => null, unlockedFaces: () => [], faceStanding: async () => null,
  } as unknown as CustodyHolder;
  const handle = custodyFrameHandler({
    holder, testScratch: false, standing: () => (state?.session ? "hearth" : "herm"),
    recompose: async (sovereign) => { recomposed.push(sovereign); return { standing: sovereign ? "hearth" : "herm" }; },
    onLog: (line) => logs.push(line),
    ...(state && pulama ? { pulama: {
      standing: () => ({ ...state }),
      dial: async () => { dials += 1; Object.assign(state, pulama.onDial?.() ?? {}); return { ...state }; },
    } } : {}),
  });
  const send = (frame: unknown) => { const { sock, answer } = fakeSock(); expect(handle(frame, sock)).toBe(true); return answer; };
  return { send, heard, logs, recomposed, dials: () => dials };
}

describe("RED unlock-under-pulama-asks-nothing (the vessel's door)", () => {
  test("an unlock frame at a vessel standing by a pūlama reads no credential, reaches no holder unlock, and names what the pūlama waits on", async () => {
    const d = door({ session: false, waits: "kukulu-unvouched" });
    // The door's own reading says a pūlama holds this custody, so a caller learns it before it asks anybody anything.
    expect(await d.send({ op: "custody" })).toMatchObject({ op: "custody", unlocked: false, pulama: { session: false, waits: "kukulu-unvouched" } });
    // A frame with no credential at all serves: the route belongs at the pūlama's hand door.
    const bare = await d.send({ op: "unlock" });
    expect(bare).toMatchObject({ op: "unlock", reading: "pulama-waits", held: false, pulama: { session: false, waits: "kukulu-unvouched" } });
    // A frame that carries a route anyway meets the same answer, and the route reaches nothing.
    const carried = await d.send({ op: "unlock", credentials: [{ kind: "passphrase", passphrase: ROUTE }], all: true });
    expect(carried).toMatchObject({ reading: "pulama-waits" });
    expect(d.heard).toEqual([]);
    expect(d.dials()).toBe(2);
    expect(JSON.stringify([bare, carried, d.logs])).not.toContain(ROUTE);
    expect(d.logs.join("\n")).toMatch(/the pūlama serves no session \(kukulu-unvouched\)/);
  });

  test("the pūlama lit since: the same frame dials, the session stands, and the answer reads opens; a second reads already-unlocked and dials nothing", async () => {
    const d = door({ session: false, waits: "pulama-locked", onDial: () => ({ session: true, waits: null }) });
    expect(await d.send({ op: "unlock" })).toMatchObject({ reading: "opens", held: true, pulama: { session: true, waits: null }, standing: "hearth" });
    expect(await d.send({ op: "unlock" })).toMatchObject({ reading: "already-unlocked", held: true });
    expect(d.dials()).toBe(1);
    expect(d.heard).toEqual([]);
  });

  test("CONTROL: with no pūlama seated the door reads the credential and hands it to the holder, and a bare unlock refuses as malformed", async () => {
    const d = door(null);
    expect((await d.send({ op: "custody" }))["pulama"]).toBeUndefined();
    expect(await d.send({ op: "unlock" })).toMatchObject({ status: "error", refusal: { reason: "bad-custody-frame" } });
    expect(await d.send({ op: "unlock", credentials: [{ kind: "passphrase", passphrase: ROUTE }] })).toMatchObject({ reading: "no-slot-opens" });
    expect(d.heard).toEqual([[{ kind: "passphrase", passphrase: ROUTE }]]);
  });
});
