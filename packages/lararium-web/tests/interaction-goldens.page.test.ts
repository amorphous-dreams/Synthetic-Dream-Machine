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
 * (`$edit-text`, `$button` with `set=`, `actions=` or `popup=`, `$checkbox`, `$radio`, `$select`, `$reveal
 * type="popup"`, a transcluded tiddler's `[[link]]`, `[ext[label|href]]` and raw HTML, inside a `$navigator` it reads
 * as transparent), each painted in TW5's own shape (a checkbox and a radio class the label around their input)
 * with its state as attributes, every bound node stamped the way the island's per-widget table declares it
 * (`data-lar-on`, `data-lar-cancel`, `data-lar-bubble`, `data-lar-live`), and the camera's top element carrying a
 * render id of its own. A field paints in the seam engine's shape: inside `<lar-field>`, its first value in the
 * native carrier and the store's value in its descriptor (`data-lar-value`, `data-lar-value-rev`); a sense on it
 * writes the store, as TW5's edit widget saves on every input. A toolbar `$button` (its actions, through a
 * `\procedure`, send `tm-edit-text-operation`) paints `data-lar-control="lar-field-operation"` and runs
 * `wrap-selection` the way TW5's own module does; a `$keyboard` paints its wrapper with the chords it declares.
 * What this file proves belongs to the PAGE: what the sink paints, keeps, relays and cancels. The island's own
 * claims ride the engine harness.
 *
 * THE HOST DOORS (12). A `$button message=` the stand-in answers asks `lar:service` and leaves the GATE to the
 * page: the sink checks the activation and the manifest the script's world names, runs the door, and answers
 * `lar:service-result`, which the stand-in takes in before it answers the act (a refused door refuses the act
 * with the page's reason and writes the island's alert record). In this half `services` reads the doors the PAGE
 * OPENED since the last expect (stub doors record them), `service-result` checks the page's own answer to the
 * latest ask, and `page.<control>.refusal` reads the words beside it.
 *
 * Steps: `frame` asks the stand-in for its next frame; `deliver: older` applies the frame the stand-in rendered
 * BEFORE taking in the last sense (a newer key revision, a lower sensed revision for that control); `sense` makes
 * a real edit (`execCommand("insertText")`, so a real input event and a real undo step; on a select, the
 * person's options chosen and a real `input`) and reads the relayed event; `act` makes a real click, a real
 * commit, a real click on a toggle (`lar:toggle`) or a real choice and `change` (`lar:choice`), or a real click
 * elsewhere (the modifiers held; the middle button's `auxclick`; the control placed where the script measured it),
 * reads the relayed event and feeds the stand-in's answer back through `applyResult`; an act the page relays
 * nothing for reads `refused:unclaimed`, with the default left standing; `switch` sends `lar:resend` to the arriving surface and applies its first frame under a
 * fresh epoch; `expect` reads the page (`value`, `text`, `undoDepth`, `focus`, `relays`, `defaultPrevented`,
 * `visible`, `placedFrom`; any other key fails closed), the last frame (`contains`, `stamps` by token, its
 * `attributes` read off the PAINTED node: `checked` and `selected` by the live state the page shows, any other
 * attribute by its value), the answers, the `want` and the stand-in's writes since the previous `expect`. A control
 * or a selector names its node the way the engine half reads it: a class names its node and the nodes it wraps.
 *
 * The page controls (04, 05, 08): `write` lands a peer's records in the stand-in's store; `page` performs a raw
 * gesture on the real control (a composition's start and end, an input while composing, a keydown) and feeds
 * whatever the sink relays to the stand-in; `act` makes a real take-theirs on the field's own button, or a real
 * toolbar click with the act's selection standing in the field; `expect.page` reads `newerVersion`,
 * `relayedSenses` and `relayedActs` beside the rest. A toolbar act carrying an older pair than the field now holds
 * re-enacts its race: the act left the page before the person's later typing, so the runner makes the real click
 * and carries the script's pair on the relayed event, after checking the page's own revision ran past it. The undo
 * probe relays nothing and moves no revision.
 *
 * `act` with `epoch: "stale"` re-enacts the race the script names: the person acted while the page still showed
 * the arriving surface's PREVIOUS mount (for a surface never shown before, its mount-time frame stands in), and
 * the act reached the island after the resend. The runner paints that earlier frame, makes the real click, then
 * paints the current mount again before the answer lands, and checks the relayed event carried the old epoch.
 */
import { describe, expect, test } from "vitest";
import {
  LAR_CAMERA_STORY, LAR_FRAME, LAR_KEY_MEMBERSHIP, LAR_KEY_STYLE, LAR_KEY_SURFACE,
  mkLarControlResult, mkLarService, type LarMsg_ControlEvent, type LarMsg_ControlResult, type LarMsg_Service, type LarRefusal,
  type LarServiceKind,
} from "../../lararium-mesh/src/lar-camera.js";
import { LAR_REFUSAL_WORDS, createProjectionSink, type LarSurfaceFrame } from "../src/projection-sink.js";
import type { LarFieldElement } from "../src/controls/lar-field.js";
import script01 from "./goldens/interaction/01-link-ordinary-modified-middle-external.json";
import script02 from "./goldens/interaction/02-button-actions-with-modifier-and-popup.json";
import script03 from "./goldens/interaction/03-edit-body-survives-blur.json";
import script04 from "./goldens/interaction/04-edit-peer-write-into-open-editor.json";
import script05 from "./goldens/interaction/05-edit-toolbar-wrap-selection-carried-pair.json";
import script06 from "./goldens/interaction/06-toggle-checkbox-radio-select-multiselect.json";
import script08 from "./goldens/interaction/08-ime-safari-enter-after-compositionend.json";
import script12 from "./goldens/interaction/12-services-copy-download-print-refuse-by-name.json";
import script13 from "./goldens/interaction/13-switch-resend-and-epoch.json";

type Fields = Record<string, string | string[]>;
interface World {
  readonly tiddlers: ReadonlyArray<Fields>; readonly story: readonly string[]; readonly root: string;
  readonly manifest?: { readonly services: readonly LarServiceKind[] };
}
type Step = Record<string, unknown>;
interface Script { readonly golden: string; readonly pins: string; readonly world?: World; readonly surfaces?: Record<string, { world: World }>; readonly steps: readonly Step[] }

/** A widget the stand-in renders: its class names the control in the script, its render id names it on the wire. */
interface Widget {
  readonly rid: string; readonly cls: string; readonly kind: "edit-text" | "button" | "checkbox" | "radio" | "select" | "link" | "keyboard";
  readonly attrs: Record<string, string>; readonly label: string;
  /** A select's options, by value and label. */
  readonly options: ReadonlyArray<{ value: string; label: string }>;
  /** The `$keyboard` a widget renders inside, where one wraps it. */
  readonly parent: Widget | null;
  /** A field's first value, painted once in its native carrier; and its descriptor, with the revision it took. */
  readonly initial: string;
  described?: { value: string; rev: number };
}
/** One piece of the root template, in paint order. */
type Piece = { readonly widget: Widget } | { readonly reveal: Record<string, string>; readonly body: string } | { readonly html: string } | { readonly close: true };

let epochCounter = 0;
const mintEpoch = (): number => ++epochCounter;
let descriptorCounter = 0;
const escapeHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A widget's attributes: quoted, or a `<<procedure>>` the root template defines. */
const attrsOf = (src: string, procedures: Readonly<Record<string, string>> = {}): Record<string, string> =>
  Object.fromEntries([...src.matchAll(/([\w$-]+)=(?:"([^"]*)"|<<([\w-]+)>>)/g)].map((m) => [m[1]!, m[2] ?? procedures[m[3]!] ?? ""]));
const ATTRS = `((?:\\s+[\\w$-]+=(?:"[^"]*"|<<[\\w-]+>>))*)\\s*`;

/** TW5's modifier descriptor (`$tw.keyboardManager.getEventModifierKeyDescriptor`), for the actions a button runs. */
const modifierOf = (m: LarMsg_ControlEvent["modifiers"]): string => {
  const on = [m?.meta && "meta", m?.ctrl && "ctrl", m?.alt && "alt", m?.shift && "shift"].filter(Boolean).join("-");
  return on === "" ? "normal" : on === "alt-ctrl" ? "ctrl-alt" : on === "alt-ctrl-shift" ? "ctrl-alt-shift" : on;
};

/** The engine half, standing in: a hand renderer of the widgets these scripts name. */
class StandInIsland {
  readonly store = new Map<string, Fields>();
  readonly widgets: Widget[] = [];
  readonly pieces: Piece[] = [];
  readonly writes: Array<Fields> = [];
  readonly sensed = new Map<string, { localRev: number }>();
  /** The `lar:service` asks this stand-in made, and the page's answer to each by request id. */
  readonly asks: LarMsg_Service[] = [];
  readonly serviceAnswers = new Map<string, string>();
  private notice: string | null = null;
  story: string[];
  epoch = mintEpoch();
  previousEpochFrame: LarSurfaceFrame;
  older: LarSurfaceFrame | null = null;
  current: LarSurfaceFrame;
  private rev = 0;
  private n = 0;

  constructor(readonly surface: string, world: World) {
    for (const t of world.tiddlers) this.store.set(String(t["title"]), { ...t });
    this.story = [...world.story];
    const procedures = Object.fromEntries([...world.root.matchAll(/^\\procedure ([\w-]+)\(\)\s*(.*)$/gm)].map((m) => [m[1]!, m[2]!]));
    const root = world.root.split("\n").filter((line) => !line.startsWith("\\")).join("\n")
      .replace(/<\$navigator\b[^>]*>|<\/\$navigator>/g, "");
    const open: Widget[] = [];
    const parts = new RegExp([
      `<\\$(edit-text|checkbox|radio)${ATTRS}\\/>`,
      `<\\$(button|select)${ATTRS}>([\\s\\S]*?)<\\/\\$\\3>`,
      `<\\$reveal${ATTRS}>([^<]*)<\\/\\$reveal>`,
      `\\{\\{([^}]+)\\}\\}`,
      `<\\$keyboard${ATTRS}>`,
      `<\\/\\$keyboard>`,
    ].join("|"), "g");
    let at = 0;
    for (const m of root.matchAll(parts)) {
      if (m.index! > at) this.pieces.push({ html: root.slice(at, m.index) });
      at = m.index! + m[0].length;
      const parent = open.at(-1) ?? null;
      if (m[1] !== undefined) this.pieces.push({ widget: this.widget(m[1] as Widget["kind"], attrsOf(m[2] ?? "", procedures), "", [], parent) });
      else if (m[3] !== undefined) {
        const kind = m[3] as Widget["kind"];
        const options = kind === "select" ? [...(m[5] ?? "").matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map((o) => ({ value: o[1]!, label: o[2]! })) : [];
        this.pieces.push({ widget: this.widget(kind, attrsOf(m[4] ?? "", procedures), kind === "button" ? m[5] ?? "" : "", options, parent) });
      } else if (m[6] !== undefined) this.pieces.push({ reveal: attrsOf(m[6]), body: m[7] ?? "" });
      else if (m[8] !== undefined) this.transclude(String(this.store.get(m[8])?.["text"] ?? ""));
      else if (m[9] !== undefined) {
        const kb = this.widget("keyboard", attrsOf(m[9], procedures), "", [], parent);
        open.push(kb);
        this.pieces.push({ widget: kb });
      } else { open.pop(); this.pieces.push({ close: true }); }
    }
    if (at < root.length) this.pieces.push({ html: root.slice(at) });
    // The pool mounts every surface at boot; the gate drops its frames until the vessel shows it.
    this.current = this.render();
    this.previousEpochFrame = this.current;
  }

  private widget(kind: Widget["kind"], attrs: Record<string, string>, label: string, options: Widget["options"] = [], parent: Widget | null = null): Widget {
    const initial = kind === "edit-text" ? String(this.store.get(attrs["tiddler"] ?? "")?.["text"] ?? "") : "";
    const w: Widget = { rid: `${this.surface}-r${++this.n}`, cls: attrs["class"] ?? "", kind, attrs, label, options, parent, initial };
    this.widgets.push(w);
    return w;
  }

  /** A transcluded tiddler's text: `[[link]]` binds a link widget, `[ext[label|href]]` and raw HTML paint unbound. */
  private transclude(text: string): void {
    let at = 0;
    for (const m of text.matchAll(/\[\[([^\]]+)\]\]|\[ext\[([^|\]]+)\|([^\]]+)\]\]/g)) {
      if (m.index! > at) this.pieces.push({ html: text.slice(at, m.index) });
      at = m.index! + m[0].length;
      if (m[1] !== undefined) this.pieces.push({ widget: this.widget("link", { to: m[1] }, m[1]) });
      else this.pieces.push({ html: `<a class="tc-tiddlylink-external" href="${escapeHtml(m[3]!)}" rel="noopener noreferrer" target="_blank">${escapeHtml(m[2]!)}</a>` });
    }
    if (at < text.length) this.pieces.push({ html: text.slice(at) });
  }

  ridOf(cls: string): string {
    const w = this.widgets.find((x) => `.${x.cls}` === cls || `${x.kind === "link" ? "a" : x.kind}.${x.cls}` === cls || (x.kind === "edit-text" && `${x.attrs["tag"] ?? "input"}.${x.cls}` === cls));
    if (!w) throw new Error(`stand-in: no widget carries ${cls}`);
    return w.rid;
  }

  /** The field a widget binds, as the store holds it. */
  read(w: Widget): string | string[] | undefined {
    return this.store.get(w.attrs["tiddler"] ?? "")?.[w.attrs["field"] ?? "text"];
  }

  /** The stamps the island's per-widget table declares for a widget's node. */
  private stamps(w: Widget): string {
    if (w.kind === "link") return ` data-lar-on="click dragstart dragend" data-lar-cancel="click:ordinary" data-lar-bubble="no"`;
    if (w.kind === "keyboard") return ` data-lar-on="keydown" data-lar-cancel="keydown:declared" data-lar-keys="${escapeHtml(w.attrs["key"] ?? "")}" data-lar-bubble="yes"`;
    if (w.kind === "edit-text") return ` data-lar-on="focus input" data-lar-live="value"`;
    if (w.kind === "checkbox" || w.kind === "radio") return ` data-lar-on="change" data-lar-live="checked"`;
    if (w.kind === "select") return ` data-lar-on="change" data-lar-live="selected"`;
    const handles = ["set", "popup", "to", "message"].some((a) => w.attrs[a] !== undefined);
    const cancels = handles || w.attrs["actions"] !== undefined;
    const operation = [w.attrs["message"], w.attrs["actions"]].some((a) => a?.includes("tm-edit-text-operation"));
    return ` data-lar-on="click"${cancels ? ` data-lar-cancel="click"` : ""} data-lar-bubble="${handles ? "no" : "yes"}"${operation ? ' data-lar-control="lar-field-operation"' : ""}`;
  }

  render(): LarSurfaceFrame {
    const body = this.pieces.map((piece) => {
      if ("html" in piece) return piece.html;
      if ("close" in piece) return "</div>";
      if ("reveal" in piece) {
        const cls = escapeHtml(`${piece.reveal["class"] ?? ""} tc-reveal`.trim());
        const at = /^\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\)$/.exec(String(this.store.get(piece.reveal["state"] ?? "")?.["text"] ?? ""));
        if (!at) return `<span class="${cls}" hidden="true"></span>`;
        const [left, top, , height] = at.slice(1).map(Number) as [number, number, number, number];
        return `<span class="${cls} tc-popup" style="position:absolute;z-index:1000;left:${left}px;top:${top + height}px">${escapeHtml(piece.body)}</span>`;
      }
      const w = piece.widget;
      if (w.kind === "link") {
        return `<a class="tc-tiddlylink tc-tiddlylink-resolves" data-lar-rid="${w.rid}"${this.stamps(w)} href="#${encodeURIComponent(w.attrs["to"]!)}">${escapeHtml(w.label)}</a>`;
      }
      if (w.kind === "keyboard") return `<div class="${escapeHtml(w.cls)}" data-lar-rid="${w.rid}"${this.stamps(w)}>`;
      if (w.kind === "button") return `<button class="${escapeHtml(w.cls)}" data-lar-rid="${w.rid}"${this.stamps(w)}>${escapeHtml(w.label)}</button>`;
      if (w.kind === "checkbox" || w.kind === "radio") {
        const on = this.read(w) === (w.kind === "checkbox" ? w.attrs["checked"] : w.attrs["value"]);
        return `<label class="tc-${w.kind} ${escapeHtml(w.cls)}"><input type="${w.kind}" data-lar-rid="${w.rid}"${this.stamps(w)}${on ? ' checked="checked"' : ""}><span></span></label>`;
      }
      if (w.kind === "select") {
        const held = this.read(w);
        const keys = Array.isArray(held) ? held : held === undefined ? [] : [held];
        const multiple = w.attrs["multiple"] === "yes";
        const opts = w.options.map((o) => `<option value="${escapeHtml(o.value)}"${keys.includes(o.value) ? ' selected="selected"' : ""}>${escapeHtml(o.label)}</option>`).join("");
        return `<select class="${escapeHtml(w.cls)}" data-lar-rid="${w.rid}"${this.stamps(w)}${multiple ? ' multiple="multiple"' : ""}>${opts}</select>`;
      }
      // The seam engine's shape: the first value in the native carrier, the store's value in the descriptor.
      const value = String(this.store.get(w.attrs["tiddler"] ?? "")?.["text"] ?? "");
      if (w.described?.value !== value) w.described = { value, rev: ++descriptorCounter };
      const descriptor = ` data-lar-value="${escapeHtml(value)}" data-lar-value-rev="${w.described.rev}"`;
      const field = (w.attrs["tag"] ?? "input") === "textarea"
        ? `<textarea class="${escapeHtml(w.cls)}" data-lar-rid="${w.rid}"${this.stamps(w)}${descriptor}>${escapeHtml(w.initial)}</textarea>`
        : `<input class="${escapeHtml(w.cls)}" data-lar-rid="${w.rid}"${this.stamps(w)} value="${escapeHtml(w.initial)}"${descriptor}>`;
      return `<lar-field data-lar-control="lar-field">${field}</lar-field>`;
    }).join("");
    const layer = this.notice === null ? "" : `<div class="lar-root-layer"><div class="tc-notification" role="status">${escapeHtml(this.notice)}</div></div>`;
    const html = `<div data-lar-rid="${this.surface}-top"><div>${body}</div>${layer}</div>`;
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
      const sensedWidget = this.widgets.find((x) => x.rid === cid);
      if (ev.mountEpoch !== this.epoch || !sensedWidget || (held && (ev.localRev ?? 0) <= held.localRev)) return null;
      this.sensed.set(cid, { localRev: ev.localRev ?? 0 });
      // TW5's edit widget saves on every input; a select binds no input leg.
      if (sensedWidget.kind === "edit-text" && typeof ev.wholeValue === "string" && this.read(sensedWidget) !== ev.wholeValue) {
        const title = sensedWidget.attrs["tiddler"] ?? "";
        this.store.set(title, { ...this.store.get(title), title, text: ev.wholeValue });
        this.writes.push({ title, text: ev.wholeValue });
      }
      return null;
    }
    const answer = (status: LarMsg_ControlResult["status"], reason?: LarRefusal, want?: LarMsg_ControlResult["want"]): LarMsg_ControlResult =>
      mkLarControlResult({
        eventId: ev.eventId, cameraId: ev.cameraId, mountEpoch: this.epoch, ...(ev.renderId ? { renderId: ev.renderId } : {}), ...(ev.controlId ? { controlId: ev.controlId } : {}),
        status, ...(reason ? { reason } : {}), ...(want ? { want } : {}),
      });
    if (ev.mountEpoch !== this.epoch) return answer("stale-target");
    if (ev.kind === "lar:service-result") {
      const ask = this.asks.find((a) => a.requestId === ev.requestId);
      if (!ask) return mkLarControlResult({ ...answer("refused"), reason: "unknown-request" });
      this.serviceAnswers.set(ask.requestId, String(ev.status));
      if (ev.status !== "ok") this.writes.push({ title: `$:/temp/lares/alert/refused/${ask.kind}` });
      else if (ask.kind === "clipboard") this.notice = "Copied to clipboard!";
      return answer("applied");
    }
    if (cid === `${this.surface}-top`) return mkLarControlResult({ ...answer("refused"), reason: "unclaimed" });
    const w = this.widgets.find((x) => x.rid === cid);
    if (!w) return answer("stale-target");
    const write = (title: string, field: string, value: string | string[]): void => {
      this.store.set(title, { ...this.store.get(title), title, [field]: value });
      this.writes.push({ title, [field]: value });
    };
    if (w.kind === "button" && ev.action === "lar:edit-operation") {
      return this.operate(ev, w, answer);
    } else if (w.kind === "edit-text" && ev.action === "lar:take-theirs") {
      // The page took the descriptor whole; the node reads it.
    } else if (ev.action === "lar:key") {
      let kb: Widget | null = w;
      while (kb && !(kb.kind === "keyboard" && kb.attrs["key"]?.toLowerCase() === ev.key?.key.toLowerCase())) kb = kb.parent;
      if (!kb) return answer("refused", "unclaimed");
      for (const m of (kb.attrs["actions"] ?? "").matchAll(/<\$action-setfield \$tiddler='([^']*)' text='([^']*)'\/>/g)) write(m[1]!, "text", m[2]!);
    } else if (w.kind === "button" && ev.action === "lar:click") {
      const action = /<\$action-setfield \$tiddler='([^']+)' text=<<modifier>>\/>/.exec(w.attrs["actions"] ?? "");
      if (action) write(action[1]!, "text", modifierOf(ev.modifiers));
      const g = ev.geometry;
      if (w.attrs["popup"] !== undefined && g) write(w.attrs["popup"], "text", `(${g.left},${g.top},${g.width},${g.height})`);
      if (w.attrs["set"] !== undefined) write(w.attrs["set"], "text", w.attrs["setTo"] ?? "");
    } else if (w.kind === "link" && ev.action === "lar:click") {
      // The navigator's road: the target opens at the top of the story; an ordinary click also enters the history.
      const to = w.attrs["to"]!;
      if (!this.story.includes(to)) { this.story = [to, ...this.story]; this.writes.push({ title: "$:/StoryList", list: [...this.story] }); }
      const m = ev.modifiers;
      if (!m?.ctrl && !m?.meta && (m?.button ?? 0) !== 1) this.writes.push({ title: "$:/HistoryList", "current-tiddler": to });
    } else if (w.kind === "edit-text" && ev.action === "lar:commit" && typeof ev.wholeValue === "string") {
      // TW5's edit widget saves only a value that moved.
      if (this.read(w) !== ev.wholeValue) write(w.attrs["tiddler"] ?? "", "text", ev.wholeValue);
      if (ev.localRev !== undefined && ev.localRev > (this.sensed.get(cid)?.localRev ?? -1)) this.sensed.set(cid, { localRev: ev.localRev });
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

  /** A peer's whole record lands in the store, with no person's act behind it. */
  land(title: string, fields: Fields): void {
    this.store.set(title, { ...this.store.get(title), ...fields, title });
  }

  /** A toolbar act: TW5's `wrap-selection` over the carried pair, answered with the value and selection it wants. */
  private operate(ev: LarMsg_ControlEvent, button: Widget, answer: (s: LarMsg_ControlResult["status"], r?: LarRefusal, w?: LarMsg_ControlResult["want"]) => LarMsg_ControlResult): LarMsg_ControlResult {
    const fields = this.widgets.filter((x) => x.kind === "edit-text");
    const field = ev.fieldId !== undefined ? fields.find((x) => x.rid === ev.fieldId) : fields.length === 1 ? fields[0] : undefined;
    const sel = ev.selection;
    if (!field || typeof ev.wholeValue !== "string" || !sel || sel.end > ev.wholeValue.length) return answer("refused", "selection-unavailable");
    if (ev.localRev !== undefined && ev.localRev < (this.sensed.get(field.rid)?.localRev ?? -1)) return answer("stale-target");
    const op = button.attrs["actions"] ?? "";
    const param = /\$param="([^"]*)"/.exec(op)?.[1];
    const prefix = /\bprefix="([^"]*)"/.exec(op)?.[1] ?? "";
    const suffix = /\bsuffix="([^"]*)"/.exec(op)?.[1] ?? "";
    if (param !== "wrap-selection") return answer("refused", "unsupported-control");
    if (sel.start === sel.end) return answer("refused", "selection-unavailable");
    const text = ev.wholeValue;
    const replacement = prefix + text.slice(sel.start, sel.end) + suffix;
    const value = text.slice(0, sel.start) + replacement + text.slice(sel.end);
    const title = field.attrs["tiddler"] ?? "";
    this.store.set(title, { ...this.store.get(title), title, text: value });
    this.writes.push({ title, text: value });
    if (ev.localRev !== undefined) this.sensed.set(field.rid, { localRev: ev.localRev + 1 });
    return answer("applied", undefined, { value, selStart: sel.start, selEnd: sel.start + replacement.length });
  }

  /** A `$button message=` the stand-in knows as a host door: the ask it makes, or null for any other act. */
  serviceFor(ev: LarMsg_ControlEvent): LarMsg_Service | null {
    const w = this.widgets.find((x) => x.rid === (ev.controlId ?? ev.renderId));
    const door = w?.kind === "button" ? DOORS[w.attrs["message"] ?? ""] : undefined;
    if (!w || !door || ev.kind !== "lar:act" || ev.mountEpoch !== this.epoch) return null;
    const ask = mkLarService({ wikiUri: `lar:///golden/${this.surface}`, requestId: `stand-in-${this.asks.length + 1}`, kind: door.kind, args: door.args(w.attrs["param"] ?? "") });
    this.asks.push(ask);
    return ask;
  }

  /** The act's answer once the page answered its ask: the page's refusal, or applied. */
  answerServiceAct(ev: LarMsg_ControlEvent, ask: LarMsg_Service): LarMsg_ControlResult {
    const status = this.serviceAnswers.get(ask.requestId);
    return mkLarControlResult({
      eventId: ev.eventId, cameraId: ev.cameraId, mountEpoch: this.epoch, ...(ev.renderId ? { renderId: ev.renderId } : {}),
      ...(status === "ok" || status === undefined ? { status: "applied" as const } : { status: "refused" as const, reason: status as LarRefusal }),
    });
  }
}

