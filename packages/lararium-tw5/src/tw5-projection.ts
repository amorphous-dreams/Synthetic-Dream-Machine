/**
 * tw5-projection — the projection-nalu, render-side twin of the capture-nalu: the ISLAND side of the camera
 * contract (`@lararium/mesh` lar-camera).
 *
 * The BROWSER twin of the node disk projector (island-behaviors.ts `onBoot`): same
 * `makeWikiBehavior({ onBoot })` capability shore, same render-then-emit shape — node emits
 * rendered state TO FS, the browser emits it TO THE MAIN THREAD. role = capability ≠ platform.
 *
 * The island's TW5 engine lives in the Worker (§9), so the story camera lives here: it renders the root
 * template and the page stylesheet into `$tw.fakeDocument` and emits COALESCED `lar:frame` messages, each a
 * set of keys carrying WHOLE state under its own monotone revision (dreamdom#/the-ruling):
 *
 *   - `lar:surface`    the story container's whole HTML, every frame;
 *   - `lar:style`      the stylesheet's whole CSS, only when its text moved since the mount's last frame;
 *   - `lar:membership` the complete key set, so an omitted key never reads as a deleted one.
 *
 * A frame names the `mountEpoch` the camera minted at mount (re-minted on `lar:resend`, which re-emits every
 * key whole) and, per control, the `sensedRevision` the island had taken in before it rendered.
 *
 * Widget handlers stay live in the worker on the fake DOM. The page returns a person's act as a
 * `lar:control-event`; `dispatchLarControlEvent` resolves the render id to the node TW5 bound, runs TW5's own
 * handler, and answers every reliable act on `lar:control-result`. Frames never answer events.
 *
 * Isomorphic: uses only `$tw.fakeDocument` (no window.document) — safe in @lararium/tw5.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/tw5-projection
 */

import type { IslandContext } from "./island-context.js";
import { mountCamera, TW5_ROOT_TEMPLATE, TW5_PAGE_STYLESHEET } from "./tw5-camera.js";
import { tw5ElementToHtml } from "./fake-dom.js";
import { makeProjectedViewContract } from "./tw5-host-bridge.js";
import {
  CoalesceGate, LAR_CAMERA_STORY, LAR_KEY_MEMBERSHIP, LAR_KEY_STYLE, LAR_KEY_SURFACE, mkLarControlResult, mkLarFrame,
  type IslandToVesselMsg, type LarFrameKey, type LarMsg_ControlEvent, type LarMsg_ControlResult, type LarMsg_Frame,
  type LarMsg_Resend, type LarRefusal, type LarResultStatus,
} from "@lararium/mesh";

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

/** The keys the story camera declares at mount, membership aside. */
const STORY_MEMBERS: readonly string[] = [LAR_KEY_SURFACE, LAR_KEY_STYLE];

/** How many answers a camera keeps for re-answering a repeated `eventId` within one epoch. */
const ANSWER_RING = 256;

/** A patched fake-DOM element: TW5's fakedom drops `addEventListener` (a no-op), severing only the
 *  DOM-node→widget binding. We patch it to STORE the handler TW5 builds + stamp a `data-lar-rid`
 *  (which rides the serialized HTML), so a returned act maps back to the live node. */
interface RidNode {
  attributes: Record<string, string | undefined>;
  setAttribute(name: string, value: string): void;
  _larListeners?: { type: string; handler: ((ev: unknown) => void) | { handleEvent(ev: unknown): void } }[];
  parentNode?: RidNode | null;
  children?: RidNode[];
  /** The field's live text. TW5's edit widgets read `domNodes[0].value`, so the sense and commit legs write it here. */
  value?: string;
  /** A toggle's state as of the act. TW5's checkbox reads `.checked` off its node. */
  checked?: boolean;
  selectionStart?: number;
  selectionEnd?: number;
  offsetLeft?: number;
  offsetTop?: number;
  offsetWidth?: number;
  offsetHeight?: number;
  _larRect?: { top: number; left: number; right: number; bottom: number; width: number; height: number; x: number; y: number };
}
const ridMap = new Map<string, RidNode>();

