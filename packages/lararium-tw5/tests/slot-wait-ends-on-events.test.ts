/**
 * slot-wait-ends-on-events — no clock decides an arrival (road C16).
 *
 * A wiki island keeps no store, so every slot document arrives from the vessel. The vessel answers an ask once it has
 * read its own store: with the document, or with its named "unavailable". A silent port while an ask stands says only
 * that the vessel is still working (a big load, a key derivation), never that the document will not come. So the wait
 * ends on an event: the document arriving, a refusal, or the vessel's verdict. The hard cap stays as the one last-resort
 * bound, and it names itself and the phase the wait stood in.
 *
 *   E1  RED: an ask stands unanswered with the vessel connected and the port silent past every silence budget; the document
 *       then arrives: the wait answers the HANDLE.
 *   E2  RED: with no event at all, the wait ends only at the hard cap, as `hard-cap`, naming the phase it stood in (`asked`:
 *       the vessel connected and the ask unanswered; `no-peer`: no vessel connected).
 *       control: a connected vessel's verdict still ends the wait as `verdict`, well before the hard cap.
 */
import { describe, expect, test } from "vitest";
import { waitForSlotDocument, type SlotWaitDeps } from "../src/slot-wait.js";

/** A hand-stepped clock: `sleep` advances it, so a vector reads no wall time. */
function world(over: Partial<SlotWaitDeps<string>> & { find: () => Promise<string> }) {
  let t = 0;
  const deps = {
    peerCount: () => 1,
    absence: (rejection: unknown) => rejection instanceof Error && rejection.message === "unavailable",
    now: () => t,
    lastHeard: () => 0,
    sleep: async (ms: number) => { t += ms; await Promise.resolve(); },
    defer: async () => { await Promise.resolve(); },
    budgets: { verdictGraceMs: 8_000, hardCapMs: 60_000, pollMs: 250 },
    ...over,
  } as unknown as SlotWaitDeps<string>;
  return { deps, at: () => t };
}

describe("the slot wait ends on events, never on silence alone", () => {
  test("E1 — RED: an unanswered ask past every silence budget still meets the document when it arrives", async () => {
    let arrive!: (handle: string) => void;
    const arrival = new Promise<string>((resolve) => { arrive = resolve; });
    const w = world({ find: () => arrival });
    const out = waitForSlotDocument(w.deps);
    // The vessel reads a big store for twenty seconds, in silence, then answers.
    while (w.at() < 20_000) await w.deps.sleep(250);
    arrive("handle-after-a-long-load");
    expect(await out).toEqual({ outcome: "ready", handle: "handle-after-a-long-load" });
  });

  test("E2 — RED: with no event, only the hard cap ends the wait, naming itself and its phase", async () => {
    const asked = world({ find: () => new Promise<string>(() => {}) });
    expect(await waitForSlotDocument(asked.deps)).toEqual({ outcome: "hard-cap", phase: "asked", elapsedMs: 60_000 });

    const lonely = world({ peerCount: () => 0, find: async () => { throw new Error("unavailable"); } });
    const out = await waitForSlotDocument(lonely.deps);
    expect(out).toMatchObject({ outcome: "hard-cap", phase: "no-peer" });
    expect(lonely.at()).toBeGreaterThanOrEqual(60_000);

    // control: the connected vessel's verdict ends it, by name, inside its grace
    const told = world({ find: async () => { throw new Error("unavailable"); } });
    expect(await waitForSlotDocument(told.deps)).toEqual({ outcome: "verdict" });
    expect(told.at()).toBeLessThan(10_000);
  });
});
