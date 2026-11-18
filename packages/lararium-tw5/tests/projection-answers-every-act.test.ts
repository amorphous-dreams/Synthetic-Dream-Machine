/**
 * THE ISLAND ANSWERS EVERY RELIABLE ACT ON `lar:control-result`.
 *
 * The page holds each act it relayed until its answer arrives. An act the island cannot place stays unanswered
 * only where nothing can carry the answer, and the camera's door carries one whenever the island stands.
 *
 *   - FORCED RACE: a resend (a fresh mount epoch) and an act on an unknown render id under the OLD epoch arrive back
 *     to back, no await between: the act answers `stale-target`, never silence. CONTROL: a known id under the fresh
 *     epoch applies.
 *   - NO CAMERA: an act reaching an island whose camera stands no longer answered on a console line alone; it now
 *     answers `stale-target` through the island's own door. CONTROL: a mounted camera answers through its own post.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { mkLarControlEvent, mkLarResend, readLarControlResult, readLarFrame, type LarMsg_ControlResult, type LarMsg_Frame } from "@lararium/mesh";
import { mountProjection } from "../src/tw5-projection.js";
import { hasProjection } from "../src/has-island-watches.js";
import type { IslandContext } from "../src/island-context.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const settle = async () => { for (let index = 0; index < 8; index++) await new Promise<void>(resolve => process.nextTick(resolve)); };

function islandCtx(engine: Awaited<ReturnType<typeof bootTestWiki>>, wikiUri: string) {
  const frames: LarMsg_Frame[] = [];
  const results: LarMsg_ControlResult[] = [];
  const ctx = { wikiUri, tw5: engine,
    post: (message: unknown) => {
      const frame = readLarFrame(message); if (frame) frames.push(frame);
      const result = readLarControlResult(message); if (result) results.push(result);
    } } as unknown as IslandContext;
  return { ctx, frames, results };
}

describe.skipIf(wikiSkip)(`the island answers every act${skipNote}`, () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  test("FORCED RACE: a resend and an unknown id under the old epoch back to back answer stale-target; CONTROL: a known id under the fresh epoch applies", async () => {
    const engine = await bootTestWiki({ tiddlers: [] });
    engine.setTiddler({ title: "$:/core/ui/RootTemplate", type: "text/vnd.tiddlywiki", text: `<$button set="$:/state/race" setTo="yes">go</$button>` });
    await settle();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { ctx, frames, results } = islandCtx(engine, "lar:///test/answer-race");
    const stop = mountProjection(ctx);
    try {
      await settle(); vi.advanceTimersByTime(100); await settle();
      const mounted = frames.at(-1)!;
      const cap = hasProjection();
      const stale = mkLarControlEvent({ eventId: "race-stale", cameraId: mounted.cameraId, mountEpoch: mounted.mountEpoch,
        kind: "lar:act", action: "lar:click", renderId: "race-unknown-rid", seenFrameRev: mounted.keys[0]?.rev ?? 0 });
      // The race forced: both signals in one turn, nothing awaited between them.
      expect(cap.onSignal?.("lar:resend", mkLarResend(), ctx)).toBe(true);
      expect(cap.onSignal?.("lar:control-event", stale, ctx)).toBe(true);
      await settle(); vi.advanceTimersByTime(100); await settle();
      expect(results.find((r) => r.eventId === "race-stale")).toMatchObject({ status: "stale-target", renderId: "race-unknown-rid" });
      // CONTROL: the fresh frame's button, clicked under the fresh epoch, applies.
      const fresh = frames.at(-1)!;
      expect(fresh.mountEpoch).not.toBe(mounted.mountEpoch);
      const html = String(fresh.keys.find((k) => k.key === "lar:surface")?.html ?? "");
      const rid = /<button[^>]*\bdata-lar-rid="([^"]+)"/.exec(html)?.[1];
      expect(rid, "the fresh frame paints the button with a render id").toBeTruthy();
      const known = mkLarControlEvent({ eventId: "race-known", cameraId: fresh.cameraId, mountEpoch: fresh.mountEpoch,
        kind: "lar:act", action: "lar:click", renderId: rid!, seenFrameRev: fresh.keys[0]?.rev ?? 0 });
      expect(cap.onSignal?.("lar:control-event", known, ctx)).toBe(true);
      await settle(); vi.advanceTimersByTime(100); await settle();
      expect(results.find((r) => r.eventId === "race-known")).toMatchObject({ status: "applied" });
      expect((engine.$tw as unknown as { wiki: { getTiddlerText(t: string): string | undefined } }).wiki.getTiddlerText("$:/state/race")).toBe("yes");
    } finally { stop(); engine.dispose(); }
  }, 120_000);

  test("NO CAMERA: an act on an island whose camera stands no longer answers stale-target through the island's door; CONTROL: a mounted camera answers through its own post", async () => {
    const engine = await bootTestWiki({ tiddlers: [] });
    engine.setTiddler({ title: "$:/core/ui/RootTemplate", type: "text/vnd.tiddlywiki", text: "<div>gone</div>" });
    await settle();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { ctx, frames, results } = islandCtx(engine, "lar:///test/answer-no-camera");
    const stop = mountProjection(ctx);
    await settle(); vi.advanceTimersByTime(100); await settle();
    const mounted = frames.at(-1)!;
    const cap = hasProjection();
    const act = (eventId: string) => mkLarControlEvent({ eventId, cameraId: mounted.cameraId, mountEpoch: mounted.mountEpoch,
      kind: "lar:act", action: "lar:click", renderId: `${eventId}-rid`, seenFrameRev: mounted.keys[0]?.rev ?? 0 });
    try {
      // CONTROL: the standing camera answers.
      expect(cap.onSignal?.("lar:control-event", act("with-camera"), ctx)).toBe(true);
      await settle();
      expect(results.find((r) => r.eventId === "with-camera")).toMatchObject({ status: "stale-target" });
    } finally { stop(); }
    try {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(cap.onSignal?.("lar:control-event", act("no-camera"), ctx)).toBe(true);
      await settle();
      expect(results.find((r) => r.eventId === "no-camera"), "an act with no camera still answers").toMatchObject({
        status: "stale-target", cameraId: mounted.cameraId, mountEpoch: mounted.mountEpoch, renderId: "no-camera-rid" });
      warn.mockRestore();
    } finally { engine.dispose(); }
  }, 120_000);
});