/** The root messages the stand-in answers as host doors, and the args each carries. */
const DOORS: Record<string, { kind: LarServiceKind; args: (param: string) => Record<string, string> }> = {
  "tm-copy-to-clipboard": { kind: "clipboard", args: (param) => ({ text: param }) },
  "tm-download-file": { kind: "download", args: (param) => ({ filename: param, text: "", type: "text/plain" }) },
  "tm-print": { kind: "print", args: () => ({}) },
};

/** A selector in the wrap reading: `input.cb` names the input inside the node classed `cb` (TW5 classes the label). */
const wrapped = (selector: string): string =>
  selector.split(/\s+/).map((c) => /^([a-zA-Z][\w-]*)((?:\.[\w-]+)+)(.*)$/.exec(c)).map((m, i) => m ? `${m[2]} ${m[1]}${m[3]}` : selector.split(/\s+/)[i]!).join(" ");

/**
 * Count the undo steps the field holds, then put every one back: undo until the value stops moving, redo as many.
 * The probe's own edits never reach the sink: a measurement relays nothing and moves no revision.
 */
function undoDepth(field: HTMLTextAreaElement | HTMLInputElement): number {
  const quiet = (event: Event): void => { event.stopPropagation(); };
  field.addEventListener("input", quiet, true);
  try {
    field.focus();
    let depth = 0;
    for (let last = field.value; depth < 64; depth += 1) {
      document.execCommand("undo");
      if (field.value === last) break;
      last = field.value;
    }
    for (let i = 0; i < depth; i += 1) document.execCommand("redo");
    return depth;
  } finally {
    field.removeEventListener("input", quiet, true);
  }
}

