/**
 * engine-runner — the ENGINE half of the interaction goldens: one script of acts over a frozen world, walked
 * against the real engine through the camera contract's own doors.
 *
 * The runner boots each surface's world through `bootTestWiki` (the RootTemplate set to the script's root, the
 * story list set), mounts the projection with a RECORDING post (every `lar:frame` and every
 * `lar:control-result` the island sends), and walks the steps in the vocabulary the README beside it names.
 * Every act, sense and resend crosses the projection cap's own door (`hasProjection().onSignal`), so the
 * fail-closed reader and the routing stand inside the walk, never beside it.
 *
 * What the engine half reads, and what it leaves to the page half:
 *
 *   - `frame`   delivers the mount's first frame, or the newest frame the island emitted since the last delivery.
 *   - `deliver: "older"` records that the frame the island emitted BEFORE the last sense carries a lower
 *               `sensedRevision` for that sense's control than the sense's `localRev` (the page's veto rests on it).
 *   - `sense` / `act` build a `lar:control-event` against the frame the harness last delivered for that surface:
 *               the control resolves by `data-control-id` or by a selector read off that frame (a tag, classes and
 *               `[attr=value]`, spaces for descendants; a class names its node and the nodes it wraps, since TW5's
 *               checkbox and radio class the label around their input), and the event names the first named node's
 *               render id or its nearest painted ancestor's (the node the act climbs from: the camera's top element
 *               carries one); `checked` rides a toggle; `epoch: "stale"` carries the epoch that surface emitted
 *               before the delivered one.
 *   - `switch`  mounts the arriving surface's engine (first time) and sends it `lar:resend`; the frame the resend
 *               answers becomes the delivered frame.
 *   - `expect`  reads `answers` (the statuses posted since the last expect, in order), `writes` (each named record
 *               stands with those fields, and no title outside the named set took a write since the last expect),
 *               and `frame` (`sensedRevision` keyed back to the script's control names, `surface`, `epoch: "fresh"`,
 *               `contains`, `attributes`: per selector, the attribute the first named node paints, `null` for absent,
 *               and `stamps`: per selector, each named stamp carries every token the script names, `null` none).
 *               `page` belongs to the page half: the run records it as SKIPPED by name. Any other key fails closed,
 *               so a script that grows a verb this half never learned reads red, never green.
 *
 * Time rests on the caller's hand: the caller fakes `setTimeout`, and `advance` moves the coalesce window, so a
 * frame flushes when the script says and never at the machine's speed.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/dreamdom#/conformance
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  LAR_CAMERA_STORY, LAR_CONTROL_EVENT, LAR_KEY_SURFACE, LAR_RESEND,
  mkLarControlEvent, mkLarResend, readLarControlResult, readLarFrame,
  type LarGeometry, type LarKeyChord, type LarModifiers, type LarMsg_ControlResult, type LarMsg_Frame, type LarWholeValue,
} from "@lararium/mesh";
import { mountProjection } from "../../../src/tw5-projection.js";
import { hasProjection } from "../../../src/has-island-watches.js";
import type { IslandContext } from "../../../src/island-context.js";
import type { TW5Engine } from "../../../src/tw5-vm.js";
import { bootTestWiki } from "../../test-wiki.js";

export const GOLDENS_DIR = path.dirname(new URL(import.meta.url).pathname);

export interface GoldenWorld {
  readonly tiddlers: readonly Record<string, string | string[]>[];
  readonly story: readonly string[];
  readonly root: string;
}
export interface GoldenScript {
  readonly golden: string;
  readonly pins: string;
  readonly world?: GoldenWorld;
  readonly surfaces?: Readonly<Record<string, { readonly world: GoldenWorld }>>;
  readonly steps: readonly Record<string, unknown>[];
}

/** Every script beside this runner, by file name: derived from the directory, never enumerated. */
export function goldenScripts(): { file: string; script: GoldenScript }[] {
  return readdirSync(GOLDENS_DIR).filter((f) => /^\d\d-.*\.json$/.test(f)).sort()
    .map((file) => ({ file, script: JSON.parse(readFileSync(path.join(GOLDENS_DIR, file), "utf8")) as GoldenScript }));
}

