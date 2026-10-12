/**
 * tw5-projection — the projection-nalu, render-side twin of the capture-nalu.
 *
 * The BROWSER twin of the node disk projector (island-behaviors.ts `onBoot`): same
 * `makeWikiBehavior({ onBoot })` capability shore, same render-then-emit shape — node emits
 * rendered state TO FS, the browser emits it TO THE MAIN THREAD. role = capability ≠ platform.
 *
 * The island's TW5 engine lives in the Worker (§9), so the cameras live here: render the story
 * river + page stylesheet into `$tw.fakeDocument`, serialize to HTML+CSS, and emit COALESCED
 * `projection:frame` events. The main thread applies each frame to a shadow root. Widget handlers
 * stay live in the worker on the fake DOM; the main thread returns DOM events by render-id, and this
 * module dispatches them into the native TW5 handler. The nalu is COALESCE-to-latest (newest snapshot
 * supersedes; a burst of wiki changes collapses to one post), not the capture-nalu's
 * accumulate-every-record.
 *
 * Isomorphic: uses only `$tw.fakeDocument` (no window.document) — safe in @lararium/tw5.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/tw5-projection
 */

import type { IslandContext } from "./island-context.js";
import { mountCamera, TW5_ROOT_TEMPLATE, TW5_PAGE_STYLESHEET } from "./tw5-camera.js";
import { tw5ElementToHtml } from "./fake-dom.js";
import { makeProjectedViewContract } from "./tw5-host-bridge.js";
import { CoalesceGate } from "@lararium/mesh";

/** The `IslandMsg_Event.listenable` discriminator for a rendered projection frame. */
export const PROJECTION_FRAME = "projection:frame";

/** Coalesce window (ms): a burst of wiki "change" events collapses to one posted frame. Small
 *  (one display frame-ish) — interactive display, not the capture-nalu's 2 s recall budget.
 *
 *  FIXED BY DESIGN — do NOT add a window servo here. The prior-art survey (rAF/React
 *  scheduler · NIC/Net-DIM coalescing · AIMD · triple-buffering) is decisive: a display-bound,
 *  newest-wins projection's optimal window is structurally the frame interval — there is nothing to
 *  discover, so tuning it only adds instability. The DOM gate's correct self-regulation IS staying
 *  frame-pinned (overrun → frame-skip, never a wider window). Only the variable-cost RECONCILE gate
 *  (disk-projector's KeyedCoalesceGate) servos its window. role = physics ≠ uniformity. */
const COALESCE_MS = 24;

/** A patched fake-DOM element: TW5's fakedom drops `addEventListener` (a no-op), severing only the
 *  DOM-node→widget binding. We patch it to STORE the handler TW5 builds + stamp a `data-lar-rid`
 *  (which rides the serialized HTML), so a relayed main-thread event maps back to the live node. */
interface RidNode {
  attributes: Record<string, string | undefined>;
  setAttribute(name: string, value: string): void;
  _larListeners?: { type: string; handler: ((ev: unknown) => void) | { handleEvent(ev: unknown): void } }[];
  /** The field's live text. TW5's edit widgets read `domNodes[0].value`, so the input leg writes it here. */
  value?: string;
  selectionStart?: number;
  selectionEnd?: number;
  offsetLeft?: number;
  offsetTop?: number;
  offsetWidth?: number;
  offsetHeight?: number;
  _larRect?: { top: number; left: number; right: number; bottom: number; width: number; height: number; x: number; y: number };
}
const ridMap = new Map<string, RidNode>();
interface ProjectionEventScope {
  wikiUri: string;
  popupRoot: RidNode;
  renderIds: Set<string>;
  liveIds: Set<string>;
  mark?: () => void;
  pendingAnswer?: { readonly renderId: string; readonly eventType: string; readonly wikiUri: string };
  pendingRefusal?: { readonly capability: "view.confirm"; readonly message: string };
}
const eventScopes = new Map<string, ProjectionEventScope>();
let activeEventScope: ProjectionEventScope | undefined;
let ridSeq = 0;
const FAKE_DOM_ANIMATION_PATCHED = Symbol("lararium.fake-dom-animation-patched");

/** Patch the fake-element prototype once per worker (the RETURN-leg capability the fakedom platform
 *  lacks): restore listener-storage + render-id stamping + the two reads TW5's click handler makes
 *  on the now-live node (getBoundingClientRect, hasAttribute). role = capability ≠ platform. */
