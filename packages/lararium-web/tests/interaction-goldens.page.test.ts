/**
 * interaction-goldens.page.test — THE PAGE HALF OF THE INTERACTION GOLDENS, over the real sink in real Chromium.
 *
 * One script file runs on every harness (`packages/lararium-tw5/tests/goldens/interaction/README.md`); this file
 * reads the scripts copied beside it and walks their steps against `createProjectionSink`.
 *
 * THE ENGINE HALF STANDS IN. No TiddlyWiki runs here. `StandInIsland` hand-renders the script's world the way the
 * island would emit it — one `lar:surface` key holding the root template's HTML with `data-lar-rid` stamps, an
 * empty `lar:style` key, a `lar:membership` key, a mount epoch it mints at mount and on every `lar:resend`, and
 * the `sensedRevision` it took in — and it answers acts the way the contract says an island must (`applied`, or
 * `stale-target` for an act under another epoch, touching nothing). It knows the widgets these scripts name
 * (`$edit-text`, `$button set= setTo=`, `$checkbox`, `$radio`, `$select`), each painted in TW5's own shape (a
 * checkbox and a radio class the label around their input) with its state as attributes. What this file proves
 * belongs to the PAGE: what the sink paints, keeps and relays. The island's own claims ride the engine harness,
 * the declared-cancellation stamps among them (`frame.stamps` reads there; the stand-in paints none).
 *
 * Steps: `frame` asks the stand-in for its next frame; `deliver: older` applies the frame the stand-in rendered
 * BEFORE taking in the last sense (a newer key revision, a lower sensed revision for that control); `sense` makes
 * a real edit (`execCommand("insertText")`, so a real input event and a real undo step; on a select, the
 * person's options chosen and a real `input`) and reads the relayed event; `act` makes a real click, a real
 * commit, a real click on a toggle (`lar:toggle`) or a real choice and `change` (`lar:choice`), reads the
 * relayed event and feeds the stand-in's answer back through `applyResult`; `switch` sends `lar:resend` to the arriving surface and applies its first frame under a
 * fresh epoch; `expect` reads the page (`value`, `text`, `undoDepth`, `focus`), the last frame (its
 * `attributes` read off the PAINTED node: `checked` and `selected` by the live state the page shows, any other
 * attribute by its value), the answers and the stand-in's writes since the previous `expect`. A control or a
 * selector names its node the way the engine half reads it: a class names its node and the nodes it wraps.
 *
 * `act` with `epoch: "stale"` re-enacts the race the script names: the person acted while the page still showed
 * the arriving surface's PREVIOUS mount (for a surface never shown before, its mount-time frame stands in), and
 * the act reached the island after the resend. The runner paints that earlier frame, makes the real click, then
 * paints the current mount again before the answer lands, and checks the relayed event carried the old epoch.
 */
import { describe, expect, test } from "vitest";
import {
  LAR_CAMERA_STORY, LAR_FRAME, LAR_KEY_MEMBERSHIP, LAR_KEY_STYLE, LAR_KEY_SURFACE,
  mkLarControlResult, type LarMsg_ControlEvent, type LarMsg_ControlResult,
} from "../../lararium-mesh/src/lar-camera.js";
import { createProjectionSink, type LarSurfaceFrame } from "../src/projection-sink.js";
import script03 from "./goldens/interaction/03-edit-body-survives-blur.json";
import script06 from "./goldens/interaction/06-toggle-checkbox-radio-select-multiselect.json";
import script13 from "./goldens/interaction/13-switch-resend-and-epoch.json";

type Fields = Record<string, string | string[]>;
interface World { readonly tiddlers: ReadonlyArray<Fields>; readonly story: readonly string[]; readonly root: string }
type Step = Record<string, unknown>;
interface Script { readonly golden: string; readonly pins: string; readonly world?: World; readonly surfaces?: Record<string, { world: World }>; readonly steps: readonly Step[] }

