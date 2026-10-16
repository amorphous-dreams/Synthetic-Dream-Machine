/**
 * interaction-goldens-offers.page.test — THE PAGE HALF OF GOLDENS 07, 09, 10 AND 11 (keys, import, drop and order,
 * the confirm road), over the real sink in real Chromium.
 *
 * One script file runs on every harness (`packages/lararium-tw5/tests/goldens/interaction/README.md`); this file reads
 * the copies beside it. The toggle family's stand-in (`interaction-goldens.page.test.ts`) renders `$edit-text`,
 * `$button`, `$checkbox`, `$radio` and `$select`; these four scripts name other widgets, so their stand-in stands here.
 *
 * THE ENGINE HALF STANDS IN. No TiddlyWiki runs here. `OfferIsland` hand-renders each script's world in TW5's own
 * shape with the stamps the island declares (`data-lar-on`, `data-lar-cancel`, `data-lar-keys`), the `lar:shortcuts`
 * key the island parses from `$:/tags/KeyboardShortcut`, and the `lar:story-order` key; it answers each act the way
 * the contract says an island must. What this file proves belongs to the PAGE: which gestures cross, what they carry,
 * what the page cancels, and the words it raises where a gesture never crosses.
 *
 * Gestures, by action: `lar:key` presses a real keydown on the control (on `document.body` for `lar:document`);
 * `lar:import-offer` picks a real file; `lar:drop` drops a real `DataTransfer` (a title list, tiddler JSON, or a file
 * of the named size); `lar:order` drags an item onto another where one drag reaches the order, and otherwise lets
 * the list's own `lar-order` event carry the list the script names (no gesture makes a partial list); a named
 * action clicks its `lar-action`; `lar:click` clicks. Golden 11's second delete clicks a button the question has
 * made inert: no person can, so the harness does it by script, as the engine half does.
 */
import { describe, expect, test } from "vitest";
import {
  LAR_CAMERA_STORY, LAR_FRAME, LAR_KEY_MEMBERSHIP, LAR_KEY_SHORTCUTS, LAR_KEY_STORY_ORDER, LAR_KEY_STYLE, LAR_KEY_SURFACE,
  mkLarControlResult, type LarMsg_ControlEvent, type LarShortcutChord,
} from "../../lararium-mesh/src/lar-camera.js";
import { createProjectionSink, type LarSurfaceFrame } from "../src/projection-sink.js";
import { matchChord, parseChords } from "../src/controls/lar-chords.js";
import script07 from "./goldens/interaction/07-keys-search-enter-tagpicker-enter-global-shortcut.json";
import script09 from "./goldens/interaction/09-import-file-pick-and-drop-json.json";
import script10 from "./goldens/interaction/10-drop-droppable-actions-and-order-write.json";
import script11 from "./goldens/interaction/11-confirm-delete-asks-then-applies.json";