export interface EngineRun {
  /** Each disagreement between the script and the engine, by step. Empty reads green. */
  readonly failures: string[];
  /** Each step the engine half leaves to another half, by name. */
  readonly skipped: string[];
  /** What the walk did, step by step, for a reader of a red. */
  readonly trace: string[];
}

export interface EngineRunHooks {
  /** Move the faked clock (the coalesce window) and let TW5's change beat settle. */
  readonly advance: () => Promise<void>;
  /** Let TW5's change beat settle with no timer moved (so no frame flushes). */
  readonly settle: () => Promise<void>;
}

interface Surface {
  readonly id: string;
  readonly world: GoldenWorld;
  readonly engine: TW5Engine;
  readonly ctx: IslandContext;
  readonly frames: LarMsg_Frame[];
  /** Titles written since the last expect. */
  written: Set<string>;
  delivered?: LarMsg_Frame;
  stop?: () => void;
}

const ROOT_TEMPLATE = "$:/core/ui/RootTemplate";
const SINGLE = "lar:single";

/** One painted node of a frame, read back off its HTML. */
interface PaintedNode { readonly tag: string; readonly attrs: Readonly<Record<string, string>>; readonly parent: PaintedNode | null }

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const decode = (v: string): string => v.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(quot|amp|lt|gt|apos));/gi, (_m, d, h, n) =>
  d ? String.fromCodePoint(Number(d)) : h ? String.fromCodePoint(parseInt(h, 16)) : ({ quot: "\"", amp: "&", lt: "<", gt: ">", apos: "'" } as Record<string, string>)[n.toLowerCase()]!);

/** The frame's element nodes in document order, each knowing its parent: the reads a script's selector makes. */
function paintedNodes(html: string): PaintedNode[] {
  const nodes: PaintedNode[] = [];
  const open: PaintedNode[] = [];
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
    if (m[2] === undefined) continue;
    const tag = m[2].toLowerCase();
    if (m[1]) {
      const at = open.map((n) => n.tag).lastIndexOf(tag);
      if (at !== -1) open.length = at;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of m[3]!.matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1]!] = decode(a[2] ?? a[3] ?? a[4] ?? "");
    const node: PaintedNode = { tag, attrs, parent: open.at(-1) ?? null };
    nodes.push(node);
    if (!VOID_TAGS.has(tag) && !/\/\s*$/.test(m[3]!)) open.push(node);
  }
  return nodes;
}

/**
 * Whether one compound of a script's selector (`tag`, `.class`, `[attr=value]`, joined) names `node`. A class
 * names the node that carries it and the nodes it wraps: TW5's checkbox and radio set their `class` on the label
 * around the input they bind, so `input.cb` names the input inside `label.cb`.
 */