/** A widget the stand-in renders: its class names the control in the script, its render id names it on the wire. */
interface Widget {
  readonly rid: string; readonly cls: string; readonly kind: "edit-text" | "button" | "checkbox" | "radio" | "select";
  readonly attrs: Record<string, string>; readonly label: string;
  /** A select's options, by value and label. */
  readonly options: ReadonlyArray<{ value: string; label: string }>;
}

let epochCounter = 0;
const mintEpoch = (): number => ++epochCounter;
const escapeHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attrsOf = (src: string): Record<string, string> => Object.fromEntries([...src.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));

/** The engine half, standing in: a hand renderer of the widgets these scripts name. */
class StandInIsland {
  readonly store = new Map<string, Fields>();
  readonly widgets: Widget[] = [];
  readonly writes: Array<Fields> = [];
  readonly sensed = new Map<string, { value?: string; localRev: number }>();
  epoch = mintEpoch();
  previousEpochFrame: LarSurfaceFrame;
  older: LarSurfaceFrame | null = null;
  current: LarSurfaceFrame;
  private rev = 0;

  constructor(readonly surface: string, world: World) {
    for (const t of world.tiddlers) this.store.set(String(t["title"]), { ...t });
    let n = 0;
    const tags = /<\$(edit-text|checkbox|radio)([^>]*?)\/>|<\$(button|select)([^>]*)>([\s\S]*?)<\/\$\3>/g;
    for (const m of world.root.matchAll(tags)) {
      const kind = (m[1] ?? m[3]) as Widget["kind"];
      const attrs = attrsOf(m[2] ?? m[4] ?? "");
      const options = kind === "select" ? [...(m[5] ?? "").matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map((o) => ({ value: o[1]!, label: o[2]! })) : [];
      this.widgets.push({ rid: `${surface}-r${++n}`, cls: attrs["class"] ?? "", kind, attrs, label: kind === "button" ? m[5] ?? "" : "", options });
    }
    // The pool mounts every surface at boot; the gate drops its frames until the vessel shows it.
    this.current = this.render();
    this.previousEpochFrame = this.current;
  }

  ridOf(cls: string): string {
    const w = this.widgets.find((x) => `.${x.cls}` === cls);
    if (!w) throw new Error(`stand-in: no widget carries ${cls}`);
    return w.rid;
  }

  /** The field a widget binds, as the store holds it. */
  read(w: Widget): string | string[] | undefined {
    return this.store.get(w.attrs["tiddler"] ?? "")?.[w.attrs["field"] ?? "text"];
  }

  render(): LarSurfaceFrame {
    const html = this.widgets.map((w) => {
      if (w.kind === "button") return `<button class="${escapeHtml(w.cls)}" data-lar-rid="${w.rid}">${escapeHtml(w.label)}</button>`;
      if (w.kind === "checkbox" || w.kind === "radio") {
        const on = this.read(w) === (w.kind === "checkbox" ? w.attrs["checked"] : w.attrs["value"]);
        return `<label class="tc-${w.kind} ${escapeHtml(w.cls)}"><input type="${w.kind}" data-lar-rid="${w.rid}"${on ? ' checked="checked"' : ""}><span></span></label>`;
      }
      if (w.kind === "select") {
        const held = this.read(w);
        const keys = Array.isArray(held) ? held : held === undefined ? [] : [held];
        const multiple = w.attrs["multiple"] === "yes";
        const opts = w.options.map((o) => `<option value="${escapeHtml(o.value)}"${keys.includes(o.value) ? ' selected="selected"' : ""}>${escapeHtml(o.label)}</option>`).join("");
        return `<select class="${escapeHtml(w.cls)}" data-lar-rid="${w.rid}"${multiple ? ' multiple="multiple"' : ""}>${opts}</select>`;
      }
      const sensed = this.sensed.get(w.rid);
      const value = sensed?.value ?? this.store.get(w.attrs["tiddler"] ?? "")?.["text"] ?? "";
      return `<${w.attrs["tag"] ?? "input"} class="${escapeHtml(w.cls)}" data-lar-rid="${w.rid}">${escapeHtml(value)}</${w.attrs["tag"] ?? "input"}>`;
    }).join("");
    this.rev += 1;
    const frame: LarSurfaceFrame = {
      type: LAR_FRAME, wikiUri: `lar:///golden/${this.surface}`, cameraId: LAR_CAMERA_STORY, mountEpoch: this.epoch, surface: this.surface,
      keys: [
        { key: LAR_KEY_SURFACE, rev: this.rev, html },
        { key: LAR_KEY_STYLE, rev: 1, css: "" },
        { key: LAR_KEY_MEMBERSHIP, rev: 1, members: [LAR_KEY_SURFACE, LAR_KEY_STYLE] },
      ],
      sensedRevision: Object.fromEntries([...this.sensed].map(([cid, s]) => [cid, s.localRev])),
    };
    this.current = frame;
    return frame;
  }

  /** `lar:resend`: a fresh epoch, every key whole, revisions counted afresh. */
  resend(): LarSurfaceFrame {
    this.previousEpochFrame = this.current;
    this.epoch = mintEpoch();
    this.rev = 0;
    return this.render();
  }

  /** Take in one control event; answer every reliable one. */
  receive(ev: LarMsg_ControlEvent): LarMsg_ControlResult | null {
    const cid = ev.controlId ?? ev.renderId ?? "";
    if (ev.kind === "lar:sense") {
      // Before taking the sense in, the island had rendered a frame that is still in flight: the older one.
      this.older = this.render();
      const held = this.sensed.get(cid);
      const textual = typeof ev.wholeValue === "string";
      if (!held || (ev.localRev ?? 0) > held.localRev) this.sensed.set(cid, { ...(textual ? { value: ev.wholeValue as string } : {}), localRev: ev.localRev ?? 0 });
      return null;
    }
    const answer = (status: LarMsg_ControlResult["status"]): LarMsg_ControlResult =>
      mkLarControlResult({ eventId: ev.eventId, cameraId: ev.cameraId, mountEpoch: this.epoch, ...(ev.renderId ? { renderId: ev.renderId } : {}), ...(ev.controlId ? { controlId: ev.controlId } : {}), status });
    if (ev.mountEpoch !== this.epoch) return answer("stale-target");
    const w = this.widgets.find((x) => x.rid === cid);
    if (!w) return answer("stale-target");
    const write = (title: string, field: string, value: string | string[]): void => {
      this.store.set(title, { ...this.store.get(title), title, [field]: value });
      this.writes.push({ title, [field]: value });
    };
    if (w.kind === "button" && ev.action === "lar:click" && w.attrs["set"] !== undefined) {
      write(w.attrs["set"], "text", w.attrs["setTo"] ?? "");
    } else if (w.kind === "edit-text" && ev.action === "lar:commit" && typeof ev.wholeValue === "string") {
      write(w.attrs["tiddler"] ?? "", "text", ev.wholeValue);
      if (ev.localRev !== undefined) this.sensed.set(cid, { value: ev.wholeValue, localRev: ev.localRev });
    } else if ((w.kind === "checkbox" || w.kind === "radio") && ev.action === "lar:toggle" && typeof ev.checked === "boolean") {
      const value = w.kind === "checkbox" ? w.attrs[ev.checked ? "checked" : "unchecked"] : ev.checked ? w.attrs["value"] : undefined;
      if (value !== undefined && this.read(w) !== value) write(w.attrs["tiddler"] ?? "", w.attrs["field"] ?? "text", value);
      if (ev.localRev !== undefined) this.sensed.set(cid, { localRev: ev.localRev });
    } else if (w.kind === "select" && ev.action === "lar:choice" && Array.isArray(ev.wholeValue)) {
      const keys = [...(ev.wholeValue as readonly string[])];
      write(w.attrs["tiddler"] ?? "", w.attrs["field"] ?? "text", w.attrs["multiple"] === "yes" ? keys : keys[0] ?? "");
      if (ev.localRev !== undefined) this.sensed.set(cid, { localRev: ev.localRev });
    }
    return answer("applied");
  }
}

/** A selector in the wrap reading: `input.cb` names the input inside the node classed `cb` (TW5 classes the label). */
const wrapped = (selector: string): string =>
  selector.split(/\s+/).map((c) => /^([a-zA-Z][\w-]*)((?:\.[\w-]+)+)(.*)$/.exec(c)).map((m, i) => m ? `${m[2]} ${m[1]}${m[3]}` : selector.split(/\s+/)[i]!).join(" ");

/** Count the undo steps the field holds, then put every one back: undo until the value stops moving, redo as many. */
function undoDepth(field: HTMLTextAreaElement | HTMLInputElement): number {
  field.focus();
  let depth = 0;
  for (let last = field.value; depth < 64; depth += 1) {
    document.execCommand("undo");
    if (field.value === last) break;
    last = field.value;
  }
  for (let i = 0; i < depth; i += 1) document.execCommand("redo");
  return depth;
}

async function run(script: Script): Promise<void> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const sink = createProjectionSink(host, { inputMaxChars: 4096 });
  const sent: Array<{ surface: string; ev: LarMsg_ControlEvent }> = [];
  sink.arm({ sendControlEvent: (surface, ev) => { sent.push({ surface, ev }); } });
  const root = host.shadowRoot!;
  const pane = (): HTMLElement => root.querySelector<HTMLElement>(".lar-projection")!;

