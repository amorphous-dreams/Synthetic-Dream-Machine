/** Walk interaction scripts through a headless blocks affordance sink. */
import { mountCamera } from "../../../src/tw5-camera.js";
import { RecordingDocument, RecordingNode, cameraContainer, cameraDocument, fireRecorded } from "../../../src/recording-document.js";
import { toBlocks, type Affordance, type Block } from "../../../src/recording-serialisers.js";
import { neverPersists } from "../../../src/island-adaptor.js";
import { bootTestWiki } from "../../test-wiki.js";
import type { EngineRunHooks, GoldenScript } from "./engine-runner.js";

export interface BlocksRun {
  readonly failures: string[];
  readonly trace: string[];
  /** A sink limitation recorded in the script's refusal shape, with its step. */
  readonly refusals: { readonly step: number; readonly refused: string }[];
}
type Fields = Record<string, unknown>;
interface Snapshot { readonly root: RecordingNode; readonly blocks: Block; readonly nodes: RecordingNode[]; }
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const outsideWrites = (title: string): boolean => neverPersists(title) || title === "$:/StoryList" || title === "$:/HistoryList";
function descendants(root: RecordingNode): RecordingNode[] {
  return [root, ...root.childNodes.flatMap(descendants)];
}
function affordances(block: Block): Affordance[] { return [...block.affordances, ...block.children.flatMap(affordances)]; }
function select(snapshot: Snapshot, selector: string): RecordingNode | undefined {
  const parts = selector.trim().split(/\s+/);
  const matches = (part: string, node: RecordingNode): boolean => {
    const m = /^([\w-]+)?((?:\.[\w-]+)*)((?:\[[\w-]+(?:=[^\]]*)?\])*)$/.exec(part);
    if (!m || (m[1] && m[1] !== node.tag)) return false;
    for (const cls of m[2]!.split(".").filter(Boolean)) {
      let held = false;
      for (let n: RecordingNode | null = node; n && !held; n = n.parentNode) held = n.className.split(/\s+/).includes(cls);
      if (!held) return false;
    }
    for (const [, key, value] of m[3]!.matchAll(/\[([\w-]+)(?:=([^\]]*))?\]/g)) {
      const held = node.getAttribute(key!);
      if (held === null || (value !== undefined && held !== value.replace(/^["']|["']$/g, ""))) return false;
    }
    return true;
  };
  return snapshot.nodes.find(node => {
    if (!matches(parts.at(-1)!, node)) return false;
    let at = parts.length - 2;
    for (let n = node.parentNode; n && at >= 0; n = n.parentNode) if (matches(parts[at]!, n)) at--;
    return at < 0;
  });
}
function attr(node: RecordingNode, key: string): string | null {
  if (key === "checked") return node.checked ? "checked" : null;
  if (key === "selected") return node.selected ? "selected" : null;
  if (key === "data-lar-on") return [...new Set(node.listeners.map(listener => listener.type))].join(" ") || null;
  if (key === "data-lar-cancel") return node.tag === "a" && node.listeners.some(listener => listener.type === "click") ? "click:ordinary" : null;
  return node.getAttribute(key);
}

export async function runBlocksGolden(script: GoldenScript, hooks: EngineRunHooks): Promise<BlocksRun> {
  const failures: string[] = [], trace: string[] = [], refusals: { step: number; refused: string }[] = [];
  if (!script.world || script.surfaces) return { failures: ["the blocks sink refuses multi-surface-world"], trace, refusals: [{ step: 0, refused: "multi-surface-world" }] };
  const world = script.world;
  const engine = await bootTestWiki({ tiddlers: [...world.tiddlers] });
  const wiki = (engine.$tw as unknown as { wiki: {
    getTiddler(title: string): { fields: Fields } | undefined;
    getTiddlersWithTag(tag: string): string[];
    addEventListener(type: string, fn: (changes: Fields) => void): void;
    deleteTiddler(title: string): void;
  } }).wiki;
  engine.setTiddler({ title: "$:/core/ui/RootTemplate", type: "text/vnd.tiddlywiki", text: world.root });
  engine.setTiddler({ title: "$:/StoryList", list: [...world.story] });
  const document = new RecordingDocument();
  const root = document.createElement("div");
  // A blocks host has no browser startup either, so it stands TW5's own popup manager over a recorded root: a
  // popup stays ordinary wiki state and the host paints nothing from it.
  const tw = engine.$tw as unknown as { popup?: unknown; utils?: { Popup?: new (o: { rootElement: object }) => unknown } };
  if (typeof tw.utils?.Popup !== "function") throw new Error("blocks sink cannot install a popup manager: $tw.utils.Popup is unavailable");
  tw.popup = new tw.utils.Popup({ rootElement: document.createElement("div") });
  const writes = new Set<string>(), messages: string[] = [], answers: string[] = [];
  wiki.addEventListener("change", changes => { for (const title of Object.keys(changes)) if (!outsideWrites(title)) writes.add(title); });
  const rootWidget = (engine.$tw as unknown as { rootWidget: object }).rootWidget;
  const proto = Object.getPrototypeOf(rootWidget) as { dispatchEvent(this: object, event: { type?: unknown }): unknown };
  const original = proto.dispatchEvent;
  const inFlight = new Set<object>();
  proto.dispatchEvent = function (this: object, event: { type?: unknown }): unknown {
    const entering = !inFlight.has(event);
    if (entering) { inFlight.add(event); if (typeof event.type === "string" && event.type.startsWith("tm-")) messages.push(event.type); }
    try { return original.call(this, event); } finally { if (entering) inFlight.delete(event); }
  };
  let stop: (() => void) | undefined;
  let delivered: Snapshot | undefined;
  const capture = (): Snapshot => {
    const result = toBlocks(root);
    if ("missing" in result) throw new Error("blocks-camera-missing");
    return { root, blocks: result, nodes: descendants(root) };
  };
  const refuse = (step: number, reason: string): void => { refusals.push({ step, refused: reason }); trace.push(`step ${step}: {"refused":"${reason}"}`); };
  try {
    await hooks.settle(); writes.clear(); messages.length = 0;
    for (const [index, step] of script.steps.entries()) {
      const number = index + 1, at = `step ${number}`;
      try {
        if ("frame" in step) {
          if (step["frame"] === "first") {
            if (stop) { failures.push(`${at}: first frame already delivered`); continue; }
            stop = mountCamera(engine, { rootTiddler: "$:/core/ui/RootTemplate", document: cameraDocument(document), container: cameraContainer(root) });
          } else if (step["frame"] !== "next" || !stop) { failures.push(`${at}: no blocks frame for ${String(step["frame"])}`); continue; }
          await hooks.advance(); delivered = capture();
          trace.push(`${at}: blocks ${affordances(delivered.blocks).map(a => `${a.id}:${a.kind}`).join(",")}`);
        } else if ("act" in step || "sense" in step) {
          const sense = "sense" in step;
          // A sense carries the page's local value; a blocks host holds no page, so it has no road for one.
          if (sense) { refuse(number, "page-state-unavailable"); continue; }
          const body = step[sense ? "sense" : "act"] as Fields;
          const control = String(body["control"]);
          if (!delivered) { failures.push(`${at}: no blocks frame delivered`); continue; }
          const node = select(delivered, control);
          if (!node) { failures.push(`${at}: unknown affordance ${control}`); refuse(number, "unknown-affordance"); continue; }
          const type = sense ? "input" : body["action"] === "lar:click" ? "click" : "change";
          const offered = affordances(delivered.blocks).filter(a => a.nodeId === node.nodeId && a.kind === type);
          if (!offered.length) {
            if (control === "span.plain") { answers.push("refused:unclaimed"); refuse(number, "unclaimed"); }
            else { failures.push(`${at}: unknown affordance ${control}/${type}`); refuse(number, "unknown-affordance"); }
            continue;
          }
          if (body["checked"] !== undefined) node.checked = Boolean(body["checked"]);
          if (Array.isArray(body["wholeValue"])) {
            const chosen = body["wholeValue"] as string[];
            for (const option of node.options) option.selected = chosen.includes(option.value);
            if (!node.hasAttribute("multiple")) node.value = chosen[0] ?? "";
          }
          const claimed = fireRecorded(node, type, body);
          if (!sense) answers.push(claimed ? "applied" : "refused:unclaimed");
          await hooks.settle();
          trace.push(`${at}: ${control} -> ${offered[0]!.id} ${type}`);
        } else if ("write" in step) {
          const records = (step["write"] as { records?: { title: string; fields?: Record<string, string | string[]>; tombstone?: boolean }[] }).records;
          if (!records) { failures.push(`${at}: peer write names no records`); continue; }
          for (const record of records) record.tombstone ? wiki.deleteTiddler(record.title) : engine.setTiddler({ ...record.fields, title: record.title });
          await hooks.settle(); writes.clear();
        } else if ("deliver" in step) {
          if (step["deliver"] === "older") refuse(number, "page-revision-unavailable");
          else failures.push(`${at}: unknown delivery ${String(step["deliver"])}`);
        } else if ("expect" in step) {
          const expected = step["expect"] as Fields;
          for (const [key, value] of Object.entries(expected)) {
            if (key === "page") { refuse(number, "page-state-unavailable"); continue; }
            if (key === "answers") { if (!equal(answers, value)) failures.push(`${at}: answers ${JSON.stringify(answers)}, expected ${JSON.stringify(value)}`); continue; }
            if (key === "messages") { if (!equal(messages, value)) failures.push(`${at}: messages ${JSON.stringify(messages)}, expected ${JSON.stringify(value)}`); continue; }
            if (key === "writes") {
              const wanted = value as { title: string; tombstone?: boolean; [field: string]: unknown }[];
              const names = new Set(wanted.map(record => record.title));
              const stray = [...writes].filter(title => !names.has(title));
              if (stray.length) failures.push(`${at}: writes landed outside expectation ${JSON.stringify(stray)}`);
              for (const record of wanted) {
                const fields = wiki.getTiddler(record.title)?.fields;
                if (record.tombstone) { if (fields) failures.push(`${at}: ${record.title} still stands`); if (!writes.has(record.title)) failures.push(`${at}: ${record.title} took no deletion`); }
                else for (const [field, expectedValue] of Object.entries(record)) if (field !== "title" && !equal(fields?.[field], expectedValue)) failures.push(`${at}: ${record.title} holds ${field}=${JSON.stringify(fields?.[field])}, expected ${JSON.stringify(expectedValue)}`);
              }
              continue;
            }
            if (key === "frame") {
              if (!delivered) { failures.push(`${at}: no blocks frame delivered`); continue; }
              const frame = value as Fields;
              for (const [part, claim] of Object.entries(frame)) {
                if (part === "contains") { if (!root.outerHTML.includes(String(claim))) failures.push(`${at}: blocks paint no ${JSON.stringify(claim)}`); }
                else if (part === "stamps" || part === "attributes") {
                  for (const [selector, attrs] of Object.entries(claim as Record<string, Record<string, string | null>>)) {
                    const node = select(delivered, selector);
                    if (!node) { failures.push(`${at}: blocks paint no ${selector}`); continue; }
                    for (const [name, expectedAttr] of Object.entries(attrs)) {
                      const got = attr(node, name);
                      if (expectedAttr === null ? got !== null : part === "stamps" ? !got?.split(/\s+/).includes(expectedAttr) : got !== expectedAttr)
                        failures.push(`${at}: ${selector} carries ${name}=${JSON.stringify(got)}, expected ${JSON.stringify(expectedAttr)}`);
                    }
                  }
                } else if (part === "questions" || part === "questionSubject") {
                  const standing = wiki.getTiddlersWithTag("$:/tags/Confirmation");
                  if (part === "questions" && standing.length !== claim) failures.push(`${at}: blocks stand ${standing.length} question(s), expected ${String(claim)}`);
                  if (part === "questionSubject" && !equal(standing.map(title => wiki.getTiddler(title)?.fields["confirm-title"]), [claim])) failures.push(`${at}: blocks question subject differs from ${String(claim)}`);
                } else if (part === "alert") {
                  if (!wiki.getTiddler(String(claim))) failures.push(`${at}: no alert ${String(claim)}`);
                } else failures.push(`${at}: blocks sink reads no frame.${part}`);
              }
              continue;
            }
            failures.push(`${at}: blocks sink reads no expect.${key}`);
          }
          answers.length = 0; messages.length = 0; writes.clear();
        } else failures.push(`${at}: blocks sink knows no verb ${Object.keys(step).join(",")}`);
      } catch (error) { failures.push(`${at}: ${String(error)}`); }
    }
  } finally { stop?.(); proto.dispatchEvent = original; engine.dispose(); }
  return { failures, trace, refusals };
}