export function patchFakeElementForEvents(fakeDoc: { createElement(t: string): RidNode }): void {
  const proto = Object.getPrototypeOf(fakeDoc.createElement("div")) as Record<string, unknown>;
  if (proto["_larEventsPatched"]) return;
  proto["_larEventsPatched"] = true;
  proto["addEventListener"] = function (this: RidNode, type: string, handler: ((ev: unknown) => void) | { handleEvent(ev: unknown): void }): void {
    let rid = this.attributes["data-lar-rid"];
    if (rid === undefined) {
      rid = String(++ridSeq);
      this.setAttribute("data-lar-rid", rid);
    }
    (this._larListeners ??= []).push({ type, handler });
    ridMap.set(rid, this);
    if (activeEventScope) {
      eventScopes.set(rid, activeEventScope);
      activeEventScope.renderIds.add(rid);
    }
  };
  proto["removeEventListener"] = function (this: RidNode, type: string, handler: unknown): void {
    if (!this._larListeners) return;
    this._larListeners = this._larListeners.filter((listener) => listener.type !== type || listener.handler !== handler);
  };
  proto["getBoundingClientRect"] = function (this: RidNode): unknown {
    if (!this._larRect) {
      throw new Error("CapabilityRefused: DOM geometry requires an event-time rectangle carried from the page");
    }
    return this._larRect;
  };
  proto["hasAttribute"] = function (this: RidNode, name: string): boolean {
    return this.attributes[name] !== undefined;
  };
  // The caret verbs an edit widget calls on the node it just read. They mean nothing on a fake element
  // (the caret lives in the real DOM the main thread paints), and TW5 calls them unconditionally — so
  // they answer, and answer harmlessly, rather than throwing mid-handler and swallowing the edit.
  proto["focus"]             = function (): void { /* the caret sits main-side */ };
  proto["blur"]              = function (): void { /* likewise */ };
  proto["select"]            = function (): void { /* likewise */ };
  proto["setSelectionRange"] = function (this: RidNode, start: number, end: number): void {
    this.selectionStart = start; this.selectionEnd = end;
  };
}

/**
 * TW5 installs its Animator only in a browser startup. A retained reveal nevertheless calls
 * `$tw.anim.perform()` unconditionally, even in the fake-DOM worker, and relies on the close
 * callback to apply its final `hidden` state. Supply that missing capability at the projection
 * shore: fake nodes complete synchronously; any existing animator keeps authority over real nodes.
 */
export function patchFakeDomAnimation(tw: Record<string, any>): void {
  const existing = tw.anim as ({
    perform?: (type: unknown, domNode: unknown, options?: unknown) => void;
    [FAKE_DOM_ANIMATION_PATCHED]?: true;
  } | undefined);
  if (existing?.[FAKE_DOM_ANIMATION_PATCHED]) return;
  const perform = existing?.perform;
  tw.anim = {
    ...existing,
    [FAKE_DOM_ANIMATION_PATCHED]: true,
    perform(type: unknown, domNode: { isTiddlyWikiFakeDom?: boolean }, options?: { callback?: () => void }): void {
      if (!domNode.isTiddlyWikiFakeDom && typeof perform === "function") {
        perform.call(existing, type, domNode, options);
        return;
      }
      options?.callback?.();
    },
  };
}

/**
 * Dispatch a relayed TEXT event: write the value onto the resolved node, then run TW5's own handler.
 *
 * TW5's edit widgets read `this.domNodes[0].value` inside their input handler — they never read the
 * event. So the value lands on the NODE first, and the handler that follows reads it exactly where it
 * reads a local keystroke: `saveChanges` fires, the tiddler writes, the wiki changes, the projection
 * re-renders. TW5 never learns the keystroke crossed a thread.
 *
 * The caret rides to the end of the written value, because the main thread holds the real caret and the
 * fake node holds none — a widget that reads a selection reads a coherent one rather than a stale one.
 *
 * A miss (an unknown render-id) drops silently: it names a stale frame, never an error (Hiatus).
 */
export function dispatchProjectedInput(renderId: string, eventType: string, value: string): "dispatched" | "stale-target" {
  const el = ridMap.get(renderId);
  const scope = eventScopes.get(renderId);
  if (!el || (scope && !scope.liveIds.has(renderId))) return answerStaleTarget(renderId, eventType, scope);
  if (scope) activeEventScope = scope;
  el.value = value;
  el.selectionStart = el.selectionEnd = value.length;
  const ev = { type: eventType, target: el, currentTarget: el, preventDefault() {}, stopPropagation() {} };
  for (const l of el._larListeners ?? []) {
    if (l.type === eventType) invokeFakeListener(l.handler, ev);
  }
  return "dispatched";
}