type Fields = Record<string, unknown>;
type Step = Record<string, unknown>;
interface Script { readonly golden: string; readonly world: { tiddlers: Fields[]; story: string[]; root: string }; readonly steps: readonly Step[] }
type Status = "applied" | "stale-target" | `refused:${string}`;

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const setField = (actions: string): { title: string; text: string } | null => {
  const m = /\$tiddler='([^']+)'\s+text='([^']*)'/.exec(actions);
  return m ? { title: m[1]!, text: m[2]! } : null;
};
/** TW5's own modifier descriptor (`getEventModifierKeyDescriptor`), for the cases these scripts make. */
const modifierOf = (m?: { ctrl: boolean; meta: boolean; alt: boolean; shift: boolean }): string =>
  !m ? "normal" : m.shift && !m.ctrl && !m.alt && !m.meta ? "shift" : m.ctrl && !m.shift && !m.alt && !m.meta ? "ctrl" : "normal";

/** The engine half, standing in: each script's world rendered by hand, each act answered as the contract says. */
class OfferIsland {
  readonly store = new Map<string, Fields>();
  readonly written: string[] = [];
  readonly messages: string[] = [];
  readonly epoch = 7;
  private rev = 0;
  private question: { title: string; subject: string; snapshot: string } | null = null;
  private questions = 0;
  readonly chords: LarShortcutChord[];
  constructor(readonly n: string, world: Script["world"]) {
    for (const t of world.tiddlers) this.store.set(String(t["title"]), { ...t });
    this.store.set("$:/StoryList", { title: "$:/StoryList", list: [...world.story] });
    const descriptors = [...this.store.values()].filter((t) => (t["tags"] as string[] | undefined)?.includes("$:/tags/KeyboardShortcut"))
      .map((t) => String(t["key"] ?? "")).flatMap((k) => k.split(" ")).map((d) => {
        const named = /^\(\((.+)\)\)$/.exec(d);
        return named ? String(this.store.get(`$:/config/shortcuts/${named[1]}`)?.["text"] ?? "") : d;
      });
    this.chords = parseChords(descriptors.join(" "));
  }
  write(title: string, fields: Fields | null): void {
    if (fields === null) this.store.delete(title); else this.store.set(title, { ...this.store.get(title), ...fields, title });
    this.written.push(title);
  }
  peerWrite(records: { title: string; fields?: Fields }[]): void {
    for (const r of records) this.store.set(r.title, { ...this.store.get(r.title), ...r.fields, title: r.title });
  }
  private importView(): string {
    const imp = this.store.get("$:/Import");
    if (imp?.["plugin-type"] !== "import") return "";
    const titles = Object.keys((imp["tiddlers"] ?? {}) as object);
    return `<div class="tc-import"><ul>${titles.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`;
  }
  private html(): string {
    switch (this.n) {
      case "07":
        return `<span class="kb tc-keyboard" data-lar-bubble="yes" data-lar-cancel="keydown:declared" data-lar-keys="enter" data-lar-on="keydown" data-lar-rid="kb"><lar-field data-lar-control="lar-field"><input class="search" data-lar-live="value" data-lar-on="input" data-lar-rid="search" data-lar-value="" data-lar-value-rev="1" value=""></lar-field></span>`;
      case "09":
        return `<span class="pick"><input type="file" data-lar-rid="pick" data-lar-on="change"></span>`
          + `<div class="zone" data-lar-rid="zone" data-lar-on="drop" data-lar-cancel="dragenter dragover drop">drop here</div>${this.importView()}`
          + `<lar-action data-control-id="$:/Import" data-action="lar:perform-import"><button type="button">import</button></lar-action>`;
      case "10":
        return `<div class="dz tc-droppable" data-lar-rid="dz" data-lar-on="drop" data-lar-cancel="dragenter dragover drop">zone</div>`
          + `<lar-order-list data-control-id="order" data-tiddler="lar:///t/drop/order" data-field="list"><ol><li data-item-id="a">a</li><li data-item-id="b">b</li><li data-item-id="c">c</li></ol></lar-order-list>`;
      default: {
        const q = this.question;
        const inert = q ? ` inert=""` : "";
        return `<button class="del-x" data-lar-rid="dx" data-lar-on="click" data-lar-cancel="click" data-lar-bubble="no"${inert}>delete x</button><button class="del-y" data-lar-rid="dy" data-lar-on="click" data-lar-cancel="click" data-lar-bubble="no"${inert}>delete y</button>`
          + (q ? `<div class="tc-confirm-backdrop"${inert}></div><div class="tc-confirm" role="alertdialog" aria-modal="true" aria-label="Confirm"><div class="tc-confirm-message">Do you wish to delete the tiddler "${esc(q.subject)}"?</div>`
            + `<div class="tc-confirm-buttons"><button class="tc-confirm-decline" data-lar-rid="no-${q.title}" data-lar-on="click" data-lar-cancel="click" data-lar-bubble="no">No</button><button class="tc-confirm-accept" data-lar-rid="yes-${q.title}" data-lar-on="click" data-lar-cancel="click" data-lar-bubble="no">Yes</button></div></div>` : "");
      }
    }
  }
  current!: LarSurfaceFrame;
  render(): LarSurfaceFrame {
    this.rev += 1;
    const story = (this.store.get("$:/StoryList")?.["list"] ?? []) as string[];
    this.current = {
      type: LAR_FRAME, wikiUri: `lar:///golden/${this.n}`, cameraId: LAR_CAMERA_STORY, mountEpoch: this.epoch, surface: "main", sensedRevision: {},
      keys: [
        { key: LAR_KEY_SURFACE, rev: this.rev, html: this.html() },
        { key: LAR_KEY_STYLE, rev: 1, css: "" },
        { key: LAR_KEY_SHORTCUTS, rev: 1, chords: this.chords },
        { key: LAR_KEY_STORY_ORDER, rev: this.rev, story: { order: story, tail: null, depth: 0 } },
        { key: LAR_KEY_MEMBERSHIP, rev: 1, members: [LAR_KEY_SURFACE, LAR_KEY_STYLE, LAR_KEY_SHORTCUTS, LAR_KEY_STORY_ORDER] },
      ],
    };
    return this.current;
  }
  private park(fieldsList: Fields[]): void {
    const held = this.store.get("$:/Import");
    const tiddlers = { ...(held?.["plugin-type"] === "import" ? held["tiddlers"] as object : {}), ...Object.fromEntries(fieldsList.map((f) => [String(f["title"]), f])) };
    this.write("$:/Import", { "plugin-type": "import", status: "pending", tiddlers });
  }
  receive(ev: LarMsg_ControlEvent): Status {
    if (ev.mountEpoch !== this.epoch) return "stale-target";
    const target = ev.controlId ?? ev.renderId ?? "";
    const wv = ev.wholeValue;
    if (ev.action === "lar:key") {
      if (target === "kb" && ev.key?.keyCode === 13) { this.write("lar:///t/keys/hit", { text: "enter" }); return "applied"; }
      if (target === "lar:document" && ev.key && matchChord({ keyCode: ev.key.keyCode, ctrlKey: ev.modifiers?.ctrl ?? false, shiftKey: ev.modifiers?.shift ?? false, altKey: ev.modifiers?.alt ?? false, metaKey: ev.modifiers?.meta ?? false }, this.chords)) {
        const shortcut = [...this.store.values()].find((t) => (t["tags"] as string[] | undefined)?.includes("$:/tags/KeyboardShortcut"));
        const set = setField(String(shortcut?.["text"] ?? ""));
        if (set) this.write(set.title, { text: set.text });
        return "applied";
      }
      return "refused:unclaimed";
    }
    if ((ev.action === "lar:import-offer" && target === "pick") || (ev.action === "lar:drop" && target === "zone")) {
      if (typeof wv !== "string") return "refused:unsupported-control";
      this.park(JSON.parse(wv) as Fields[]);
      return "applied";
    }
    if (ev.action === "lar:perform-import" && target === "$:/Import") {
      const imp = this.store.get("$:/Import");
      if (imp?.["plugin-type"] !== "import") return "refused:binding-unavailable";
      for (const f of Object.values(imp["tiddlers"] as Record<string, Fields>)) this.write(String(f["title"]), f);
      this.write("$:/Import", { "plugin-type": undefined, tiddlers: undefined, status: "complete" });
      return "applied";
    }
    if (ev.action === "lar:drop" && target === "dz" && Array.isArray(wv)) {
      for (const title of wv as string[]) this.write("lar:///t/drop/log", { text: `${title}+${modifierOf(ev.modifiers)}` });
      return "applied";
    }
    if (ev.action === "lar:order" && target === "order" && Array.isArray(wv)) {
      const members = (this.store.get("lar:///t/drop/order")?.["list"] ?? []) as string[];
      const asked = [...new Set(wv as string[])].filter((id) => members.includes(id));
      this.write("lar:///t/drop/order", { list: [...asked, ...members.filter((id) => !asked.includes(id))] });
      return "applied";
    }
    if (ev.action === "lar:click" && (target === "dx" || target === "dy")) {
      const subject = target === "dx" ? "lar:///t/confirm/x" : "lar:///t/confirm/y";
      this.messages.push("tm-delete-tiddler");
      this.question = { title: `q${++this.questions}`, subject, snapshot: JSON.stringify(this.store.get(subject)) };   // a newer ask withdraws the older
      return "applied";
    }
    if (ev.action === "lar:click" && this.question && target === `yes-${this.question.title}`) {
      const q = this.question;
      this.question = null;
      this.messages.push("tm-confirm");
      if (JSON.stringify(this.store.get(q.subject)) !== q.snapshot) { this.store.set("$:/temp/alerts/confirm", { title: "$:/temp/alerts/confirm" }); return "applied"; }
      this.messages.push("tm-delete-tiddler", "tm-auto-save-wiki");
      this.write(q.subject, null);
      this.store.set("$:/StoryList", { title: "$:/StoryList", list: ((this.store.get("$:/StoryList")?.["list"] ?? []) as string[]).filter((t) => t !== q.subject) });
      return "applied";
    }
    return "stale-target";
  }
}

const wrapped = (selector: string): string =>
  selector.split(/\s+/).map((c) => /^([a-zA-Z][\w-]*)((?:\.[\w-]+)+)(.*)$/.exec(c)).map((m, i) => m ? `${m[2]} ${m[1]}${m[3]}` : selector.split(/\s+/)[i]!).join(" ");
const until = async (check: () => boolean): Promise<boolean> => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  return check();
};
const keydown = (node: EventTarget, key: { key: string; code: string; keyCode: number }, m?: { ctrl: boolean; meta: boolean; alt: boolean; shift: boolean }): KeyboardEvent => {
  const e = new KeyboardEvent("keydown", { key: key.key, code: key.code, bubbles: true, cancelable: true, composed: true, ctrlKey: m?.ctrl, metaKey: m?.meta, altKey: m?.alt, shiftKey: m?.shift });
  Object.defineProperty(e, "keyCode", { value: key.keyCode });
  node.dispatchEvent(e);
  return e;
};
const OUTSIDE = (title: string): boolean => title.startsWith("$:/temp/") || title === "$:/StoryList" || title === "$:/HistoryList";