/** One mounted story camera: the roots it paints, the ids it painted, and its epoch, senses and answers. */
interface CameraScope {
  readonly wikiUri: string;
  readonly cameraId: string;
  readonly popupRoot: RidNode;
  readonly roots: readonly RidNode[];
  renderIds: Set<string>;
  /** The render ids the last frame painted: the only ids an act may name. */
  liveIds: Set<string>;
  /** Declared control ids (`data-control-id`) the last frame painted, by render id. */
  controlIds: Map<string, string>;
  mountEpoch: number;
  /** Per control id, the newest page revision the island took in. */
  readonly sensed: Map<string, number>;
  /** The answers given within this epoch, by eventId. */
  readonly answers: Map<string, LarMsg_ControlResult>;
  post(msg: LarMsg_Frame | LarMsg_ControlResult): void;
  mark(): void;
  resend(): void;
  alert(title: string, text: string): void;
}
const eventScopes = new Map<string, CameraScope>();
const cameras = new Set<CameraScope>();
let activeEventScope: CameraScope | undefined;
let ridSeq = 0;
/** The size of the render-id and event-scope maps, for a witness that reads them across frames. */
export function renderIdCensus(): { nodes: number; scopes: number } {
  return { nodes: ridMap.size, scopes: eventScopes.size };
}

/** Epochs rise across every mount this worker stands, and start past the wall clock, so a page holding an
 *  epoch from a worker that restarted never matches the new one. */
let lastEpoch = 0;
function mintEpoch(): number {
  lastEpoch = Math.max(lastEpoch + 1, Date.now());
  return lastEpoch;
}

/** The island protocol's union names the two `lar:` messages once the wire integration lands; until then this
 *  one cast stands as the seam, and nowhere else. */
function postLar(ctx: IslandContext, msg: LarMsg_Frame | LarMsg_ControlResult): void {
  ctx.post(msg as unknown as IslandToVesselMsg);
}

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
 * Whether `el` still stands in the projected tree: a walk up through each parent's `children` reaches one of
 * the scope's roots. TW5's fakedom `removeChild` leaves a detached node's `parentNode` standing, so the walk
 * reads each parent's children, never `parentNode` alone.
 */