  const worlds: Record<string, World> = script.surfaces
    ? Object.fromEntries(Object.entries(script.surfaces).map(([id, s]) => [id, s.world]))
    : { main: script.world! };
  const islands = new Map(Object.entries(worlds).map(([id, w]) => [id, new StandInIsland(id, w)]));
  const island = (id: string): StandInIsland => islands.get(id) ?? (() => { throw new Error(`no surface ${id}`); })();
  let shown = script.surfaces ? Object.keys(worlds)[0]! : "main";
  const epochsDelivered = new Map<string, number[]>();
  let lastFrame: LarSurfaceFrame | null = null;
  let freshAtLast = false;
  let answers: string[] = [];
  let writesSeen = 0;

  const deliver = (frame: LarSurfaceFrame): void => {
    const seen = epochsDelivered.get(frame.surface) ?? [];
    freshAtLast = !seen.includes(frame.mountEpoch);
    epochsDelivered.set(frame.surface, [...seen, frame.mountEpoch]);
    lastFrame = frame;
    expect(sink.apply(frame), `the sink paints the ${frame.surface} frame at revision ${frame.keys[0]!.rev}`).toBe("painted");
  };
  const el = (control: string): HTMLElement => {
    const found = pane().querySelector<HTMLElement>(control) ?? pane().querySelector<HTMLElement>(wrapped(control));
    if (!found) throw new Error(`the page shows no ${control}`);
    return found;
  };
  /** Choose exactly the options a key set names, the way a person leaves a select. */
  const choose = (select: HTMLSelectElement, keys: readonly string[]): void => {
    select.focus();
    for (const option of select.options) option.selected = keys.includes(option.value);
  };
  const relayedSince = (mark: number): LarMsg_ControlEvent => {
    expect(sent.length, "the page relayed one control event").toBe(mark + 1);
    return sent[mark]!.ev;
  };
  const answer = (ev: LarMsg_ControlEvent, surface: string): void => {
    const result = island(surface).receive(ev);
    if (!result) return;
    answers.push(result.status);
    sink.applyResult(result);
    const words = [...root.querySelectorAll<HTMLOutputElement>('output[role="status"]')].filter((o) => o.dataset["larFor"] === (ev.controlId ?? ev.renderId));
    if (result.status === "stale-target") {
      // The page half of a stale answer: the canon's words stand beside the control the person acted on.
      expect(words.map((o) => o.textContent)).toEqual(["This control changed before your action arrived. Review it and try again."]);
    } else {
      expect(words, "an applied answer leaves no refusal standing beside its control").toEqual([]);
    }
  };