async function run(script: Script): Promise<void> {
  const host = document.createElement("div");
  // The host stands at the viewport's origin, so a control placed where the script measured it reads back the
  // script's own host-relative geometry.
  host.style.cssText = "position:fixed;top:0;left:0;width:800px;height:600px";
  document.body.appendChild(host);
  // The page's own default, read after the sink had its turn; an anchor's is then cancelled so the test page never navigates.
  let lastDefaultPrevented: boolean | null = null;
  const readDefault = (e: Event): void => {
    lastDefaultPrevented = e.defaultPrevented;
    // An anchor would navigate the test page; every other default (a checkbox's toggle) stands as the page left it.
    if (e.composedPath().some((n) => n instanceof HTMLAnchorElement)) e.preventDefault();
  };
  window.addEventListener("click", readDefault);
  window.addEventListener("auxclick", readDefault);
  const prevented = new Map<string, boolean>();
  const manifest = (script.world ?? Object.values(script.surfaces ?? {})[0]?.world)?.manifest;
  const opened: Array<{ kind: string; args: Record<string, unknown> }> = [];
  let openedSeen = 0;
  const record = (kind: LarServiceKind) => (args: Readonly<Record<string, unknown>>): void => { opened.push({ kind, args: { ...args } }); };
  const sink = createProjectionSink(host, {
    inputMaxChars: 4096,
    ...(manifest ? { services: manifest.services } : {}),
    doors: { clipboard: record("clipboard"), download: record("download"), print: record("print") },
  });
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
  let writesSinceExpect = 0;
  let lastWant: LarMsg_ControlResult["want"] | undefined;
  let sentAtExpect = 0;

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
  /** A real click as the person makes it: the modifiers held, and the middle button's `auxclick`. */
  const clickOn = (target: HTMLElement, m?: { ctrl?: boolean; meta?: boolean; alt?: boolean; shift?: boolean; button?: number }): boolean => {
    lastDefaultPrevented = null;
    const middle = m?.button === 1;
    target.dispatchEvent(new MouseEvent(middle ? "auxclick" : "click", {
      bubbles: true, composed: true, cancelable: true, button: middle ? 1 : 0,
      ctrlKey: !!m?.ctrl, metaKey: !!m?.meta, altKey: !!m?.alt, shiftKey: !!m?.shift,
    }));
    return lastDefaultPrevented ?? false;
  };
  const relayedSince = (mark: number): LarMsg_ControlEvent => {
    expect(sent.length, "the page relayed one control event").toBe(mark + 1);
    return sent[mark]!.ev;
  };
  const answer = (ev: LarMsg_ControlEvent, surface: string): void => {
    const result = island(surface).receive(ev);
    if (!result) return;
    answers.push(result.status === "refused" ? `refused:${result.reason}` : result.status);
    if (result.want) lastWant = result.want;
    sink.applyResult(result);
    // A toolbar act's words stand beside its field.
    const words = [...root.querySelectorAll<HTMLOutputElement>('output[role="status"]')].filter((o) => o.dataset["larFor"] === (ev.fieldId ?? ev.controlId ?? ev.renderId));
    if (result.status === "stale-target") {
      // The page half of a stale answer: the canon's words stand beside the control the person acted on.
      expect(words.map((o) => o.textContent)).toEqual(["This control changed before your action arrived. Review it and try again."]);
    } else if (result.status === "refused" && result.reason === "unclaimed") {
      expect(words, "an unclaimed act owes no words").toEqual([]);
    } else if (result.status === "refused") {
      expect(words.map((o) => o.textContent), "a refusal reads beside its control in the canon's words").toEqual([LAR_REFUSAL_WORDS[result.reason!]]);
    } else {
      expect(words, "an applied answer leaves no refusal standing beside its control").toEqual([]);
    }
  };
  /** Feed every event the page relayed since `mark` to the stand-in, the way the vessel's leg would. */
  const pump = (mark: number): void => { for (const { surface, ev } of sent.slice(mark)) answer(ev, surface); };
  const idOf = (node: Element): string =>
    node.closest("[data-control-id]")?.getAttribute("data-control-id") ?? node.closest("[data-lar-rid]")?.getAttribute("data-lar-rid") ?? "";

  try {
    let previous: Step | undefined;
    for (const step of script.steps) {
      const prior = previous;
      previous = step;
      if ("frame" in step) {
        const surface = (step["surface"] as string | undefined) ?? shown;
        shown = surface;
        deliver(island(surface).render());
      } else if ("deliver" in step) {
        const older = island(shown).older;
        expect(older, "the stand-in holds a frame rendered before the last sense").not.toBeNull();
        deliver(older!);
      } else if ("write" in step) {
        const w = step["write"] as { records: Array<{ title: string; fields: Fields }> };
        for (const r of w.records) island(shown).land(r.title, r.fields);
      } else if ("page" in step) {
        const p = step["page"] as { control: string; composition?: string; value?: string; input?: string; composing?: boolean; keydown?: KeyboardEventInit & { keyCode: number } };
        const field = el(p.control) as HTMLInputElement;
        const mark = sent.length;
        if (p.composition === "start") {
          field.focus();
          field.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, composed: true }));
        } else if (p.composition === "end") {
          if (p.value !== undefined) field.value = p.value;
          field.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, composed: true, data: p.value ?? "" }));
        } else if (p.input !== undefined) {
          field.value = p.input;
          field.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, isComposing: p.composing ?? false, data: p.input }));
        } else if (p.keydown) {
          // A keystroke after anything but another gesture of the same burst lands in a later task, as a person's does.
          if (!(prior && "page" in prior)) await new Promise((resolve) => setTimeout(resolve, 0));
          field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, composed: true, cancelable: true, ...p.keydown }));
        } else {
          throw new Error(`the page harness reads no gesture in ${JSON.stringify(p)}`);
        }
        pump(mark);
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
        const a = step["act"] as {
          control: string; action: string; wholeValue?: string | string[]; checked?: boolean; localRev?: number; epoch?: string; surface?: string;
          selection?: { start: number; end: number };
          modifiers?: { ctrl: boolean; meta: boolean; alt: boolean; shift: boolean; button?: number };
          geometry?: { top: number; left: number; width: number; height: number };
        };
        const surface = a.surface ?? shown;
        const isl = island(surface);
        const current = isl.current;
        if (a.epoch === "stale") sink.apply(isl.previousEpochFrame);    // the page as it stood when the person acted
        const mark = sent.length;
        const target = el(a.control);
        let carriedOlder = false;
        if (a.geometry) {
          // The control stands where the script measured it, so the page's own measurement reads the script's rect.
          const g = a.geometry;
          target.style.cssText = `position:fixed;box-sizing:border-box;margin:0;padding:0;border:0;top:${g.top}px;left:${g.left}px;width:${g.width}px;height:${g.height}px`;
        }
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
        } else if (a.action === "lar:take-theirs") {
          const lf = target.closest<LarFieldElement>("lar-field");
          expect(lf?.newerVersion, `${a.control} offers a newer version to take`).not.toBeNull();
          lf!.shadowRoot!.querySelector<HTMLButtonElement>('button[part="take-theirs"]')!.click();
        } else if (a.action === "lar:edit-operation") {
          const field = pane().querySelector<HTMLTextAreaElement>(`[data-lar-rid="${isl.widgets.find((w) => w.kind === "edit-text")!.rid}"]`)!;
          field.focus();
          carriedOlder = field.value !== a.wholeValue;
          if (!carriedOlder) field.setSelectionRange(a.selection!.start, a.selection!.end);
          target.click();
        } else {
          prevented.set(a.control, clickOn(target, a.modifiers));
        }
        if (sent.length === mark && a.action === "lar:click") {
          // No binding claims the click: the page relays nothing and leaves the browser's default standing, which
          // reads as the island's own word for it.
          answers.push("refused:unclaimed");
          continue;
        }
        let ev = relayedSince(mark);
        expect([ev.kind, ev.action]).toEqual(["lar:act", a.action]);
        if (carriedOlder) {
          // The race the script names: this act left the page before the person's later typing.
          expect(ev.localRev, "the page's own revision already ran past the pair the act carried").toBeGreaterThan(a.localRev!);
          ev = { ...ev, wholeValue: a.wholeValue!, localRev: a.localRev!, selection: a.selection! };
        } else if (a.action === "lar:edit-operation") {
          expect(ev.selection, `${a.control} carries the field's selection`).toEqual(a.selection);
        }
        if (a.modifiers) expect(ev.modifiers, "the act carries the modifiers held").toEqual(a.modifiers.button === undefined ? { ...a.modifiers, button: 0 } : a.modifiers);
        if (a.geometry) expect(ev.geometry, "the act carries the rect the page measured").toEqual({ ...a.geometry, right: a.geometry.left + a.geometry.width, bottom: a.geometry.top + a.geometry.height });
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
        const ask = isl.serviceFor(ev);
        if (ask) {
          // The island asks; the page gates, opens and answers on the return leg; the island takes the answer in.
          const before = sent.length;
          await sink.applyService({ ...ask, surface });
          expect(sent.length, "the page answered the ask once").toBe(before + 1);
          const reply = sent.at(-1)!.ev;
          expect([reply.kind, reply.requestId]).toEqual(["lar:service-result", ask.requestId]);
          const taken = isl.receive(reply);
          if (taken) sink.applyResult(taken);
          const result = isl.answerServiceAct(ev, ask);
          answers.push(result.status === "refused" ? `refused:${result.reason}` : result.status);
          sink.applyResult(result);
          continue;
        }
        answer(ev, surface);
      } else if ("service-result" in step) {
        const want = step["service-result"] as { requestId: string; status: string };
        const isl = island(shown);
        const ask = want.requestId === "last" ? isl.asks.at(-1) : isl.asks.find((a) => a.requestId === want.requestId);
        expect(ask, "an ask stands for the page to have answered").toBeDefined();
        expect(isl.serviceAnswers.get(ask!.requestId), "the page's own answer to the ask").toBe(want.status);
      } else if ("switch" in step) {
        const to = (step["switch"] as { surface: string }).surface;
        shown = to;
        deliver(island(to).resend());
      } else if ("expect" in step) {
        const want = step["expect"] as {
          page?: Record<string, unknown>; frame?: Record<string, unknown>; answers?: string[]; writes?: unknown[];
          services?: Array<{ kind: string; args?: Record<string, unknown> }>; want?: unknown;
        };
        if (want.page) {
          for (const [key, spec] of Object.entries(want.page)) {
            if (key === "surface") { expect(sink.surface()).toBe(spec); continue; }
            const node = el(key) as HTMLTextAreaElement;
            if (node instanceof HTMLSelectElement && (spec as { value?: string }).value !== undefined) {
              expect(node.value, `${key} value`).toBe((spec as { value: string }).value);
              continue;
            }
            const s = spec as {
              value?: string; text?: string; undoDepth?: number; focus?: boolean; relays?: boolean; defaultPrevented?: boolean;
              visible?: boolean; placedFrom?: { top: number; left: number }; refusal?: LarRefusal;
              newerVersion?: string | null; relayedSenses?: number; relayedActs?: number;
            };
            const known = ["value", "text", "undoDepth", "focus", "relays", "defaultPrevented", "visible", "placedFrom", "refusal", "newerVersion", "relayedSenses", "relayedActs"];
            for (const k of Object.keys(s)) if (!known.includes(k)) throw new Error(`the page harness reads no page.${k}`);
            if (s.value !== undefined) expect(node.value, `${key} value`).toBe(s.value);
            if (s.text !== undefined) expect(node.textContent, `${key} text`).toBe(s.text);
            if (s.undoDepth !== undefined) expect(undoDepth(node), `${key} undo depth`).toBe(s.undoDepth);
            if (s.focus !== undefined) expect(root.activeElement === node, `${key} focus`).toBe(s.focus);
            if (s.relays !== undefined) {
              const mark = sent.length;
              clickOn(node);
              expect(sent.length > mark, `${key} relays`).toBe(s.relays);
              sent.length = mark;                                          // a probe, never an act: nothing reaches the island
            }
            if (s.defaultPrevented !== undefined) expect(prevented.get(key), `${key} defaultPrevented`).toBe(s.defaultPrevented);
            if (s.visible !== undefined) expect(!node.hidden && getComputedStyle(node).display !== "none", `${key} visible`).toBe(s.visible);
            if (s.refusal !== undefined) {
              const id = node.getAttribute("data-control-id") ?? node.getAttribute("data-lar-rid");
              const out = [...root.querySelectorAll<HTMLOutputElement>('output[role="status"]')].find((o) => o.dataset["larFor"] === id);
              expect(out?.dataset["larReason"], `${key} refusal`).toBe(s.refusal);
              expect(out?.textContent).toBe(LAR_REFUSAL_WORDS[s.refusal]);
            }
            if (s.newerVersion !== undefined) expect(node.closest<LarFieldElement>("lar-field")?.newerVersion ?? null, `${key} newer version`).toBe(s.newerVersion);
            const mine = sent.slice(sentAtExpect).filter(({ ev }) => (ev.controlId ?? ev.renderId) === idOf(node) || ev.fieldId === idOf(node));
            if (s.relayedSenses !== undefined) expect(mine.filter(({ ev }) => ev.kind === "lar:sense").length, `${key} senses relayed`).toBe(s.relayedSenses);
            if (s.relayedActs !== undefined) expect(mine.filter(({ ev }) => ev.kind === "lar:act").length, `${key} acts relayed`).toBe(s.relayedActs);
            if (s.placedFrom !== undefined) expect({ top: parseFloat(node.style.top), left: parseFloat(node.style.left) }, `${key} placed`).toEqual(s.placedFrom);
          }
        }
        if (want.frame) {
          const f = lastFrame!;
          if (want.frame["surface"] !== undefined) expect(f.surface).toBe(want.frame["surface"]);
          if (want.frame["epoch"] === "fresh") expect(freshAtLast, "the frame carries a mount epoch this surface never showed").toBe(true);
          for (const key of Object.keys(want.frame)) {
            if (!["surface", "epoch", "sensedRevision", "attributes", "stamps", "contains"].includes(key)) throw new Error(`the page harness reads no frame.${key}`);
          }
          if (want.frame["contains"] !== undefined) expect(f.keys[0]!.html, "the frame paints the text").toContain(String(want.frame["contains"]));
          // The stamps the page reads its cancellation from, as the painted node keeps them: each token the script names.
          for (const [control, stamps] of Object.entries((want.frame["stamps"] ?? {}) as Record<string, Record<string, string | null>>)) {
            const node = el(control);
            for (const [name, wantStamp] of Object.entries(stamps)) {
              const got = node.getAttribute(name);
              if (wantStamp === null) { expect(got, `${control} ${name}`).toBeNull(); continue; }
              const tokens = new Set((got ?? "").split(/\s+/).filter(Boolean));
              expect(wantStamp.split(/\s+/).filter((t) => !tokens.has(t)), `${control} ${name}="${got}" carries "${wantStamp}"`).toEqual([]);
            }
          }
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
        if (want.want !== undefined) expect(lastWant, "the want the answer carried").toEqual(want.want);
        if (want.services) {
          const got = opened.slice(openedSeen);
          expect(got.map((o) => o.kind), "the doors the page opened").toEqual(want.services.map((w) => w.kind));
          want.services.forEach((w, i) => expect(got[i]!.args).toMatchObject(w.args ?? {}));
        }
        openedSeen = opened.length;
        answers = [];
        lastWant = undefined;
        sentAtExpect = sent.length;
        // The writes, as the engine half reads them: each named record stands (in the store, or as a write since the
        // previous `writes` expect), and no title outside the named set took a write since the previous expect.
        const writes = [...islands.values()].flatMap((i) => i.writes);
        if (want.writes) {
          const named = want.writes as Array<Record<string, unknown>>;
          const titles = new Set(named.map((r) => String(r["title"])));
          expect(writes.slice(writesSinceExpect).map((w) => String(w["title"])).filter((t) => !titles.has(t)), "no title outside the script's took a write").toEqual([]);
          for (const record of named) {
            const stored = [...islands.values()].map((i) => i.store.get(String(record["title"]))).find((f) => f !== undefined);
            const stands = stored !== undefined && Object.entries(record).every(([k, v]) => JSON.stringify(stored[k]) === JSON.stringify(v));
            const written = writes.slice(writesSeen).some((w) => JSON.stringify(w) === JSON.stringify(record));
            expect(stands || written, `${String(record["title"])} stands as ${JSON.stringify(record)}; writes ${JSON.stringify(writes.slice(writesSeen))}`).toBe(true);
          }
          writesSeen = writes.length;
        }
        writesSinceExpect = writes.length;
      } else {
        throw new Error(`the page harness reads no verb in ${JSON.stringify(step)}`);
      }
    }
  } finally {
    window.removeEventListener("click", readDefault);
    window.removeEventListener("auxclick", readDefault);
    host.remove();
  }
}

