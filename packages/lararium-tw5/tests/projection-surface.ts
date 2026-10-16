/**
 * projection-surface — one mounted story camera over a real booted wiki, with a RECORDING post, for the
 * projection vectors.
 *
 * Every vector here asks a live TW5 widget tree, never a hand-built fake node: a unit fake without the live
 * shape hides the defect (working-procedures#/instruments-that-lie). The surface records each `lar:frame` and
 * each `lar:control-result` the island posts, and every other post beside them, so a vector can read what the
 * island sent and what it did not.
 *
 * Time rests on the vector's hand: `setTimeout` stands faked once the wiki boots, and `flush` moves the coalesce
 * window, so a frame lands when the vector says.
 */
import { vi } from "vitest";
import {
  LAR_KEY_SURFACE, mkLarControlEvent, readLarControlResult, readLarFrame,
  type LarMsg_ControlEvent, type LarMsg_ControlResult, type LarMsg_Frame,
} from "@lararium/mesh";
import { mountProjection } from "../src/tw5-projection.js";
import type { IslandContext } from "../src/island-context.js";
import { bootTestWiki } from "./test-wiki.js";

export interface LooseWiki {
  getTiddler(title: string): { fields: Record<string, unknown> } | undefined;
  addTiddler(fields: Record<string, unknown>): void;
}

export const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise<void>((resolve) => process.nextTick(resolve)); };

/** The render id of the first painted node wearing class `cls`. */
export function ridOfClass(html: string, cls: string): string {
  const tag = [...html.matchAll(/<[a-zA-Z][\w-]*\b[^>]*>/g)].map((m) => m[0]).find((t) => new RegExp(`class="[^"]*(?<![\\w-])${cls}(?![\\w-])`).test(t));
  if (!tag) throw new Error(`no projected node of class ${cls}`);
  const rid = tag.match(/data-lar-rid="([^"]+)"/);
  if (!rid) throw new Error(`the ${cls} node carries no render-id`);
  return rid[1]!;
}

export const htmlOf = (frame: LarMsg_Frame): string => frame.keys.find((k) => k.key === LAR_KEY_SURFACE)?.html ?? "";
export const keyOf = (frame: LarMsg_Frame, key: string) => frame.keys.find((k) => k.key === key);

export interface Surface {
  readonly wiki: LooseWiki;
  readonly frames: LarMsg_Frame[];
  readonly results: LarMsg_ControlResult[];
  /** Every post that read as neither a frame nor a result. */
  readonly others: unknown[];
  readonly ctx: IslandContext;
  last(): LarMsg_Frame;
  rid(cls: string): string;
  /** A control event against the last frame: its epoch, its surface revision, the node of class `cls`. */
  event(cls: string, e: Partial<LarMsg_ControlEvent> & Pick<LarMsg_ControlEvent, "kind" | "action">): LarMsg_ControlEvent;
  flush(): Promise<void>;
  stop(): void;
}

let seq = 0;

/** Boot a wiki whose root template reads `root`, mount the projection, and deliver its first frame. */
export async function mountSurface(root: string, tiddlers: Array<Record<string, string | string[]>> = [], wikiUri = "lar:///test/projection-surface"): Promise<Surface> {
  const engine = await bootTestWiki({ tiddlers });
  engine.setTiddler({ title: "$:/core/ui/RootTemplate", type: "text/vnd.tiddlywiki", text: root });
  const wiki = (engine.$tw as unknown as { wiki: LooseWiki }).wiki;
  await settle();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const frames: LarMsg_Frame[] = [], results: LarMsg_ControlResult[] = [], others: unknown[] = [];
  const ctx = {
    wikiUri, tw5: engine,
    post: (msg: unknown) => {
      const frame = readLarFrame(msg); if (frame) { frames.push(frame); return; }
      const result = readLarControlResult(msg); if (result) { results.push(result); return; }
      others.push(msg);
    },
  } as unknown as IslandContext;
  const stopProjection = mountProjection(ctx);
  const flush = async (): Promise<void> => { await settle(); vi.advanceTimersByTime(100); await settle(); };
  await flush();
  const surface: Surface = {
    wiki, frames, results, others, ctx, flush,
    last: () => { const f = frames.at(-1); if (!f) throw new Error("the island emitted no frame"); return f; },
    rid: (cls) => ridOfClass(htmlOf(surface.last()), cls),
    event: (cls, e) => {
      const frame = surface.last();
      return mkLarControlEvent({
        eventId: `ev-${++seq}`, cameraId: frame.cameraId, mountEpoch: frame.mountEpoch,
        seenFrameRev: keyOf(frame, LAR_KEY_SURFACE)?.rev ?? 0,
        ...(e.controlId === undefined && e.affordanceId === undefined ? { renderId: e.renderId ?? ridOfClass(htmlOf(frame), cls) } : {}), ...e,
      });
    },
    stop: () => { stopProjection(); engine.dispose(); vi.useRealTimers(); },
  };
  return surface;
}