function compoundNames(compound: string, node: PaintedNode): boolean {
  const m = /^([a-zA-Z][\w-]*)?((?:\.[\w-]+)*)((?:\[[\w-]+(?:=[^\]]*)?\])*)$/.exec(compound);
  if (!m) throw new Error(`the engine half reads no selector compound ${compound}`);
  if (m[1] && m[1].toLowerCase() !== node.tag) return false;
  for (const [, name, value] of m[3]!.matchAll(/\[([\w-]+)(?:=([^\]]*))?\]/g)) {
    const held = node.attrs[name!];
    if (held === undefined || (value !== undefined && held !== value.replace(/^["']|["']$/g, ""))) return false;
  }
  for (const cls of m[2]!.split(".").filter(Boolean)) {
    let carried = false;
    for (let n: PaintedNode | null = node; n && !carried; n = n.parent) carried = (n.attrs["class"] ?? "").split(/\s+/).includes(cls);
    if (!carried) return false;
  }
  return true;
}

/** Every painted node a selector names, in document order: compounds joined by spaces read as descendants. */
function select(nodes: readonly PaintedNode[], selector: string): PaintedNode[] {
  const compounds = selector.trim().split(/\s+/);
  return nodes.filter((node) => {
    if (!compoundNames(compounds.at(-1)!, node)) return false;
    let at = compounds.length - 2;
    for (let n = node.parent; n && at >= 0; n = n.parent) if (compoundNames(compounds[at]!, n)) at -= 1;
    return at < 0;
  });
}

/** A control names a selector when it opens on a class or on a tag that a class or an attribute narrows. */
const isSelector = (control: string): boolean => control.startsWith(".") || /^[a-zA-Z][\w-]*[.[]/.test(control);

/** The render id of the first painted node the control names: `data-control-id="x"`, or a selector the script's root template sets. */
function ridOf(html: string, control: string): string | null {
  const nodes = paintedNodes(html);
  const named = isSelector(control)
    ? select(nodes, control)
    : nodes.filter((n) => n.attrs["data-control-id"] === control);
  // The act names the first named node's own render id, or the nearest painted ancestor's: the node the act climbs
  // from (the camera's top element carries one, so every painted node has a climb).
  for (const node of named) {
    for (let n: PaintedNode | null = node; n; n = n.parent) if (n.attrs["data-lar-rid"] !== undefined) return n.attrs["data-lar-rid"]!;
  }
  return null;
}

const surfaceRev = (f: LarMsg_Frame): number => f.keys.find((k) => k.key === LAR_KEY_SURFACE)?.rev ?? 0;
const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const sortKeys = (o: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).sort(([x], [y]) => x.localeCompare(y)));

/**
 * Walk one script against the engine. Boots every surface up front (a boot under faked timers would hang), and
 * mounts each surface's projection at its first `frame` or `switch`, the way a vessel mounts a camera when a
 * surface opens.
 */
export async function runEngineGolden(script: GoldenScript, hooks: EngineRunHooks): Promise<EngineRun> {
  const failures: string[] = [], skipped: string[] = [], trace: string[] = [];
  const cap = hasProjection();
  const results: LarMsg_ControlResult[] = [];
  let resultsSeen = 0;
  /** The script's control names by the render id each one resolved to, so a frame's keys read back in the script's words. */
  const nameOfRid = new Map<string, string>();
  const surfaces = new Map<string, Surface>();
  const worlds: [string, GoldenWorld][] = script.surfaces
    ? Object.entries(script.surfaces).map(([id, s]) => [id, s.world])
    : [[SINGLE, script.world!]];

  for (const [id, world] of worlds) {
    const engine = await bootTestWiki({ tiddlers: [...world.tiddlers] });
    engine.setTiddler({ title: ROOT_TEMPLATE, type: "text/vnd.tiddlywiki", text: world.root });
    engine.setTiddler({ title: "$:/StoryList", list: [...world.story] });
    const frames: LarMsg_Frame[] = [];
    const surface: Surface = {
      id, world, engine, frames, written: new Set(),
      ctx: {
        wikiUri: `lar:///golden/${id}`,
        tw5: engine,
        post: (msg: unknown) => {
          const frame = readLarFrame(msg);
          if (frame) { frames.push(frame); return; }
          const result = readLarControlResult(msg);
          if (result) { results.push(result); return; }
        },
      } as unknown as IslandContext,
    };
    (engine.$tw as unknown as { wiki: { addEventListener(t: string, h: (c: Record<string, unknown>) => void): void } })
      .wiki.addEventListener("change", (changes) => { for (const t of Object.keys(changes)) surface.written.add(t); });
    surfaces.set(id, surface);
  }
  // The boot's own writes (the root, the story) belong to the world, never to a step.
  await hooks.settle();
  for (const s of surfaces.values()) s.written.clear();

  let current: Surface = surfaces.values().next().value!;
  const lastSense: { rid?: string; name?: string; localRev?: number; framesBefore?: number; surface?: Surface } = {};
  let eventSeq = 0;

  const surfaceOf = (step: Record<string, unknown>, body?: Record<string, unknown>): Surface => {
    const named = (body?.["surface"] ?? step["surface"]) as string | undefined;
    if (named === undefined) return current;
    const s = surfaces.get(named);
    if (!s) throw new Error(`no surface named ${named}`);
    return s;
  };
  const mount = async (s: Surface): Promise<void> => {
    if (s.stop) return;
    s.stop = mountProjection(s.ctx);
    await hooks.advance();
  };
  /** The epoch this surface emitted just before the one it last delivered. */
  const staleEpoch = (s: Surface): number | undefined => {
    const epochs = [...new Set(s.frames.map((f) => f.mountEpoch))];
    const at = epochs.indexOf(s.delivered?.mountEpoch ?? -1);
    return at > 0 ? epochs[at - 1] : undefined;
  };
  const send = (s: Surface, kind: "lar:act" | "lar:sense", body: Record<string, unknown>, at: string): string | null => {
    const frame = s.delivered;
    if (!frame) { failures.push(`${at}: no frame delivered on ${s.id} to act against`); return null; }
    const html = frame.keys.find((k) => k.key === LAR_KEY_SURFACE)?.html ?? "";
    const control = String(body["control"]);
    const rid = ridOf(html, control);
    if (!rid) { failures.push(`${at}: control ${control} paints no render id on ${s.id}`); return null; }
    nameOfRid.set(rid, control);
    const epoch = body["epoch"] === "stale" ? staleEpoch(s) : frame.mountEpoch;
    if (epoch === undefined) { failures.push(`${at}: ${s.id} emitted no earlier epoch to carry as stale`); return null; }
    const ev = mkLarControlEvent({
      eventId: `golden-${++eventSeq}`, cameraId: frame.cameraId, mountEpoch: epoch, kind,
      renderId: rid,
      action: kind === "lar:sense" ? "lar:sense" : String(body["action"]),
      seenFrameRev: surfaceRev(frame),
      ...(body["localRev"] !== undefined ? { localRev: Number(body["localRev"]) } : {}),
      ...(body["wholeValue"] !== undefined ? { wholeValue: body["wholeValue"] as LarWholeValue } : {}),
      ...(body["checked"] !== undefined ? { checked: Boolean(body["checked"]) } : {}),
      ...(body["modifiers"] !== undefined ? { modifiers: body["modifiers"] as LarModifiers } : {}),
      ...(body["key"] !== undefined ? { key: body["key"] as LarKeyChord } : {}),
      ...(body["geometry"] !== undefined ? { geometry: body["geometry"] as LarGeometry } : {}),
    });
    if (!cap.onSignal!(LAR_CONTROL_EVENT, ev, s.ctx)) failures.push(`${at}: the projection cap left ${LAR_CONTROL_EVENT} unclaimed`);
    trace.push(`${at}: ${kind} ${ev.action} ${control}→${rid} epoch=${epoch}${body["epoch"] === "stale" ? " (stale)" : ""}`);
    return rid;
  };

  try {
    for (const [index, step] of script.steps.entries()) {
      const at = `step ${index + 1}`;
      if ("frame" in step) {
        const s = surfaceOf(step);
        await mount(s);
        current = s;
        if (step["frame"] === "first") {
          if (!s.frames[0]) { failures.push(`${at}: ${s.id} emitted no first frame`); continue; }
          s.delivered = s.frames[0];
        } else {
          await hooks.advance();
          const from = s.delivered ? s.frames.indexOf(s.delivered) + 1 : 0;
          const next = s.frames.slice(from).at(-1);
          if (!next) { failures.push(`${at}: ${s.id} emitted no frame after the one delivered`); continue; }
          s.delivered = next;
        }
        trace.push(`${at}: deliver ${s.id} frame epoch=${s.delivered.mountEpoch} surfaceRev=${surfaceRev(s.delivered)} sensed=${JSON.stringify(s.delivered.sensedRevision)}`);
      } else if ("deliver" in step) {
        if (step["deliver"] !== "older") { failures.push(`${at}: the engine half knows no delivery "${String(step["deliver"])}"`); continue; }
        const s = lastSense.surface;
        if (!s || lastSense.rid === undefined || lastSense.localRev === undefined) { failures.push(`${at}: no sense precedes an older delivery`); continue; }
        const older = s.frames[(lastSense.framesBefore ?? 0) - 1];
        if (!older) { failures.push(`${at}: ${s.id} emitted no frame before the sense`); continue; }
        const sensed = older.sensedRevision[lastSense.rid];
        if (sensed !== undefined && sensed >= lastSense.localRev) {
          failures.push(`${at}: the frame rendered before the sense names sensedRevision ${sensed} for ${lastSense.name}, not below the sense's localRev ${lastSense.localRev}`);
        }
        trace.push(`${at}: older frame (surfaceRev=${surfaceRev(older)}) names ${lastSense.name} at ${sensed ?? "none"} < localRev ${lastSense.localRev}`);
      } else if ("sense" in step) {
        const body = step["sense"] as Record<string, unknown>;
        const s = surfaceOf(step, body);
        const framesBefore = s.frames.length;
        const rid = send(s, "lar:sense", body, at);
        await hooks.settle();
        if (rid) Object.assign(lastSense, { rid, name: String(body["control"]), localRev: Number(body["localRev"]), framesBefore, surface: s });
      } else if ("act" in step) {
        const body = step["act"] as Record<string, unknown>;
        send(surfaceOf(step, body), "lar:act", body, at);
        await hooks.settle();
      } else if ("switch" in step) {
        const body = step["switch"] as Record<string, unknown>;
        const s = surfaceOf(step, body);
        await mount(s);
        const before = s.frames.length;
        if (!cap.onSignal!(LAR_RESEND, mkLarResend(LAR_CAMERA_STORY), s.ctx)) failures.push(`${at}: the projection cap left ${LAR_RESEND} unclaimed`);
        await hooks.advance();
        current = s;
        const answer = s.frames.slice(before).at(-1);
        if (!answer) { failures.push(`${at}: ${s.id} answered lar:resend with no frame`); continue; }
        s.delivered = answer;
        trace.push(`${at}: switch → ${s.id}, resend answered epoch=${answer.mountEpoch} keys=${answer.keys.map((k) => k.key).join(",")}`);
      } else if ("expect" in step) {
        const expect = step["expect"] as Record<string, unknown>;
        for (const [key, want] of Object.entries(expect)) {
          if (key === "page") { skipped.push(`${at}: expect.page (the page half)`); continue; }
          if (key === "answers") {
            const got = results.slice(resultsSeen).map((r) => r.status === "refused" ? `refused:${r.reason}` : r.status);
            if (!deepEqual(got, want)) failures.push(`${at}: answers ${JSON.stringify(got)}, the script expects ${JSON.stringify(want)}`);
            continue;
          }
          if (key === "writes") {
            const records = want as Record<string, string>[];
            const expected = new Set(records.map((r) => r.title));
            const written = [...surfaces.values()].flatMap((s) => [...s.written]);
            const stray = written.filter((t) => !expected.has(t));
            if (stray.length) failures.push(`${at}: writes landed on ${JSON.stringify(stray)}, outside the script's ${JSON.stringify([...expected])}`);
            for (const record of records) {
              const holder = [...surfaces.values()].find((s) => s.world.tiddlers.some((t) => t["title"] === record.title)) ?? current;
              const fields = (holder.engine.$tw as unknown as { wiki: { getTiddler(t: string): { fields: Record<string, unknown> } | undefined } })
                .wiki.getTiddler(record.title)?.fields;
              for (const [field, value] of Object.entries(record)) {
                if (field === "title") continue;
                if (!deepEqual(fields?.[field], value)) failures.push(`${at}: ${record.title} holds ${field}=${JSON.stringify(fields?.[field])}, the script expects ${JSON.stringify(value)}`);
              }
            }
            continue;
          }
          if (key === "frame") {
            const w = want as Record<string, unknown>;
            const s = w["surface"] !== undefined ? surfaces.get(String(w["surface"])) : current;
            const frame = s?.delivered;
            if (!s || !frame) { failures.push(`${at}: no frame delivered on ${String(w["surface"] ?? current.id)}`); continue; }
            if (w["surface"] !== undefined && current !== s) failures.push(`${at}: the delivered frame belongs to ${current.id}, the script expects ${String(w["surface"])}`);
            for (const [fk, fv] of Object.entries(w)) {
              if (fk === "surface") continue;
              if (fk === "sensedRevision") {
                const named = sortKeys(Object.fromEntries(Object.entries(frame.sensedRevision).map(([id, rev]) => [nameOfRid.get(id) ?? id, rev])));
                if (!deepEqual(named, sortKeys(fv as Record<string, unknown>))) failures.push(`${at}: the frame names sensedRevision ${JSON.stringify(named)}, the script expects ${JSON.stringify(fv)}`);
              } else if (fk === "epoch" && fv === "fresh") {
                const earlier = s.frames.slice(0, s.frames.indexOf(frame)).map((f) => f.mountEpoch);
                if (earlier.length === 0) failures.push(`${at}: ${s.id}'s delivered frame stands alone; no earlier epoch to read it fresh against`);
                else if (!earlier.every((e) => frame.mountEpoch > e)) failures.push(`${at}: ${s.id}'s frame carries epoch ${frame.mountEpoch}, not fresh against ${JSON.stringify([...new Set(earlier)])}`);
              } else if (fk === "stamps") {
                const painted = paintedNodes(frame.keys.find((k) => k.key === LAR_KEY_SURFACE)?.html ?? "");
                for (const [selector, stamps] of Object.entries(fv as Record<string, Record<string, string | null>>)) {
                  const node = select(painted, selector)[0];
                  if (!node) { failures.push(`${at}: the frame paints no ${selector}`); continue; }
                  for (const [name, wantStamp] of Object.entries(stamps)) {
                    const got = node.attrs[name];
                    if (wantStamp === null) { if (got !== undefined) failures.push(`${at}: ${selector} carries ${name}="${got}", the script expects none`); continue; }
                    const tokens = new Set((got ?? "").split(/\s+/).filter(Boolean));
                    const missing = wantStamp.split(/\s+/).filter((t) => t && !tokens.has(t));
                    if (got === undefined || missing.length) failures.push(`${at}: ${selector} carries ${name}=${got === undefined ? "none" : `"${got}"`}, the script expects "${wantStamp}"`);
                  }
                }
              } else if (fk === "contains") {
                const html = frame.keys.find((k) => k.key === LAR_KEY_SURFACE)?.html ?? "";
                if (!html.includes(String(fv))) failures.push(`${at}: the frame paints no ${JSON.stringify(fv)}`);
              } else if (fk === "attributes") {
                const painted = paintedNodes(frame.keys.find((k) => k.key === LAR_KEY_SURFACE)?.html ?? "");
                for (const [selector, named] of Object.entries(fv as Record<string, Record<string, string | null>>)) {
                  const node = select(painted, selector)[0];
                  if (!node) { failures.push(`${at}: the frame paints no ${selector}`); continue; }
                  for (const [attr, value] of Object.entries(named)) {
                    const held = node.attrs[attr] ?? null;
                    if (held !== value) failures.push(`${at}: the frame paints ${selector} ${attr}=${JSON.stringify(held)}, the script expects ${JSON.stringify(value)}`);
                  }
                }
              } else {
                failures.push(`${at}: the engine half reads no frame.${fk}`);
              }
            }
            continue;
          }
          failures.push(`${at}: the engine half reads no expect.${key}`);
        }
        resultsSeen = results.length;
        for (const s of surfaces.values()) s.written.clear();
      } else {
        failures.push(`${at}: the engine half knows no verb ${Object.keys(step).join(",")}`);
      }
    }
  } finally {
    for (const s of surfaces.values()) { s.stop?.(); s.engine.dispose(); }
  }
  return { failures, skipped, trace };
}