/**
 * Dispatch a relayed main-thread DOM event into TW5's NATIVE path: resolve the fake node by its
 * render-id and invoke the handler TW5 itself stored. From there (handleClickEvent → tm-navigate →
 * navigator → story change → re-project) the widget tree runs as if the event were local — TW5
 * never learns it crossed a thread. A miss answers `stale-target` to the page and marks that result
 * into the next absolute projection.
 */
export function dispatchProjectedEvent(renderId: string, eventType: string, fields: Record<string, number | boolean>): "dispatched" | "stale-target" {
  const el = ridMap.get(renderId);
  const scope = eventScopes.get(renderId);
  if (!el || (scope && !scope.liveIds.has(renderId))) return answerStaleTarget(renderId, eventType, scope);
  if (scope) activeEventScope = scope;
  const left = numericField(fields, "rectLeft");
  const top = numericField(fields, "rectTop");
  const width = numericField(fields, "rectWidth");
  const height = numericField(fields, "rectHeight");
  if (left !== undefined && top !== undefined && width !== undefined && height !== undefined) {
    const right = numericField(fields, "rectRight") ?? left + width;
    const bottom = numericField(fields, "rectBottom") ?? top + height;
    // TW5 Popup reads the fake node's bounding box and offset dimensions while opening a popup.
    // These whole geometry values were measured on the main thread for this exact click.
    el._larRect = { top, left, right, bottom, width, height, x: left, y: top };
    el.offsetLeft = left;
    el.offsetTop = top;
    el.offsetWidth = width;
    el.offsetHeight = height;
  }
  // TW5 navigator.js reads event.event.view before save/cancel/rename. A worker event carries the
  // worker-local, explicitly refusing view capability; no global `window` or DOM crosses the seam.
  const event = {
    type: eventType, target: el, currentTarget: el, ...fields,
    view: makeProjectedViewContract((capability, message) => {
      if (scope) {
        scope.pendingRefusal = { capability, message };
        scope.mark?.();
      }
    }),
    preventDefault() {}, stopPropagation() {},
  };
  const ev = event;
  // TW5 binds its popup closer on the document capture leg; run that before the target's widget
  // handler so a click that opens a popup cannot immediately close the popup it just opened.
  if (eventType === "click") {
    for (const l of scope?.popupRoot._larListeners ?? []) {
      if (l.type === "click") invokeFakeListener(l.handler, ev);
    }
  }
  for (const l of el._larListeners ?? []) {
    if (l.type === eventType) invokeFakeListener(l.handler, ev);
  }
  return "dispatched";
}

function answerStaleTarget(
  renderId: string,
  eventType: string,
  scope = eventScopes.get(renderId) ?? activeEventScope,
): "stale-target" {
  if (scope) {
    scope.pendingAnswer = { renderId, eventType, wikiUri: scope.wikiUri };
    scope.mark?.();
  }
  console.warn(`[wiki-worker] stale-target: ${renderId}`);
  return "stale-target";
}

function invokeFakeListener(handler: ((ev: unknown) => void) | { handleEvent(ev: unknown): void }, event: unknown): void {
  if (typeof handler === "function") handler(event);
  else handler.handleEvent(event);
}