function standsAttached(el: RidNode, roots: readonly RidNode[]): boolean {
  const visited = new Set<RidNode>();
  let current = el;
  while (!visited.has(current)) {
    if (roots.includes(current)) return true;
    visited.add(current);
    const parent = current.parentNode;
    if (!parent || !parent.children?.includes(current)) return false;
    current = parent;
  }
  return false;
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

type Listener = NonNullable<RidNode["_larListeners"]>[number]["handler"];

const binds = (node: RidNode | null | undefined, type: string): boolean =>
  (node?._larListeners ?? []).some((l) => l.type === type);

/** The scope an act addresses: the camera that bound its render id, else the one camera of that id under its epoch. */
function scopeFor(ev: LarMsg_ControlEvent): CameraScope | undefined {
  const bound = ev.renderId !== undefined ? eventScopes.get(ev.renderId) : undefined;
  if (bound) return bound;
  const named = [...cameras].filter((c) => c.cameraId === ev.cameraId);
  return named.find((c) => c.mountEpoch === ev.mountEpoch) ?? (named.length === 1 ? named[0] : undefined);
}

/** The live node an act names, or undefined: a render id the camera bound, the last frame painted, and the tree still holds. */
function resolveTarget(ev: LarMsg_ControlEvent, scope: CameraScope): RidNode | undefined {
  const renderId = ev.renderId ?? (ev.controlId !== undefined ? scope.controlIds.get(ev.controlId) : undefined);
  if (renderId === undefined) return undefined;
  const el = ridMap.get(renderId);
  if (!el || eventScopes.get(renderId) !== scope || !scope.liveIds.has(renderId) || !standsAttached(el, scope.roots)) return undefined;
  return el;
}

/** The event TW5's handler reads: the target, the modifiers and the key chord as of the act, and a view that refuses. */
function projectedEvent(type: string, el: RidNode, scope: CameraScope, ev: LarMsg_ControlEvent): Record<string, unknown> & { readonly stopped: () => boolean } {
  let stopped = false;
  const m = ev.modifiers;
  return {
    type, target: el, currentTarget: el,
    button: m?.button ?? 0, ctrlKey: m?.ctrl ?? false, metaKey: m?.meta ?? false, altKey: m?.alt ?? false, shiftKey: m?.shift ?? false,
    ...(ev.key ? { key: ev.key.key, code: ev.key.code, keyCode: ev.key.keyCode, which: ev.key.keyCode, repeat: ev.key.repeat } : {}),
    // TW5 navigator.js reads event.event.view before save/cancel/rename. A worker event carries the
    // worker-local, explicitly refusing view capability; no global `window` or DOM crosses the seam.
    view: makeProjectedViewContract((_capability, message) => {
      scope.alert("$:/temp/lares/alert/confirm-refused", `This wiki cannot open a blocking prompt: ${message}`);
    }),
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { stopped = true; },
    stopped: () => stopped,
  };
}

function runListeners(scope: CameraScope, node: RidNode, type: string, event: Record<string, unknown>): void {
  event.currentTarget = node;
  for (const l of node._larListeners ?? []) if (l.type === type) invokeProjectedListener(scope, l.handler, event);
}

/** Land a whole value on the node TW5 reads it from; the caret rides to its end, since the page holds the real one. */
function writeValue(el: RidNode, value: string): void {
  el.value = value;
  el.selectionStart = el.selectionEnd = value.length;
}

/**
 * Dispatch one control event into TW5's NATIVE path and answer it.
 *
 * TW5 never learns the act crossed a thread: the value lands on the NODE before TW5's own handler reads it
 * there (`domNodes[0].value`), the geometry the page measured at the act answers that act's layout reads and
 * no other, and the key chord carries the real `key`, `code` and `keyCode`.
 *
 *   - An act under another `mountEpoch`, on a render id no live frame painted, or on a node a re-render detached
 *     answers `stale-target` and runs nothing (a sense in that place answers nothing and runs nothing).
 *   - A `lar:act` whose node binds no listener of its type answers `refused: unclaimed`, so the page leaves the
 *     browser's default alone.
 *   - `lar:click` runs the popup closer leg, then the node's own listeners (a click stays on its node).
 *   - `lar:key` bubbles up the fake tree until a listener stops it, since TW5's keyboard widget binds on a wrapper.
 *   - `lar:commit` writes the whole value (and `checked`) onto the node and runs its `change` listeners; an edit
 *     engine that saves on `input` alone runs that leg, so a commit always lands the settled value.
 *   - `lar:sense` writes the whole value, records its `localRev` (newest wins), runs the `input` listeners, and
 *     answers null: the droppable class answers only through a later frame's `sensedRevision`.
 *   - A repeated `eventId` within the epoch re-answers from the ring without re-applying.
 *
 * Every answer crosses the camera's `ctx.post` as `lar:control-result`. A listener that throws (a plugin
 * reaching for a blocking `confirm`, say) stops there, reads by name on the wiki's alert rail, and the act
 * still answers.
 */
export function dispatchLarControlEvent(ev: LarMsg_ControlEvent): LarMsg_ControlResult | null {
  const scope = scopeFor(ev);
  const target = ev.renderId ?? ev.controlId ?? ev.affordanceId ?? "";
  const answer = (status: LarResultStatus, reason?: LarRefusal): LarMsg_ControlResult => {
    const result = mkLarControlResult({
      eventId: ev.eventId, cameraId: ev.cameraId, mountEpoch: ev.mountEpoch,
      ...(ev.controlId !== undefined ? { controlId: ev.controlId } : {}),
      ...(ev.renderId !== undefined ? { renderId: ev.renderId } : {}),
      status, ...(reason !== undefined ? { reason } : {}),
    });
    if (scope && ev.mountEpoch === scope.mountEpoch) remember(scope, result);
    if (scope) scope.post(result);
    else console.warn(`[wiki-worker] no camera stands to answer ${ev.eventId} (${ev.cameraId})`);
    return result;
  };
  const sense = ev.kind === "lar:sense";
  const stale = (): LarMsg_ControlResult | null => {
    console.warn(`[wiki-worker] stale-target: ${target}`);
    return sense ? null : answer("stale-target");
  };
  if (!scope || ev.mountEpoch !== scope.mountEpoch) return stale();
  if (!sense) {
    const given = scope.answers.get(ev.eventId);
    if (given) { scope.post(given); return given; }
  }

  if (ev.kind === "lar:write" || ev.kind === "lar:service-result") return answer("refused", "binding-unavailable");
  const el = resolveTarget(ev, scope);
  if (!el) return stale();
  activeEventScope = scope;
  const key = ev.controlId ?? ev.renderId!;

  if (sense) {
    if (typeof ev.wholeValue !== "string" || ev.localRev === undefined) return null;
    if (!takeIn(scope, key, ev.localRev)) return null;
    writeValue(el, ev.wholeValue);
    runListeners(scope, el, "input", projectedEvent("input", el, scope, ev));
    scope.mark();
    return null;
  }

  switch (ev.action) {
    case "lar:click": {
      if (!binds(el, "click")) return answer("refused", "unclaimed");
      const g = ev.geometry;
      if (g) {
        // TW5 Popup reads the fake node's bounding box and offset dimensions while opening a popup; these whole
        // values were measured on the page for this act, and they leave with it.
        el._larRect = { ...g, x: g.left, y: g.top };
        el.offsetLeft = g.left; el.offsetTop = g.top; el.offsetWidth = g.width; el.offsetHeight = g.height;
      }
      try {
        const event = projectedEvent("click", el, scope, ev);
        // TW5 binds its popup closer on the document capture leg; run that before the target's widget
        // handler so a click that opens a popup cannot immediately close the popup it just opened.
        runListeners(scope, scope.popupRoot, "click", event);
        event.currentTarget = el;
        runListeners(scope, el, "click", event);
      } finally {
        if (g) { delete el._larRect; delete el.offsetLeft; delete el.offsetTop; delete el.offsetWidth; delete el.offsetHeight; }
      }
      return answer("applied");
    }
    case "lar:key": {
      let claimed = false;
      for (let node: RidNode | null | undefined = el; node && !claimed; node = node.parentNode) claimed = binds(node, "keydown");
      if (!claimed) return answer("refused", "unclaimed");
      const event = projectedEvent("keydown", el, scope, ev);
      for (let node: RidNode | null | undefined = el; node && !event.stopped(); node = node.parentNode) {
        runListeners(scope, node, "keydown", event);
      }
      return answer("applied");
    }
    case "lar:commit": {
      const leg = binds(el, "change") ? "change" : binds(el, "input") ? "input" : undefined;
      if (!leg) return answer("refused", "unclaimed");
      if (typeof ev.wholeValue === "string") writeValue(el, ev.wholeValue);
      if (ev.checked !== undefined) el.checked = ev.checked;
      if (ev.localRev !== undefined) takeIn(scope, key, ev.localRev);
      runListeners(scope, el, leg, projectedEvent(leg, el, scope, ev));
      // The commit took the page's value in: the next frame says so, whether or not the store moved.
      scope.mark();
      return answer("applied");
    }
    default:
      return answer("refused", "unsupported-control");
  }
}

/** Ask every camera of `msg.cameraId` (on `wikiUri`, where named) to paint itself whole under a fresh epoch. */
export function resendLarCamera(msg: LarMsg_Resend, wikiUri?: string): boolean {
  let asked = false;
  for (const camera of cameras) {
    if (camera.cameraId !== msg.cameraId || (wikiUri !== undefined && camera.wikiUri !== wikiUri)) continue;
    camera.resend();
    asked = true;
  }
  return asked;
}

/** Take in a page revision for a control: newest wins by the page's own number, never by arrival. */
function takeIn(scope: CameraScope, control: string, localRev: number): boolean {
  if ((scope.sensed.get(control) ?? -1) >= localRev) return false;
  scope.sensed.set(control, localRev);
  return true;
}

/** Keep an answer for a repeated eventId; the oldest leaves once the ring fills. */
function remember(scope: CameraScope, result: LarMsg_ControlResult): void {
  scope.answers.set(result.eventId, result);
  if (scope.answers.size > ANSWER_RING) scope.answers.delete(scope.answers.keys().next().value!);
}

function invokeFakeListener(handler: Listener, event: unknown): void {
  if (typeof handler === "function") handler(event);
  else handler.handleEvent(event);
}

function invokeProjectedListener(scope: CameraScope, handler: Listener, event: unknown): void {
  try {
    invokeFakeListener(handler, event);
  } catch (error) {
    const refusal = error instanceof Error ? error : new Error(String(error));
    const name = refusal.name || "Error";
    console.warn(`[wiki-worker] handler refused: ${name}: ${refusal.message}`);
    scope.alert("$:/temp/lares/alert/handler-refused", `An action stopped: ${name}: ${refusal.message}`);
  }
}

/**
 * Mount the story camera on a live wiki island. Returns a teardown (the `onBoot` contract).
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
  // remains a complete snapshot.
  const popupRoot = fakeDoc.createElement("div");
  const storyContainer = fakeDoc.createElement("div");
  /** Every key's revision rises across the mount's whole life, epochs included. */
  let surfaceRev = 0, styleRev = 0;
  const membershipRev = 1;
  /** The stylesheet text the mount's last frame carried, and whether the next frame carries every key whole. */
  let lastCss: string | undefined;
  let whole = true;
  const scope: CameraScope = {
    wikiUri: ctx.wikiUri, cameraId: LAR_CAMERA_STORY, popupRoot, roots: [storyContainer, popupRoot],
    renderIds: new Set(), liveIds: new Set(), controlIds: new Map(),
    mountEpoch: mintEpoch(), sensed: new Map(), answers: new Map(),
    post: (msg) => postLar(ctx, msg),
    mark: () => gate.mark(),
    // A new epoch: every act the page made under the old one now answers stale-target, the old answers leave
    // with it, and the next frame carries every key whole. The sensed revisions stay: the page still holds them.
    resend: () => { scope.mountEpoch = mintEpoch(); scope.answers.clear(); whole = true; gate.mark(); },
    alert: (title, text) => tw.wiki.addTiddler(new tw.Tiddler({ title, text, tags: ["$:/tags/Alert"], component: "projection", modified: new Date() })),
  };
  activeEventScope = scope;
  cameras.add(scope);
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
    onFlush: () => {
      const html = tw5ElementToHtml(storyContainer);
      scope.liveIds = new Set();
      scope.controlIds = new Map();
      for (const [tag] of html.matchAll(/<[a-zA-Z][^>]*\bdata-lar-rid="[^"]+"[^>]*>/g)) {
        const rid = /\bdata-lar-rid="([^"]+)"/.exec(tag)![1]!;
        scope.liveIds.add(rid);
        const control = /\bdata-control-id="([^"]+)"/.exec(tag)?.[1];
        if (control !== undefined) scope.controlIds.set(control, rid);
      }
      // A node the frame no longer paints never receives an event again: the page relays by the ids the
      // frame carries, and a detached node answers `stale-target` whatever it holds. Its map entries leave
      // with the frame, so the maps hold the painted nodes and the roots, never every node ever bound.
      for (const renderId of scope.renderIds) {
        if (scope.liveIds.has(renderId)) continue;
        const node = ridMap.get(renderId);
        if (node && scope.roots.includes(node)) continue;
        if (eventScopes.get(renderId) !== scope) { scope.renderIds.delete(renderId); continue; }
        ridMap.delete(renderId);
        eventScopes.delete(renderId);
        scope.renderIds.delete(renderId);
      }
      const css = styleContainer.textContent ?? "";
      const keys: LarFrameKey[] = [{ key: LAR_KEY_SURFACE, rev: ++surfaceRev, html }];
      if (whole || css !== lastCss) keys.push({ key: LAR_KEY_STYLE, rev: ++styleRev, css });
      keys.push({ key: LAR_KEY_MEMBERSHIP, rev: membershipRev, members: STORY_MEMBERS });
      lastCss = css;
      whole = false;
      scope.post(mkLarFrame({
        wikiUri: ctx.wikiUri, cameraId: scope.cameraId, mountEpoch: scope.mountEpoch, keys,
        sensedRevision: Object.fromEntries(scope.sensed),
      }));
    },
  });

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
    cameras.delete(scope);
    for (const renderId of scope.renderIds) {
      if (eventScopes.get(renderId) !== scope) continue;
      ridMap.delete(renderId);
      eventScopes.delete(renderId);
    }
    scope.liveIds.clear();
    scope.popupRoot._larListeners = [];
    if (tw.popup === popupManager) tw.popup = undefined;
    if (activeEventScope === scope) activeEventScope = undefined;
  };
}