  for (const step of script.steps) {
    if ("frame" in step) {
      const surface = (step["surface"] as string | undefined) ?? shown;
      shown = surface;
      deliver(island(surface).render());
    } else if ("deliver" in step) {
      const older = island(shown).older;
      expect(older, "the stand-in holds a frame rendered before the last sense").not.toBeNull();
      deliver(older!);
    } else if ("sense" in step && el((step["sense"] as { control: string }).control) instanceof HTMLSelectElement) {
      const s = step["sense"] as { control: string; wholeValue: string[]; localRev: number };
      const select = el(s.control) as HTMLSelectElement;
      const mark = sent.length;
      choose(select, s.wholeValue);
      select.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      const ev = relayedSince(mark);
      expect([ev.kind, ev.action, ev.wholeValue, ev.localRev]).toEqual(["lar:sense", "lar:sense", s.wholeValue, s.localRev]);
      answer(ev, shown);
    } else if ("sense" in step) {
      const s = step["sense"] as { control: string; wholeValue: string; localRev: number };
      const field = el(s.control) as HTMLTextAreaElement;
      field.focus();
      const mark = sent.length;
      if (s.wholeValue.startsWith(field.value)) {
        field.setSelectionRange(field.value.length, field.value.length);
        document.execCommand("insertText", false, s.wholeValue.slice(field.value.length));
      } else {
        field.select();
        document.execCommand("insertText", false, s.wholeValue);
      }
      const ev = relayedSince(mark);
      expect([ev.kind, ev.wholeValue, ev.localRev]).toEqual(["lar:sense", s.wholeValue, s.localRev]);
      answer(ev, shown);
    } else if ("act" in step) {
      const a = step["act"] as { control: string; action: string; wholeValue?: string | string[]; checked?: boolean; localRev?: number; epoch?: string; surface?: string };
      const surface = a.surface ?? shown;
      const isl = island(surface);
      const current = isl.current;
      if (a.epoch === "stale") sink.apply(isl.previousEpochFrame);    // the page as it stood when the person acted
      const mark = sent.length;
      const target = el(a.control);
      if (a.action === "lar:commit") {
        target.blur();
        if (sent.length === mark) target.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      } else if (a.action === "lar:choice") {
        const select = target as HTMLSelectElement;
        if (JSON.stringify([...select.selectedOptions].map((o) => o.value)) !== JSON.stringify(a.wholeValue)) choose(select, a.wholeValue as string[]);
        select.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      } else if (a.action === "lar:toggle") {
        const toggle = target as HTMLInputElement;
        expect(toggle.checked, `${a.control} stands opposite the state the person makes`).toBe(!a.checked);
        toggle.click();
        expect(toggle.checked, `${a.control} holds the state the person made: the browser's default stood`).toBe(a.checked);
      } else {
        target.click();
      }
      const ev = relayedSince(mark);
      expect([ev.kind, ev.action]).toEqual(["lar:act", a.action]);
      if (a.wholeValue !== undefined) expect(ev.wholeValue).toEqual(a.wholeValue);
      if (a.checked !== undefined) expect(ev.checked, `${a.control} carries checked`).toBe(a.checked);
      if (a.localRev !== undefined) expect(ev.localRev, `${a.control} carries its revision`).toBe(a.localRev);
      if (a.epoch === "stale") {
        expect(ev.mountEpoch, "the late act carries the epoch the page showed when the person acted").toBe(isl.previousEpochFrame.mountEpoch);
        expect(ev.mountEpoch).not.toBe(isl.epoch);
        sink.apply(current);                                            // the resend's frame lands before the answer
      } else {
        expect(ev.mountEpoch).toBe(isl.epoch);
      }
      answer(ev, surface);
    } else if ("switch" in step) {
      const to = (step["switch"] as { surface: string }).surface;
      shown = to;
      deliver(island(to).resend());
    } else if ("expect" in step) {
      const want = step["expect"] as { page?: Record<string, unknown>; frame?: Record<string, unknown>; answers?: string[]; writes?: unknown[] };
      if (want.page) {
        for (const [key, spec] of Object.entries(want.page)) {
          if (key === "surface") { expect(sink.surface()).toBe(spec); continue; }
          const node = el(key) as HTMLTextAreaElement;
          if (node instanceof HTMLSelectElement && (spec as { value?: string }).value !== undefined) {
            expect(node.value, `${key} value`).toBe((spec as { value: string }).value);
            continue;
          }
          const s = spec as { value?: string; text?: string; undoDepth?: number; focus?: boolean };
          if (s.value !== undefined) expect(node.value, `${key} value`).toBe(s.value);
          if (s.text !== undefined) expect(node.textContent, `${key} text`).toBe(s.text);
          if (s.undoDepth !== undefined) expect(undoDepth(node), `${key} undo depth`).toBe(s.undoDepth);
          if (s.focus !== undefined) expect(root.activeElement === node, `${key} focus`).toBe(s.focus);
        }
      }
      if (want.frame) {
        const f = lastFrame!;
        if (want.frame["surface"] !== undefined) expect(f.surface).toBe(want.frame["surface"]);
        if (want.frame["epoch"] === "fresh") expect(freshAtLast, "the frame carries a mount epoch this surface never showed").toBe(true);
        for (const key of Object.keys(want.frame)) {
          if (!["surface", "epoch", "sensedRevision", "attributes", "stamps"].includes(key)) throw new Error(`the page harness reads no frame.${key}`);
        }
        // The stamps are the island's own claim: the engine half reads them, and the stand-in paints none.
        for (const [selector, named] of Object.entries((want.frame["attributes"] ?? {}) as Record<string, Record<string, string | null>>)) {
          const node = el(selector);
          for (const [attr, value] of Object.entries(named)) {
            if (attr === "checked" || attr === "selected") {
              expect((node as HTMLInputElement & HTMLOptionElement)[attr], `${selector} shows ${attr}`).toBe(value !== null);
            } else {
              expect(node.getAttribute(attr), `${selector} ${attr}`).toBe(value);
            }
          }
        }
        if (want.frame["sensedRevision"] !== undefined) {
          const named = Object.fromEntries(Object.entries(want.frame["sensedRevision"] as Record<string, number>).map(([cls, rev]) => [island(f.surface).ridOf(cls), rev]));
          expect(f.sensedRevision).toEqual(named);
        }
      }
      if (want.answers) { expect(answers).toEqual(want.answers); }
      answers = [];
      if (want.writes) {
        const writes = [...islands.values()].flatMap((i) => i.writes);
        expect(writes.slice(writesSeen)).toEqual(want.writes);
        writesSeen = writes.length;
      }
    } else {
      throw new Error(`the page harness reads no verb in ${JSON.stringify(step)}`);
    }
  }
  host.remove();
}

describe("★ interaction goldens, the page half ★", () => {
  test(`03 · ${script03.pins}`, async () => { await run(script03 as unknown as Script); });
  test(`06 · ${script06.pins}`, async () => { await run(script06 as unknown as Script); });
  test(`13 · ${script13.pins}`, async () => { await run(script13 as unknown as Script); });

  test("NONSENSE CONTROL: a script whose expectation contradicts the page reds", async () => {
    const broken = structuredClone(script03) as unknown as { steps: Step[] };
    broken.steps[4] = { expect: { page: { ".body": { value: "first" } } } };     // claims the older frame repainted the edit
    await expect(run(broken as unknown as Script)).rejects.toThrow(/\.body value/);
  });
});
