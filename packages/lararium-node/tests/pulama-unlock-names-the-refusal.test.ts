/**
 * pulama-unlock-names-the-refusal — the custody door of a vessel standing by its pūlama, wired to the real stand-by, answers an
 * unlock frame while the composition over the session refuses: the answer lands on the caller's own socket and names the
 * composition's fault, so the caller never needs a probe to learn why the session left.
 */
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { describe, expect, test } from "vitest";
import { custodyFrameHandler } from "../src/custody-frames.js";
import type { CustodyHolder } from "../src/custody-holder.js";
import type { PulamaHolder } from "../src/pulama-holder.js";
import { pulamaStandBy } from "../src/pulama-seat.js";

/** A pūlama that serves every dial a session; its session leaves on `lock`. */
function pulamaHolder(): PulamaHolder {
  let open = false;
  const closed = new Set<() => void>();
  return {
    onClosed: (l: () => void) => { closed.add(l); return () => closed.delete(l); },
    isUnlocked: () => open,
    unlock: async () => { open = true; return { reading: "opens", slot: "pulama" }; },
    lock: async () => { open = false; for (const l of closed) l(); },
    lends: () => [0], waiting: () => [], waits: () => null,
    attemptsLeft: () => 0, openedSlot: () => (open ? "pulama" : null), unlockedFaces: () => [],
    landRite: async () => ({ par: true }),
  } as unknown as PulamaHolder;
}

function sent(handle: (parsed: unknown, sock: Socket) => boolean, frame: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("the door left the unlock frame unanswered")), 2_000);
    const sock = Object.assign(new EventEmitter(), { end: (line: string) => { clearTimeout(timer); resolve(JSON.parse(line) as Record<string, unknown>); } }) as unknown as Socket;
    expect(handle(frame, sock)).toBe(true);
  });
}

describe("RED pulama-unlock-answers-while-its-composition-refuses", () => {
  test("the door answers on the caller's socket, reads `composition-refused`, and names the composition's own fault", async () => {
    const pulama = pulamaHolder();
    const recompose = async (sovereign: boolean) => (sovereign ? { standing: "herm", refused: "outside-the-lei: h0 would not prove" } : { standing: "herm" });
    const by = pulamaStandBy({ holder: pulama, recompose, onLog: () => {} });
    const logs: string[] = [];
    const handle = custodyFrameHandler({
      holder: pulama as unknown as CustodyHolder, testScratch: false, standing: () => "herm", recompose, onLog: (l) => logs.push(l),
      pulama: { standing: () => ({ session: pulama.isUnlocked(), waits: pulama.isUnlocked() ? null : by.waits() }), dial: () => by.dial(), lent: () => pulama.lends() },
    });
    const a = await sent(handle, { op: "unlock" });
    expect(a).toMatchObject({ op: "unlock", reading: "pulama-waits", held: false, pulama: { session: false, waits: "composition-refused" } });
    expect(a["refused"]).toBe("outside-the-lei: h0 would not prove");
    expect(logs.join("\n")).toMatch(/composition-refused.*outside-the-lei/);
  });

  test("CONTROL: a composition that stands answers opens, naming no refusal", async () => {
    const pulama = pulamaHolder();
    const recompose = async (sovereign: boolean) => ({ standing: sovereign ? "hearth" : "herm" });
    const by = pulamaStandBy({ holder: pulama, recompose, onLog: () => {} });
    const handle = custodyFrameHandler({
      holder: pulama as unknown as CustodyHolder, testScratch: false, standing: () => (pulama.isUnlocked() ? "hearth" : "herm"), recompose, onLog: () => {},
      pulama: { standing: () => ({ session: pulama.isUnlocked(), waits: null }), dial: () => by.dial(), lent: () => pulama.lends() },
    });
    const a = await sent(handle, { op: "unlock" });
    expect(a).toMatchObject({ op: "unlock", reading: "opens", held: true });
    expect(a["refused"]).toBeUndefined();
  });
});