async function run(n: string, script: Script): Promise<void> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const sink = createProjectionSink(host);
  const sent: LarMsg_ControlEvent[] = [];
  sink.arm({ sendControlEvent: (_s, ev) => { sent.push(ev); } });
  const root = host.shadowRoot!;
  const pane = (): HTMLElement => root.querySelector<HTMLElement>(".lar-projection")!;
  const island = new OfferIsland(n, script.world);
  let answers: string[] = [];
  let writesSeen = 0;
  let messagesSeen = 0;
  const lastAct = new Map<string, { relayed: boolean; defaultPrevented: boolean }>();
  let lastControl = "";
  const el = (control: string): HTMLElement => {
    const found = pane().querySelector<HTMLElement>(control) ?? pane().querySelector<HTMLElement>(wrapped(control));
    if (!found) throw new Error(`the page shows no ${control}`);
    return found;
  };
  const idOf = (control: string): string => {
    const node = el(control);
    return node.closest("[data-control-id]")?.getAttribute("data-control-id") ?? node.closest("[data-lar-rid]")!.getAttribute("data-lar-rid")!;
  };

  for (const [index, step] of script.steps.entries()) {
    const at = `step ${index + 1}`;
    if ("frame" in step) {
      expect(sink.apply(island.render()), `${at}: the sink paints`).toBe("painted");
    } else if ("write" in step) {
      island.peerWrite((step["write"] as { records: { title: string; fields?: Fields }[] }).records);
    } else if ("act" in step) {
      const a = step["act"] as { control: string; action: string; wholeValue?: unknown; key?: { key: string; code: string; keyCode: number }; modifiers?: { ctrl: boolean; meta: boolean; alt: boolean; shift: boolean } };
      const mark = sent.length;
      lastControl = a.control;
      let prevented = false;
      if (a.action === "lar:key") {
        prevented = keydown(a.control === "lar:document" ? document.body : el(a.control), a.key!, a.modifiers).defaultPrevented;
      } else if (a.action === "lar:import-offer") {
        const input = el(a.control) as HTMLInputElement;
        const dt = new DataTransfer();
        dt.items.add(new File([String(a.wholeValue)], "import.json", { type: "application/json" }));
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (a.action === "lar:drop") {
        const dt = new DataTransfer();
        const oversize = typeof a.wholeValue === "string" ? /^<oversize: (\d+) bytes>$/.exec(a.wholeValue) : null;
        if (oversize) dt.items.add(new File([new Uint8Array(Number(oversize[1]))], "big.bin"));
        else if (Array.isArray(a.wholeValue)) dt.setData("text/x-lar-titles", JSON.stringify(a.wholeValue));
        else dt.setData("text/vnd.tiddler", String(a.wholeValue));
        const e = new DragEvent("drop", { bubbles: true, cancelable: true, composed: true, dataTransfer: dt, shiftKey: a.modifiers?.shift ?? false, ctrlKey: a.modifiers?.ctrl ?? false });
        el(a.control).dispatchEvent(e);
        prevented = e.defaultPrevented;
      } else if (a.action === "lar:order") {
        const list = pane().querySelector(`lar-order-list[data-control-id="${a.control}"]`)!;
        const shown = [...list.querySelectorAll("li[data-item-id]")].map((li) => li.getAttribute("data-item-id")!);
        const want = a.wholeValue as string[];
        const at2 = want.findIndex((id, i) => shown[i] !== id);
        if (want.length === shown.length && [...want].sort().join() === [...shown].sort().join() && at2 >= 0) {
          const dt = new DataTransfer();
          list.querySelector(`li[data-item-id="${want[at2]}"]`)!.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
          list.querySelector(`li[data-item-id="${shown[at2]}"]`)!.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
          expect([...list.querySelectorAll("li[data-item-id]")].map((li) => li.getAttribute("data-item-id")), `${at}: one drag reached the order`).toEqual(want);
        } else {
          list.dispatchEvent(new CustomEvent("lar-order", { bubbles: true, detail: { ids: want } }));
        }
      } else if (a.action === "lar:perform-import") {
        pane().querySelector<HTMLButtonElement>(`lar-action[data-control-id="${a.control}"] button`)!.click();
      } else {
        el(a.control).click();
      }
      const relayed = await until(() => sent.length > mark) && sent.length === mark + 1;
      if (!relayed) await new Promise((r) => setTimeout(r, 30));
      lastAct.set(a.control, { relayed: sent.length > mark, defaultPrevented: prevented });
      if (sent.length > mark) {
        expect(sent.length, `${at}: one gesture, one relay`).toBe(mark + 1);
        const ev = sent[mark]!;
        expect([ev.kind, ev.action], `${at}: the relayed act`).toEqual(["lar:act", a.action]);
        if (a.wholeValue !== undefined) expect(ev.wholeValue, `${at}: the whole value`).toEqual(a.wholeValue);
        if (a.control === "lar:document") expect(ev.controlId).toBe("lar:document");
        const status = island.receive(ev);
        answers.push(status);
        const [kind, reason] = status.split(":") as ["applied" | "stale-target" | "refused", string | undefined];
        sink.applyResult(mkLarControlResult({ eventId: ev.eventId, cameraId: ev.cameraId, mountEpoch: island.epoch, ...(ev.renderId ? { renderId: ev.renderId } : { controlId: ev.controlId! }), status: kind, ...(reason ? { reason: reason as "unclaimed" } : {}) }));
      }
    } else if ("expect" in step) {
      const want = step["expect"] as Record<string, unknown>;
      for (const [key, spec] of Object.entries(want)) {
        if (key === "answers") { expect(answers, `${at}: answers`).toEqual(spec); continue; }
        if (key === "writes") {
          const records = spec as Fields[];
          const named = new Set(records.map((r) => String(r["title"])));
          expect(island.written.slice(writesSeen).filter((t) => !named.has(t) && !OUTSIDE(t)), `${at}: no stray write`).toEqual([]);
          for (const r of records) {
            const held = island.store.get(String(r["title"]));
            if (r["tombstone"] === true) { expect(held, `${at}: ${String(r["title"])} deleted`).toBeUndefined(); continue; }
            for (const [f, v] of Object.entries(r)) if (f !== "title") expect(held?.[f], `${at}: ${String(r["title"])} ${f}`).toEqual(v);
          }
          continue;
        }
        if (key === "messages") { expect(island.messages.slice(messagesSeen), `${at}: the island's messages`).toEqual(spec); continue; }
        if (key === "refused") {
          const words = String(spec);
          const last = lastAct.get(lastControl);
          if (/^[a-z]+(?:-[a-z]+)*$/.test(words)) {
            const out = [...root.querySelectorAll<HTMLOutputElement>('output[role="status"]')].find((o) => o.dataset["larFor"] === idOf(lastControl));
            expect(out?.dataset["larReason"], `${at}: the refusal beside ${lastControl}`).toBe(words);
          }
          expect(last?.relayed, `${at}: the refused gesture never crossed`).toBe(false);
          continue;
        }
        if (key === "frame") {
          for (const [fk, fv] of Object.entries(spec as Record<string, unknown>)) {
            const html = pane().innerHTML;
            if (fk === "stamps") {
              for (const [sel, attrs] of Object.entries(fv as Record<string, Record<string, string>>)) {
                for (const [attr, value] of Object.entries(attrs)) expect(el(sel).getAttribute(attr), `${at}: ${sel} paints ${attr}`).toBe(value);
              }
            } else if (fk === "keys") {
              for (const [name, s] of Object.entries(fv as Record<string, { contains: string }>)) {
                expect(JSON.stringify(island.current.keys.find((k) => k.key === name)), `${at}: the ${name} key`).toContain(s.contains);
              }
            } else if (fk === "contains") {
              expect(html, `${at}: the pane paints ${String(fv)}`).toContain(String(fv).replace(/"/g, "\""));
            } else if (fk === "questions") {
              expect(pane().querySelectorAll('[aria-modal="true"]').length, `${at}: questions painted`).toBe(fv);
            } else if (fk === "questionSubject") {
              expect(pane().querySelector('[aria-modal="true"]')?.textContent, `${at}: the question names its subject`).toContain(String(fv));
            } else if (fk === "alert") {
              expect(island.store.has(String(fv)), `${at}: the island raised ${String(fv)}`).toBe(true);
            } else {
              throw new Error(`${at}: the page harness reads no frame.${fk}`);
            }
          }
          continue;
        }
        if (key === "page") {
          for (const [control, s] of Object.entries(spec as Record<string, Record<string, unknown>>)) {
            const last = lastAct.get(control);
            if (s["relayed"] !== undefined) expect(last?.relayed, `${at}: ${control} relayed`).toBe(s["relayed"]);
            if (s["defaultPrevented"] !== undefined) expect(last?.defaultPrevented, `${at}: ${control} defaultPrevented`).toBe(s["defaultPrevented"]);
            if (s["refusal"] !== undefined) {
              const out = [...root.querySelectorAll<HTMLOutputElement>('output[role="status"]')].find((o) => o.dataset["larFor"] === idOf(control));
              expect(out?.dataset["larReason"], `${at}: the refusal beside ${control}`).toBe(s["refusal"]);
            }
          }
          continue;
        }
        throw new Error(`${at}: the page harness reads no expect.${key}`);
      }
      answers = [];
      writesSeen = island.written.length;
      messagesSeen = island.messages.length;
    } else {
      throw new Error(`the page harness reads no verb in ${JSON.stringify(step)}`);
    }
  }
  host.remove();
}