function numericField(fields: Record<string, number | boolean>, key: string): number | undefined {
  const value = fields[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Mount the projection on a live wiki island. Returns a teardown (the `onBoot` contract).
 */
export function mountProjection(ctx: IslandContext): () => void {
  // Widen the booted $tw for the loose internal TW5 surface (fakeDocument, Tiddler) the typed
  // engine facade does not expose — the same loose-access the cameras take.
  const tw = ctx.tw5.$tw as unknown as Record<string, any>;
  const fakeDoc = tw.fakeDocument;
  // A retained <$reveal> calls $tw.anim for its lifecycle completion even though this worker's
  // fake DOM cannot animate. Install the fake-node completion before the camera can render one.
  patchFakeDomAnimation(tw);
  // Arm the interactivity RETURN leg before the camera renders (so every widget that binds a
  // listener gets its render-id stamped + handler stored).
  patchFakeElementForEvents(fakeDoc);
  // The worker's fake document has no browser startup, which normally stands TW5's Popup. Reuse
  // TW5's own manager over a fake root so popup state remains ordinary wiki state and every frame
  // remains a complete HTML+CSS snapshot.
  const scope: ProjectionEventScope = { wikiUri: ctx.wikiUri, popupRoot: fakeDoc.createElement("div"), renderIds: new Set(), liveIds: new Set() };
  activeEventScope = scope;
  if (typeof tw.utils?.Popup !== "function") {
    throw new Error("TW5 projection cannot install its own popup manager: $tw.utils.Popup is unavailable");
  }
  const popupManager = new tw.utils.Popup({ rootElement: scope.popupRoot });
  tw.popup = popupManager;
  // ($:/SiteTitle "Lararium" + $:/SiteSubtitle "Welcome to the DreamNet" ride the lares plugin
  //  blob as source tiddlers — tiddlers/site-{title,subtitle}.tid — CID-carried, ratchet via
  //  re-genesis, user-overridable (a plugin shadow loaded after $:/core, overridden by ordinary).)

  // Story camera — the default TW5 view frustum, rendered into the fake DOM. mountCamera owns
  // the live `change → widget.refresh()` loop; we re-snapshot on the same change beat.
  const storyContainer = fakeDoc.createElement("div");
  const stopStory = mountCamera(ctx.tw5, {
    rootTiddler: TW5_ROOT_TEMPLATE,
    document:    fakeDoc,
    container:   storyContainer,
  });

  // Stylesheet camera — PageStylesheet → a fake <style>; we read its textContent. (The fakeDocument
  // half of mountPanel; the shadow-root half lives main-side.)
  const styleWidget = tw.wiki.makeTranscludeWidget(TW5_PAGE_STYLESHEET, {
    document:     fakeDoc,
    parentWidget: tw.rootWidget,
  });
  const styleContainer = fakeDoc.createElement("style");
  styleWidget.render(styleContainer, null);

  // Coalesce-family gate (mesh/projection-nalu): a burst of wiki changes collapses to one frame;
  // the newest snapshot wins, intermediates fade (the decay-envelope). The flush snapshots the
  // live fakeDOM lazily at the crest — `mark()` only says "the source moved".
  const gate = new CoalesceGate({
    windowMs: COALESCE_MS,
    onFlush: (rev) => {
      let html = tw5ElementToHtml(storyContainer);
      scope.liveIds = new Set([...html.matchAll(/data-lar-rid="([^"]+)"/g)].map((match) => match[1]!));
      if (scope.pendingAnswer) {
        const answer = scope.pendingAnswer;
        const attr = (value: string): string => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
        html += `<output role="status" aria-live="polite" data-lar-interaction-result="stale-target" data-lar-source-rid="${attr(answer.renderId)}" data-lar-source-event="${attr(answer.eventType)}" data-lar-source-wiki="${attr(answer.wikiUri)}">stale-target</output>`;
        delete scope.pendingAnswer;
      }
      if (scope.pendingRefusal) {
        const refusal = scope.pendingRefusal;
        const attr = (value: string): string => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
        html += `<output role="status" aria-live="polite" data-lar-interaction-result="capability-refused" data-lar-capability="${refusal.capability}">${refusal.capability} refused: ${attr(refusal.message)}</output>`;
        delete scope.pendingRefusal;
      }
      ctx.post({
        schema_version: 1,
        type:           "event",
        wikiUri:        ctx.wikiUri,
        listenable:     PROJECTION_FRAME,
        payload: {
          html,
          css:  styleContainer.textContent ?? "",
          rev,
        },
      });
    },
  });
  scope.mark = () => gate.mark();

  const onChange = (changes: Record<string, unknown>): void => {
    activeEventScope = scope;
    styleWidget.refresh(changes, styleContainer, null);
    gate.mark();
  };
  tw.wiki.addEventListener("change", onChange);

  // First frame — the island's content the moment it breathes.
  gate.mark();

  return () => {
    gate.dispose();
    tw.wiki.removeEventListener("change", onChange);
    stopStory();
    for (const renderId of scope.renderIds) {
      ridMap.delete(renderId);
      eventScopes.delete(renderId);
    }
    scope.liveIds.clear();
    scope.popupRoot._larListeners = [];
    if (tw.popup === popupManager) tw.popup = undefined;
    if (activeEventScope === scope) activeEventScope = undefined;
  };
}