describe("★ interaction goldens, the page half ★", () => {
  test(`01 · ${script01.pins}`, async () => { await run(script01 as unknown as Script); });
  test(`02 · ${script02.pins}`, async () => { await run(script02 as unknown as Script); });
  test(`03 · ${script03.pins}`, async () => { await run(script03 as unknown as Script); });
  test(`04 · ${script04.pins}`, async () => { await run(script04 as unknown as Script); });
  test(`05 · ${script05.pins}`, async () => { await run(script05 as unknown as Script); });
  test(`06 · ${script06.pins}`, async () => { await run(script06 as unknown as Script); });
  test(`08 · ${script08.pins}`, async () => { await run(script08 as unknown as Script); });
  test(`12 · ${script12.pins}`, async () => { await run(script12 as unknown as Script); });
  test(`13 · ${script13.pins}`, async () => { await run(script13 as unknown as Script); });

  test("NONSENSE CONTROL: a script whose expectation contradicts the page reds", async () => {
    const broken = structuredClone(script03) as unknown as { steps: Step[] };
    broken.steps[4] = { expect: { page: { ".body": { value: "first" } } } };     // claims the older frame repainted the edit
    await expect(run(broken as unknown as Script)).rejects.toThrow(/\.body value/);
  });

  test("CONTROL 04: a script claiming the peer's value repainted the person's text, or that take-theirs cost the earlier undo step, reds", async () => {
    const repainted = structuredClone(script04) as unknown as { steps: Step[] };
    repainted.steps[4] = { expect: { page: { ".body": { value: "theirs" } } } };
    await expect(run(repainted as unknown as Script)).rejects.toThrow(/\.body value/);
    const flattened = structuredClone(script04) as unknown as { steps: Step[] };
    flattened.steps[6] = { expect: { answers: ["applied"], page: { ".body": { value: "theirs", undoDepth: 1 } } } };
    await expect(run(flattened as unknown as Script)).rejects.toThrow(/\.body undo depth/);
  });

  test("CONTROL 05: a script claiming the stale toolbar act moved the field reds", async () => {
    const moved = structuredClone(script05) as unknown as { steps: Step[] };
    moved.steps[5] = { expect: { answers: ["stale-target"], page: { ".body": { value: "wrap ''me'' please" } } } };
    await expect(run(moved as unknown as Script)).rejects.toThrow(/\.body value/);
  });

  test("CONTROL 08: a script claiming the committing Enter crossed as an act, or the declared Enter never submitted, reds", async () => {
    const crossed = structuredClone(script08) as unknown as { steps: Step[] };
    crossed.steps[6] = { expect: { page: { "input.field": { relayedSenses: 1, relayedActs: 1 } } } };
    await expect(run(crossed as unknown as Script)).rejects.toThrow(/input\.field acts relayed/);
    const silent = structuredClone(script08) as unknown as { steps: Step[] };
    silent.steps[10] = { expect: { answers: [], writes: [] } };
    await expect(run(silent as unknown as Script)).rejects.toThrow();
  });

  test("CONTROL 12: a script claiming the page opened print, or opened no clipboard, reds", async () => {
    const at = script12.steps.findIndex((s) => JSON.stringify((s as { expect?: { answers?: string[] } }).expect?.answers) === JSON.stringify(["refused:page-action-unavailable"]));
    const copy = script12.steps.findIndex((s) => (s as { expect?: { services?: Array<{ kind: string }> } }).expect?.services?.[0]?.kind === "clipboard");
    expect(at).toBeGreaterThan(copy);
    const printed = structuredClone(script12) as unknown as { steps: Step[] };
    printed.steps[at] = { expect: { services: [{ kind: "print", args: {} }] } };
    await expect(run(printed as unknown as Script)).rejects.toThrow(/the doors the page opened/);
    const silent = structuredClone(script12) as unknown as { steps: Step[] };
    silent.steps[copy] = { expect: { services: [] } };
    await expect(run(silent as unknown as Script)).rejects.toThrow(/the doors the page opened/);
  });
});