describe("★ interaction goldens, the page half: keys, import, drop and order, the confirm road ★", () => {
  test(`07 · ${script07.pins}`, async () => { await run("07", script07 as unknown as Script); });
  test(`09 · ${script09.pins}`, async () => { await run("09", script09 as unknown as Script); });
  test(`10 · ${script10.pins}`, async () => { await run("10", script10 as unknown as Script); });
  test(`11 · ${script11.pins}`, async () => { await run("11", script11 as unknown as Script); });

  test("NONSENSE CONTROL: a script claiming the undeclared key crossed reds", async () => {
    const broken = structuredClone(script07) as unknown as { steps: Step[] };
    const at = broken.steps.findIndex((s) => JSON.stringify(s).includes("the page relays no undeclared key"));
    broken.steps[at] = { expect: { page: { "input.search": { relayed: true } } } };
    await expect(run("07", broken as unknown as Script)).rejects.toThrow(/input\.search relayed/);
  });
  test("NONSENSE CONTROL: a script claiming the oversize drop crossed and parked reds", async () => {
    const broken = structuredClone(script09) as unknown as { steps: Step[] };
    broken.steps[broken.steps.length - 1] = { expect: { answers: ["applied"] } };
    await expect(run("09", broken as unknown as Script)).rejects.toThrow(/answers/);
  });
});
