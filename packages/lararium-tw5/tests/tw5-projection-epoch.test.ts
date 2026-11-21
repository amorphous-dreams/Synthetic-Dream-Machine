import { afterEach, describe, expect, test, vi } from "vitest";
import { mkLarControlEvent, mkLarResend, readLarControlResult, readLarFrame, type LarMsg_ControlResult, type LarMsg_Frame } from "@lararium/mesh";
import { createEpochMint, mountProjection } from "../src/tw5-projection.js";
import type { IslandContext } from "../src/island-context.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";
import { hasProjection } from "../src/has-island-watches.js";

const settle = async () => { for (let index = 0; index < 8; index++) await new Promise<void>(resolve => process.nextTick(resolve)); };

describe.skipIf(wikiSkip)(`clockless projection epochs${skipNote}`, () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  test("mount and resend mint rising epochs without either clock; CONTROL: a plain frame keeps its epoch", async () => {
    const engine = await bootTestWiki({ tiddlers: [] });
    engine.setTiddler({ title: "$:/core/ui/RootTemplate", type: "text/vnd.tiddlywiki", text: "<div>epoch</div>" });
    await settle();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const frames: LarMsg_Frame[] = [];
    const results: LarMsg_ControlResult[] = [];
    const ctx = { wikiUri: "lar:///test/epochs", tw5: engine,
      post: (message: unknown) => {
        const frame = readLarFrame(message); if (frame) frames.push(frame);
        const result = readLarControlResult(message); if (result) results.push(result);
      } } as unknown as IslandContext;
    vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("clock"); });
    vi.spyOn(performance, "now").mockImplementation(() => { throw new Error("clock"); });
    const epochs: number[] = [];
    let stop: (() => void) | undefined;
    try {
      for (let index = 0; index < 3; index++) {
        stop = mountProjection(ctx);
        await settle(); vi.advanceTimersByTime(100); await settle();
        const mounted = frames.at(-1)!;
        epochs.push(mounted.mountEpoch);
        const count = frames.length;
        const event = mkLarControlEvent({ eventId: `epoch-control-${index}`, cameraId: mounted.cameraId,
          mountEpoch: mounted.mountEpoch, kind: "lar:act", action: "lar:click", renderId: "missing",
          seenFrameRev: mounted.keys[0]?.rev ?? 0 });
        expect(hasProjection().onSignal?.("lar:control-event", event, ctx)).toBe(true);
        await settle(); vi.advanceTimersByTime(100); await settle();
        expect(results.at(-1)).toMatchObject({ eventId: event.eventId, status: "stale-target" });
        if (frames.length > count) expect(frames.at(-1)!.mountEpoch).toBe(mounted.mountEpoch);
        const cap = hasProjection();
        expect(cap.onSignal?.("lar:resend", mkLarResend(), ctx)).toBe(true);
        await settle(); vi.advanceTimersByTime(100); await settle();
        epochs.push(frames.at(-1)!.mountEpoch);
        stop(); stop = undefined;
      }
      expect(new Set(epochs).size).toBe(epochs.length);
      for (let index = 1; index < epochs.length; index++) expect(epochs[index]!).toBeGreaterThan(epochs[index - 1]!);
      expect(epochs.every(Number.isSafeInteger)).toBe(true);
    } finally { stop?.(); engine.dispose(); }
  }, 120_000);

  test("two boot nonce factories differ; CONTROL: each boot counter rises", () => {
    const first = createEpochMint();
    const second = createEpochMint();
    const a = first(), b = first(), c = second();
    expect(b).toBeGreaterThan(a);
    expect(c).not.toBe(a);
    expect(c).not.toBe(b);
  });
});
