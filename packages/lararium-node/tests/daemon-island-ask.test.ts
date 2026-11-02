/**
 * daemon-island-ask — ONE holder-backed adapter hands every host ask (seat-duty, store-door, memory) its ports.
 *
 * `islandAsk(holder)(make)` reads the facade's `daemonHandle` and `placeVerb` at CALL time (so a restart never leaves an ask on the
 * old island), forces the `channel` origin every host ask rides, and guards the ask the builder returns (`holder.guardAsk`), so an
 * ask pending at a restart rejects `daemon-restarting`. Each caller keeps its own facts, signer, validation and refusals: the
 * adapter builds no ask and reads no fact.
 */
import { describe, expect, test } from "vitest";
import { holdDaemonVm, type DaemonVmCore } from "@lararium/tw5";
import { islandAsk } from "../src/daemon-island-ask.js";

function fakeVm(id: number): DaemonVmCore & { placed: Array<Record<string, unknown>> } {
  const placed: Array<Record<string, unknown>> = [];
  return {
    placed, daemonHandle: { id } as never,
    placeVerb: (o: Record<string, unknown>) => { placed.push(o); },
    shutdown: async () => ({ acked: true }), dispose: () => undefined,
  } as never;
}

describe("islandAsk", () => {
  test("ports read the current island at call time; the origin is forced to channel; a restart moves the next ask to the new island", async () => {
    const first = fakeVm(1);
    const next = fakeVm(2);
    const held = holdDaemonVm({ vm: first, reopen: async () => next });
    const ask = islandAsk(held);
    const seen: unknown[] = [];
    const build = (ports: { daemonHandle: unknown; placeVerb: (o: { verb: string; args: Record<string, unknown> }) => void }) => {
      seen.push(ports.daemonHandle);
      ports.placeVerb({ verb: "seat-duties", args: {} });
      return { answer: new Promise<string>(() => undefined), abandon: () => undefined };
    };
    ask(build as never);
    await held.restart("r");
    ask(build as never);
    expect(seen).toEqual([first.daemonHandle, next.daemonHandle]);
    expect(first.placed).toEqual([{ verb: "seat-duties", args: {}, origin: "channel" }]);
    expect(next.placed).toEqual([{ verb: "seat-duties", args: {}, origin: "channel" }]);
  });

  test("an ask pending at a restart rejects daemon-restarting and is abandoned; CONTROL: an ask built outside the adapter stays pending", async () => {
    const held = holdDaemonVm({ vm: fakeVm(1), reopen: async () => fakeVm(2) });
    let abandoned = 0;
    const never = new Promise<string>(() => undefined);
    const guarded = islandAsk(held)(() => ({ answer: never, abandon: () => { abandoned += 1; } }) as never) as unknown as { answer: Promise<string> };
    const outcome = guarded.answer.then(() => "answered", (e: Error) => e.message);
    let rawSettled = false;
    never.then(() => { rawSettled = true; }, () => { rawSettled = true; });
    await held.restart("r");
    expect(await outcome).toBe("daemon-restarting");
    expect(abandoned).toBe(1);
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    expect(rawSettled).toBe(false);
  });

  test("a builder that throws while the island restarts refuses by name", async () => {
    const held = holdDaemonVm({ vm: fakeVm(1), reopen: () => new Promise<DaemonVmCore>(() => undefined) });
    void held.restart("r");
    await Promise.resolve();
    expect(() => islandAsk(held)((ports) => { ports.placeVerb({ verb: "x", args: {} } as never); return { answer: Promise.resolve(1), abandon: () => undefined } as never; })).toThrow(/daemon-restarting/);
  });
});
