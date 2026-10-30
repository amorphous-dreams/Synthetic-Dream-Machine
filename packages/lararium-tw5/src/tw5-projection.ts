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
 * The root layer and the host doors (dreamdom#/host-services). The house plugin's `lar-root-services` startup
 * answers the root `tm-*` messages a worker otherwise lacks; this camera paints its records through the root
 * layer template (modals, notifications, the scroll and focus hints), appended to the `lar:surface` key while
 * it holds anything, and installs `$tw.lares.serviceDoor`, the one road a host door takes: an ask the surface's
 * manifest lacks refuses at once (`page-action-unavailable`, and the act that raised it answers so), any other
 * posts `lar:service` on `ctx.post` and settles when its `lar:service-result` lands, correlated by `requestId`.
 *
 * Isomorphic: uses only `$tw.fakeDocument` (no window.document) — safe in @lararium/tw5.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/tw5-projection
 */

import type { IslandContext } from "./island-context.js";
import { mountCamera, TW5_ROOT_TEMPLATE, TW5_PAGE_STYLESHEET } from "./tw5-camera.js";
import { optionKey, selectOptions, tw5ElementToHtml } from "./fake-dom.js";
import { makeProjectedViewContract } from "./tw5-host-bridge.js";
import { installLarFieldEngine, larFieldEngineOf } from "./lar-field-engine.js";
import type { RestDoor } from "./rest-door.js";
import {
  CoalesceGate, LAR_CAMERA_STORY, LAR_KEY_MEMBERSHIP, LAR_KEY_STYLE, LAR_KEY_SURFACE, LAR_SERVICE_KINDS,
  LAR_SURFACE_DEFAULT_SERVICES, LAR_WHOLE_BYTES_MAX, mkLarControlResult, mkLarFrame, mkLarService,
  LAR_CONTROL_DOCUMENT, LAR_KEY_SHORTCUTS, LAR_KEY_STORY_ORDER, type LarShortcutChord, type LarStoryOrder,
  type IslandToVesselMsg, type LarFrameKey, type LarMsg_ControlEvent, type LarMsg_ControlResult, type LarMsg_Frame,
  type LarMsg_Resend, type LarMsg_Service, type LarRefusal, type LarResultStatus, type LarServiceKind, type LarSurfaceManifest,
  LAR_STAMP_BUBBLE, LAR_STAMP_CANCEL, LAR_STAMP_KEYS, LAR_STAMP_LIVE, LAR_STAMP_ON, larKeyChordName,
  larLogicalKeyCode, larReservedChord,
} from "@lararium/mesh";
import type { LaresServiceArgs, LaresServiceDoor } from "./types/lares-globals.js";

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
const STORY_MEMBERS: readonly string[] = [LAR_KEY_SURFACE, LAR_KEY_STYLE, LAR_KEY_SHORTCUTS, LAR_KEY_STORY_ORDER];

/** How many answers a camera keeps for re-answering a repeated `eventId` within one epoch. */
const ANSWER_RING = 256;

/** The root layer the `lar-root-services` startup paints through: modals, notifications, hints. */
export const TW5_ROOT_LAYER = "lar:///ha.ka.ba/lararium/templates/root-layer";
/** How many host-door asks stand unanswered at once; the oldest settles `superseded` past the line. */
const SERVICE_LEDGER = 256;

/** A patched fake-DOM element: TW5's fakedom drops `addEventListener` (a no-op), severing only the
 *  DOM-node→widget binding. We patch it to STORE the handler TW5 builds + stamp a `data-lar-rid`
 *  (which rides the serialized HTML), so a returned act maps back to the live node. */
interface RidNode {
  tag?: string;
  attributes: Record<string, string | undefined>;
  setAttribute(name: string, value: string): void;
  _larListeners?: { type: string; handler: ((ev: unknown) => void) | { handleEvent(ev: unknown): void } }[];
  parentNode?: RidNode | null;
  children?: RidNode[];
  /** The field's live text. TW5's edit widgets read `domNodes[0].value`, so the sense and commit legs write it here. */
  value?: string;
  /** A toggle's state as of the act. TW5's checkbox and radio read `.checked` off their node. */
  checked?: boolean;
  /** An option's state as of the act. TW5's multiple select reads `option.selected` off each option. */
  selected?: boolean;
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
  readonly wiki: any;
  readonly rest?: RestDoor;
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
  /** The host doors the surface's manifest names (at surface-open); the default set until one arrives. */
  services: ReadonlySet<string>;
  post(msg: LarMsg_Frame | LarMsg_ControlResult | LarMsg_Service): void;
  mark(): void;
  resend(manifest?: LarSurfaceManifest): void;
  alert(title: string, text: string): void;
  /** The doors the page controls reach: the root widget a text operation's message reaches, and the popup closer. */
  controls?: { readonly rootWidget: Record<string, any>; dismiss(): void };
}
const eventScopes = new Map<string, CameraScope>();
const cameras = new Set<CameraScope>();
let activeEventScope: CameraScope | undefined;
let ridSeq = 0;
/** The size of the render-id and event-scope maps, for a witness that reads them across frames. */
export function renderIdCensus(): { nodes: number; scopes: number } {
  return { nodes: ridMap.size, scopes: eventScopes.size };
}

/** One boot owns a random 32-bit prefix and at most 2^20 epochs. */
export function createEpochMint(): () => number {
  const nonce = crypto.getRandomValues(new Uint32Array(1))[0]!;
  let counter = 0;
  return () => {
    if (counter >= 0xfffff) throw new RangeError("mount-epoch-exhausted");
    return nonce * 0x100000 + ++counter;
  };
}
const mintEpoch = createEpochMint();

/** The island protocol's union names the two `lar:` messages once the wire integration lands; until then this
 *  one cast stands as the seam, and nowhere else. */
function postLar(ctx: IslandContext, msg: LarMsg_Frame | LarMsg_ControlResult | LarMsg_Service): void {
  ctx.post(msg as unknown as IslandToVesselMsg);
}

/** `data-lar-on`: the types the node binds, in the order TW5 bound them; the page relays only these. */
function stampBoundTypes(node: RidNode): void {
  const types = [...new Set((node._larListeners ?? []).map((l) => l.type))];
  if ((node.attributes["class"] ?? "").split(/\s+/).includes("tc-eventcatcher")) {
    const allowed = types.filter((type) => CATCHER_EVENTS.has(type));
    if (allowed.length) node.setAttribute(LAR_STAMP_ON, allowed.join(" "));
    else delete node.attributes[LAR_STAMP_ON];
    return;
  }
  if (types.length) node.setAttribute(LAR_STAMP_ON, types.join(" "));
  else delete node.attributes[LAR_STAMP_ON];
}

/** A bounded selector reader for the fake DOM; unknown CSS syntax matches nothing. */
function fakeMatches(node: RidNode, selector: string): boolean {
  return selector.split(",").some((part) => {
    const atoms = part.trim().split(/\s+/);
    if (!atoms.length || atoms.some((atom) => !/^(?:[a-z][\w-]*)?(?:[#.][\w-]+|\[[\w-]+(?:=["']?[^\]"']+["']?)?\])*$/.test(atom))) return false;
    const matchesAtom = (n: RidNode, atom: string): boolean => {
      const tag = /^[a-z][\w-]*/.exec(atom)?.[0];
      if (tag && n.tag?.toLowerCase() !== tag.toLowerCase()) return false;
      for (const id of atom.matchAll(/#([\w-]+)/g)) if (n.attributes["id"] !== id[1]) return false;
      for (const cls of atom.matchAll(/\.([\w-]+)/g)) if (!(n.attributes["class"] ?? "").split(/\s+/).includes(cls[1]!)) return false;
      for (const attr of atom.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)) {
        if (n.attributes[attr[1]!] === undefined || attr[2] !== undefined && n.attributes[attr[1]!] !== attr[2]) return false;
      }
      return atom !== "";
    };
    let cursor: RidNode | null | undefined = node;
    if (!matchesAtom(cursor, atoms.at(-1)!)) return false;
    for (let i = atoms.length - 2; i >= 0; i--) {
      cursor = cursor?.parentNode;
      while (cursor && !matchesAtom(cursor, atoms[i]!)) cursor = cursor.parentNode;
      if (!cursor) return false;
    }
    return true;
  });
}

const FAKE_DOM_ANIMATION_PATCHED = Symbol("lararium.fake-dom-animation-patched");

/** Patch the fake-element prototype once per worker (the RETURN-leg capability the fakedom platform
 *  lacks): restore listener-storage + render-id stamping + the two reads TW5's click handler makes
 *  on the now-live node (getBoundingClientRect, hasAttribute). role = capability ≠ platform. */
export function patchFakeElementForEvents(fakeDoc: { createElement(t: string): RidNode }): void {
  const proto = Object.getPrototypeOf(fakeDoc.createElement("div")) as Record<string, unknown>;
  if (proto["_larEventsPatched"]) return;
  proto["_larEventsPatched"] = true;
  Object.defineProperty(proto, "nodeName", { get(this: RidNode) { return this.tag?.toUpperCase() ?? ""; } });
  proto["matches"] = function (this: RidNode, selector: string): boolean { return fakeMatches(this, selector); };
  proto["closest"] = function (this: RidNode, selector: string): RidNode | null {
    for (let node: RidNode | null | undefined = this; node; node = node.parentNode) if (fakeMatches(node, selector)) return node;
    return null;
  };
  proto["contains"] = function (this: RidNode, other: RidNode): boolean {
    for (let node: RidNode | null | undefined = other; node; node = node.parentNode) if (node === this) return true;
    return false;
  };
  proto["addEventListener"] = function (this: RidNode, type: string, handler: ((ev: unknown) => void) | { handleEvent(ev: unknown): void }): void {
    let rid = this.attributes["data-lar-rid"];
    if (rid === undefined) {
      rid = String(++ridSeq);
      this.setAttribute("data-lar-rid", rid);
    }
    (this._larListeners ??= []).push({ type, handler });
    stampBoundTypes(this);
    ridMap.set(rid, this);
    if (activeEventScope) {
      eventScopes.set(rid, activeEventScope);
      activeEventScope.renderIds.add(rid);
    }
  };
  proto["removeEventListener"] = function (this: RidNode, type: string, handler: unknown): void {
    if (!this._larListeners) return;
    this._larListeners = this._larListeners.filter((listener) => listener.type !== type || listener.handler !== handler);
    stampBoundTypes(this);
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
  // The two reads TW5's multiple select makes while it gathers a person's choice (`select.options`,
  // `option.text`): the fake element answers them from its own children, as a browser's would.
  Object.defineProperty(proto, "options", {
    configurable: true,
    get(this: RidNode) { return this.tag === "select" ? selectOptions(this) : undefined; },
  });
  Object.defineProperty(proto, "text", {
    configurable: true,
    get(this: RidNode & { textContent?: string }) { return this.textContent ?? ""; },
  });
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

// ── Declared at binding: the per-widget stamp table ─────────────────────────────────────────────

/** What one widget declares about the node it bound: the page reads these synchronously, the engine never decides them at handling. */
interface Declaration {
  readonly node: RidNode | undefined;
  readonly cancel?: string;
  readonly keys?: string;
  readonly bubble?: "yes" | "no";
  readonly live?: "value" | "checked" | "selected";
  readonly on?: string;
  readonly selector?: string;
  readonly matchSelector?: string;
  readonly refused?: string;
}
/** The loose widget surface the table reads: TW5's own fields, never a copy of them. */
type DeclaringWidget = Record<string, any> & { domNodes: RidNode[]; children: DeclaringWidget[] };

/** Whether a `$button` click invokes child action widgets, the way TW5's `invokeActions` walks them. */
function invokesChildActions(widget: DeclaringWidget): boolean {
  return (widget.children ?? []).some((child) =>
    !!child.invokeAction || (child.allowActionPropagation?.() !== false && invokesChildActions(child)));
}

const KEY_INFO_CHORD = (info: { keyCode: number; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean }): string =>
  larKeyChordName({ keyCode: info.keyCode, ctrl: !!info.ctrlKey, alt: !!info.altKey, shift: !!info.shiftKey, meta: !!info.metaKey });

/**
 * The chords an editor intercepts for itself: TW5's editor runs a toolbar button whose `data-tw-keyboard-shortcut`
 * descriptors match a keydown (`editor/factory.js` handleKeydownEvent), so those chords are the editor's own declared
 * keys. An editor without a toolbar (TW5 renders none over the fake document) declares none: its keydown propagates
 * to a container `$keyboard`, whose own keys stamp there.
 */
export interface ToolbarNode { readonly attributes?: Readonly<Record<string, string | undefined>>; readonly children?: readonly ToolbarNode[] }
export function editorDeclaredKeys(
  toolbar: ToolbarNode | undefined,
  parse: (descriptor: string) => readonly Parameters<typeof KEY_INFO_CHORD>[0][],
): string {
  const chords = new Set<string>();
  const walk = (node: ToolbarNode | undefined): void => {
    if (!node?.attributes) return;
    const descriptor = node.attributes["data-tw-keyboard-shortcut"];
    if (descriptor) for (const info of parse(descriptor)) if (info) chords.add(KEY_INFO_CHORD(info));
    for (const child of node.children ?? []) walk(child);
  };
  walk(toolbar);
  return [...chords].join(" ");
}

const CATCHER_EVENTS = new Set(["click", "dblclick", "contextmenu", "focusin", "focusout", "drop"]);

function stampCatchTree(node: RidNode | undefined): void {
  if (!node) return;
  if (node.attributes && node.attributes["data-lar-rid"] === undefined && activeEventScope) {
    const rid = String(++ridSeq);
    node.setAttribute("data-lar-rid", rid);
    ridMap.set(rid, node);
    eventScopes.set(rid, activeEventScope);
    activeEventScope.renderIds.add(rid);
  }
  for (const child of node.children ?? []) if (child.attributes) stampCatchTree(child);
}

/**
 * The small table: per widget class, the node it binds and what that node declares.
 *
 *   - `$link`: an ordinary click on an `href` cancels; TW5's handler always ends the climb.
 *   - `$button`: a click that runs actions, navigates, sends, pops up or sets cancels and ends the climb.
 *   - `$keyboard`: only the declared chords cancel; an undeclared key climbs on.
 *   - `$dropzone`, `$droppable`: dragenter, dragover and drop cancel, so the browser lets the drop land.
 *   - `$edit-text`, `$checkbox`, `$radio`, `$select`, `$range`: the page owns the live property.
 */
const DECLARATIONS: Readonly<Record<string, (w: DeclaringWidget) => Declaration>> = {
  link: (w) => {
    const node = w.domNodes[0];
    return { node, bubble: "no", ...(node?.attributes["href"] !== undefined ? { cancel: "click:ordinary" } : {}) };
  },
  button: (w) => {
    const handles = !!(w.to || w.message || w.popup || w.popupTitle || w.set || w.setTitle) || invokesChildActions(w);
    return { node: w.domNodes[0], bubble: handles ? "no" : "yes", ...(handles || w.actions ? { cancel: "click" } : {}) };
  },
  keyboard: (w) => ({
    node: w.domNodes[0], bubble: "yes", cancel: "keydown:declared",
    keys: [...new Set(((w.keyInfoArray ?? []) as Parameters<typeof KEY_INFO_CHORD>[0][]).map(KEY_INFO_CHORD))].join(" "),
  }),
  eventcatcher: (w) => {
    const node = w.domNode as RidNode | undefined;
    const types = (w.types ?? []) as string[];
    const allowed = types.filter((type) => CATCHER_EVENTS.has(type) && w.getAttribute("disabled", "no") !== "yes" && w.getAttribute("pointerCapture", "no") === "no");
    stampCatchTree(node);
    const stop = w.getAttribute("stopPropagation", "onaction");
    const selector = w.getAttribute("selector") as string | undefined;
    const matchSelector = w.getAttribute("matchSelector") as string | undefined;
    const refused = w.getAttribute("pointerCapture", "no") !== "no" ? "pointer-capture-refused"
      : types.some((type) => !CATCHER_EVENTS.has(type)) ? "continuous-event-refused" : undefined;
    return { node, on: [...new Set(allowed)].join(" "), bubble: "yes",
      cancel: allowed.filter((type) => stop === "always" || stop === "onaction" && !!w.getAttribute(`$${type}`)).join(" "),
      ...(selector ? { selector } : {}), ...(matchSelector ? { matchSelector } : {}), ...(refused ? { refused } : {}) };
  },
  dropzone: (w) => ({ node: w.domNodes[0], bubble: "no", cancel: "dragenter dragover drop" }),
  droppable: (w) => ({ node: w.domNodes[0], bubble: "no", cancel: "dragenter dragover drop" }),
  "edit-text": (w) => ({ node: w.engine?.domNode ?? w.domNodes[0], live: "value" }),
  checkbox: (w) => ({ node: w.inputDomNode ?? w.domNodes[0], live: "checked" }),
  radio: (w) => ({ node: w.inputDomNode ?? w.domNodes[0], live: "checked" }),
  select: (w) => ({ node: w.domNodes[0], live: "selected" }),
  range: (w) => ({ node: w.inputDomNode ?? w.domNodes[0], live: "value" }),
  browse: (w) => ({ node: w.domNodes[0], on: "change", bubble: "yes" }),
};

function stamp(node: RidNode, name: string, value: string | undefined): void {
  if (value === undefined || value === "") delete node.attributes[name];
  else node.setAttribute(name, value);
}

function declare(widget: DeclaringWidget, read: (w: DeclaringWidget) => Declaration): void {
  const d = read(widget);
  if (!d.node?.attributes) return;
  stamp(d.node, LAR_STAMP_CANCEL, d.cancel);
  stamp(d.node, LAR_STAMP_KEYS, d.keys);
  stamp(d.node, LAR_STAMP_BUBBLE, d.bubble);
  stamp(d.node, LAR_STAMP_LIVE, d.live);
  if (d.on !== undefined) stamp(d.node, LAR_STAMP_ON, d.on);
  stamp(d.node, "data-lar-catcher-selector", d.selector);
  stamp(d.node, "data-lar-catcher-match-selector", d.matchSelector);
  stamp(d.node, "data-lar-catcher-refused", d.refused);
}

const WIDGET_DECLARATIONS_PATCHED = Symbol("lararium.widget-declarations-patched");

/** Wrap each table widget's `render` and `refresh` once per class, so every binding it makes carries its declaration. */
export function patchWidgetDeclarations(tw: Record<string, any>): void {
  const collect = tw.utils.collectDOMVariables;
  if (collect && !tw.utils._larCollectDOMVariablesPatched) {
    tw.utils._larCollectDOMVariablesPatched = true;
    tw.utils.collectDOMVariables = function (selected: RidNode | undefined, catcher: RidNode | undefined, event: unknown): unknown {
      if (!selected?.attributes || Array.isArray(selected.attributes)) return collect(selected, catcher, event);
      const attrs = selected.attributes;
      // TW5's DOM collector iterates Attr objects; the fake DOM stores string values in a map.
      (selected as unknown as { attributes: unknown }).attributes = Object.entries(attrs).filter(([, value]) => value !== undefined).map(([name, value]) => ({ name, value }));
      try { return collect(selected, catcher, event); }
      finally { selected.attributes = attrs; }
    };
  }
  const classes = tw.rootWidget?.widgetClasses as Record<string, { prototype: Record<string | symbol, any> }> | undefined;
  if (!classes) throw new Error("TW5 projection cannot declare its bindings: $tw.rootWidget.widgetClasses is unavailable");
  const declarations = {
    ...DECLARATIONS,
    "edit-text": (w: DeclaringWidget): Declaration => {
      const keys = editorDeclaredKeys(w.toolbarNode as ToolbarNode | undefined,
        (descriptor) => (tw.keyboardManager?.parseKeyDescriptors(descriptor, { wiki: w.wiki }) ?? []) as Parameters<typeof KEY_INFO_CHORD>[0][]);
      return { node: w.engine?.domNode ?? w.domNodes[0], live: "value", ...(keys ? { keys } : {}) };
    },
  };
  for (const [name, read] of Object.entries(declarations)) {
    const proto = classes[name]?.prototype;
    if (!proto || proto[WIDGET_DECLARATIONS_PATCHED]) continue;
    proto[WIDGET_DECLARATIONS_PATCHED] = true;
    const render = proto["render"] as (...args: unknown[]) => unknown;
    const refresh = proto["refresh"] as (...args: unknown[]) => unknown;
    proto["render"] = function (this: DeclaringWidget, ...args: unknown[]): unknown {
      const out = render.apply(this, args);
      declare(this, read);
      return out;
    };
    proto["refresh"] = function (this: DeclaringWidget, ...args: unknown[]): unknown {
      const out = refresh.apply(this, args);
      declare(this, read);
      return out;
    };
  }
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
    ...(ev.key ? { key: ev.key.key, code: ev.key.code, keyCode: larLogicalKeyCode(ev.key.key, ev.key.keyCode), which: larLogicalKeyCode(ev.key.key, ev.key.keyCode), repeat: ev.key.repeat } : {}),
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

/** Whether any node from `el` up the fake tree binds `type`: the first listener up the climb claims the act. */
function claims(el: RidNode, type: string): boolean {
  for (let node: RidNode | null | undefined = el; node; node = node.parentNode) if (binds(node, type)) return true;
  return false;
}

/** Bubble one event from its target up the fake tree, the way the page's DOM would: each binding node runs its
 *  listeners, and a `stopPropagation` from TW5's own handler ends the climb. */
function bubble(scope: CameraScope, el: RidNode, type: string, event: ReturnType<typeof projectedEvent>): void {
  for (let node: RidNode | null | undefined = el; node && !event.stopped(); node = node.parentNode) {
    if (binds(node, type)) runListeners(scope, node, type, event);
  }
}

/** Land a whole value on the node TW5 reads it from; the caret rides to its end, since the page holds the real one. */
function writeValue(el: RidNode, value: string): void {
  el.value = value;
  el.selectionStart = el.selectionEnd = value.length;
}

/** The toggle family's nodes: a checkbox or radio input, and a select. */
const isToggle = (el: RidNode): boolean =>
  el.tag === "input" && (el.attributes["type"] === "checkbox" || el.attributes["type"] === "radio");
const isChoice = (el: RidNode): boolean => el.tag === "select";
const isKeySet = (v: unknown): v is readonly string[] => Array.isArray(v) && v.every((k) => typeof k === "string");

/**
 * Land a person's whole key set on a select, the way a browser holds it: a single select's value names the one
 * key (TW5 reads `select.value`), a multiple select's options each carry `selected` (TW5 reads `option.selected`).
 */
function writeChoice(el: RidNode, keys: readonly string[]): void {
  if (el.attributes["multiple"] === undefined) {
    el.value = keys[0] ?? "";
    return;
  }
  for (const option of selectOptions(el) as RidNode[]) option.selected = keys.includes(optionKey(option));
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
 *   - EVERY TYPE BUBBLES. An act climbs from its node up the fake tree to the first listener of its type, and on
 *     through each binding ancestor until TW5's own handler calls `stopPropagation`. A `lar:act` that no node up
 *     the climb claims answers `refused: unclaimed` and runs nothing, so the page leaves the browser's default alone.
 *   - `lar:click` runs the popup closer leg, then bubbles `click`.
 *   - `lar:key` bubbles `keydown`, since TW5's keyboard widget binds on a wrapper.
 *   - `lar:toggle` lands `checked` on a checkbox or radio and runs its `change` listeners; `lar:choice` lands the
 *     whole key set on a select and runs its `change` listeners. The state lands BEFORE TW5's own handler runs,
 *     so the handler reads what the person chose, and the act's `localRev` rides into `sensedRevision`.
 *   - `lar:commit` writes the whole value (and `checked`) onto the node and bubbles `change`; an edit engine that
 *     saves on `input` alone bubbles that leg, so a commit always lands the settled value.
 *   - `lar:sense` writes the whole value (a string on a field, a key set on a select), records its `localRev` (newest wins), bubbles `input`, and answers null:
 *     the droppable class answers only through a later frame's `sensedRevision`.
 *   - A repeated `eventId` within the epoch re-answers from the ring without re-applying.
 *
 * Every answer crosses the camera's `ctx.post` as `lar:control-result`. A listener that throws (a plugin
 * reaching for a blocking `confirm`, say) stops there, reads by name on the wiki's alert rail, and the act
 * still answers.
 */
export function dispatchLarControlEvent(ev: LarMsg_ControlEvent): LarMsg_ControlResult | null {
  const wiki = scopeFor(ev)?.wiki;
  if (!wiki) return dispatchLarControlEventInner(ev);
  const original = wiki.addTiddler;
  const stamps: Map<string, unknown> = wiki.__larSurfaceWrites ??= new Map();
  wiki.addTiddler = function(tiddler: any) {
    const result = original.call(this, tiddler);
    const title = tiddler?.fields?.title ?? tiddler?.title;
    if (typeof title === "string") stamps.set(title, wiki.getTiddler(title));
    return result;
  };
  try { return dispatchLarControlEventInner(ev); } finally { wiki.addTiddler = original; }
}

function dispatchLarControlEventInner(ev: LarMsg_ControlEvent): LarMsg_ControlResult | null {
  const scope = scopeFor(ev);
  const target = ev.renderId ?? ev.controlId ?? ev.affordanceId ?? "";
  const answer: Answer = (status, reason, want) => {
    dispatching = undefined;
    const result = mkLarControlResult({
      eventId: ev.eventId, cameraId: ev.cameraId, mountEpoch: ev.mountEpoch,
      ...(ev.controlId !== undefined ? { controlId: ev.controlId } : {}),
      ...(ev.renderId !== undefined ? { renderId: ev.renderId } : {}),
      status, ...(reason !== undefined ? { reason } : {}), ...(want !== undefined ? { want } : {}),
    });
    if (scope && ev.mountEpoch === scope.mountEpoch) remember(scope, result);
    // A confirmed act answers once its writes rest: the result waits on the rest door, so a page that reads
    // `applied` holds an edit the vessel's store keeps.
    const resting = scope && !sense && status === "applied" ? scope.rest?.held() ?? null : null;
    if (scope && resting) void resting.then(() => scope.post(result));
    else if (scope) scope.post(result);
    else console.warn(`[wiki-worker] no camera stands to answer ${ev.eventId} (${ev.cameraId})`);
    return result;
  };
  const sense = ev.kind === "lar:sense";
  const stale = (): LarMsg_ControlResult | null => {
    console.warn(`[wiki-worker] stale-target: ${target}`);
    return sense ? null : answer("stale-target");
  };
  // A host door's answer closes its request whatever epoch the page shows: the ledger keys by request, not mount.
  if (ev.kind === "lar:service-result") {
    const given = scope?.answers.get(ev.eventId);
    if (given) { scope!.post(given); return given; }
    return settleService(ev, scope, answer);
  }
  if (!scope || ev.mountEpoch !== scope.mountEpoch) return stale();
  if (!sense) {
    const given = scope.answers.get(ev.eventId);
    if (given) { scope.post(given); return given; }
  }

  if (ev.kind === "lar:write") return answer("refused", "binding-unavailable");
  const offered = dispatchOffer(ev, scope, answer);   // S6: files, drops, order, keys and navigate
  if (offered !== undefined) return offered;
  const el = resolveTarget(ev, scope);
  if (!el) return stale();
  activeEventScope = scope;
  const key = ev.controlId ?? ev.renderId!;

  if (sense) {
    const choice = isChoice(el) && isKeySet(ev.wholeValue);
    if ((!choice && typeof ev.wholeValue !== "string") || ev.localRev === undefined) return null;
    if (!takeIn(scope, key, ev.localRev)) return null;
    if (choice) writeChoice(el, ev.wholeValue as readonly string[]);
    else writeValue(el, ev.wholeValue as string);
    bubble(scope, el, "input", projectedEvent("input", el, scope, ev));
    scope.mark();
    return null;
  }

  // An act that raised a host door the manifest lacks answers with that door's refusal, never `applied`; the
  // answer ends the dispatch's hold on the door.
  const acting = { scope, refusal: undefined as LarRefusal | undefined };
  const applied = (want?: LarMsg_ControlResult["want"]): LarMsg_ControlResult => acting.refusal ? answer("refused", acting.refusal) : answer("applied", undefined, want);
  dispatching = acting;
  switch (ev.action) {
    case "lar:click": {
      if (!claims(el, "click")) return answer("refused", "unclaimed");
      // A binding that declares `click:ordinary` cancels only the ordinary click: a modified or middle click leaves
      // the browser's default standing (a new tab), so the island dispatches nothing for it and still answers.
      const held = ev.modifiers;
      if ((el as { getAttribute?(n: string): string | null }).getAttribute?.("data-lar-cancel") === "click:ordinary" && ((held?.button ?? 0) !== 0 || held?.ctrl || held?.meta)) return applied();
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
        bubble(scope, el, "click", event);
      } finally {
        if (g) { delete el._larRect; delete el.offsetLeft; delete el.offsetTop; delete el.offsetWidth; delete el.offsetHeight; }
      }
      return applied();
    }
    case "lar:key": {
      if (!claims(el, "keydown")) return answer("refused", "unclaimed");
      bubble(scope, el, "keydown", projectedEvent("keydown", el, scope, ev));
      return applied();
    }
    case "lar:commit": {
      const leg = claims(el, "change") ? "change" : claims(el, "input") ? "input" : undefined;
      if (!leg) return answer("refused", "unclaimed");
      if (typeof ev.wholeValue === "string") writeValue(el, ev.wholeValue);
      if (ev.checked !== undefined) el.checked = ev.checked;
      if (ev.localRev !== undefined) takeIn(scope, key, ev.localRev);
      bubble(scope, el, leg, projectedEvent(leg, el, scope, ev));
      // The commit took the page's value in: the next frame says so, whether or not the store moved.
      scope.mark();
      return applied();
    }
    case "lar:toggle":
    case "lar:choice": {
      const checked = ev.action === "lar:toggle" && typeof ev.checked === "boolean" ? ev.checked : undefined;
      const keys = ev.action === "lar:choice" && isKeySet(ev.wholeValue) ? ev.wholeValue : undefined;
      if (checked !== undefined ? !isToggle(el) : keys === undefined || !isChoice(el)) return answer("refused", "unsupported-control");
      if (!binds(el, "change")) return answer("refused", "unclaimed");
      // The person's state lands on the node first: TW5's checkbox, radio and select handlers read it there.
      if (checked !== undefined) el.checked = checked;
      else writeChoice(el, keys!);
      if (ev.localRev !== undefined) takeIn(scope, key, ev.localRev);
      runListeners(scope, el, "change", projectedEvent("change", el, scope, ev));
      scope.mark();
      return applied();
    }
    default:
      return dispatchPageControl(ev, el, key, scope, (status, reason, want) => status === "applied" ? applied(want) : answer(status, reason, want))
        ?? answer("refused", "unsupported-control");
  }
}

// ── The page controls: lar-field's text operation and take-theirs, lar-popover's dismissal ──────────
//
//   - `lar:edit-operation` on a node that sends `tm-edit-text-operation` carries the field's whole value and its
//     selection as of the act (and the field, where the page names it; else the one field the frame painted). An
//     act whose `localRev` falls below the field's sensed revision answers `stale-target`. The pair lands on the
//     field's seam engine, the node's own click listeners run, and the message reaches the field's editor
//     natively (a toolbar inside it) or through the root (a sibling button); TW5's own operation module and
//     `executeTextOperation` run over the pair, and the answer's `want` carries the whole value and selection the
//     engine wants. The page reserves the act's `localRev` + 1 for that answer, so the island takes it in.
//   - `lar:take-theirs` on a seam field: the page took the descriptor whole as one undoable edit; the node reads it.
//   - `lar:dismiss` closes the popups the camera's manager holds (the page closed its popover on Escape).

type Answer = (status: LarResultStatus, reason?: LarRefusal, want?: LarMsg_ControlResult["want"]) => LarMsg_ControlResult;

/** The seam field a text operation edits: the one the act names, else the one field the last frame painted. */
function fieldFor(ev: LarMsg_ControlEvent, scope: CameraScope): RidNode | undefined {
  const live = (rid: string): RidNode | undefined => {
    const el = ridMap.get(rid);
    return el && eventScopes.get(rid) === scope && scope.liveIds.has(rid) && standsAttached(el, scope.roots) && larFieldEngineOf(el) ? el : undefined;
  };
  if (ev.fieldId !== undefined) return live(scope.controlIds.get(ev.fieldId) ?? ev.fieldId);
  const fields = [...scope.liveIds].map(live).filter((n): n is RidNode => n !== undefined);
  return fields.length === 1 ? fields[0] : undefined;
}

/** Whether `widget` stands at or under `ancestor` in the widget tree. */
function widgetUnder(widget: Record<string, any> | undefined, ancestor: unknown): boolean {
  for (let w = widget; w; w = w["parentWidget"]) if (w === ancestor) return true;
  return false;
}

function dispatchPageControl(ev: LarMsg_ControlEvent, el: RidNode, key: string, scope: CameraScope, answer: Answer): LarMsg_ControlResult | undefined {
  switch (ev.action) {
    case "lar:edit-operation": {
      if (!claims(el, "click")) return answer("refused", "unclaimed");
      const field = fieldFor(ev, scope);
      const sel = ev.selection;
      if (!field || !scope.controls || typeof ev.wholeValue !== "string" || !sel || sel.end > ev.wholeValue.length) return answer("refused", "selection-unavailable");
      const fieldKey = field.attributes["data-lar-rid"]!;
      if (ev.localRev !== undefined && ev.localRev < (scope.sensed.get(fieldKey) ?? -1)) return answer("stale-target");
      const engine = larFieldEngineOf(field)!;
      engine.carry({ text: ev.wholeValue, selStart: sel.start, selEnd: sel.end });
      // A sibling toolbar's message bubbles past the field to the root; the root hands it to the field's editor.
      const forward = (message: Record<string, any>): boolean => {
        if (!widgetUnder(message["widget"], engine.widget)) engine.widget["handleEditTextOperationMessage"](message);
        return false;
      };
      const root = scope.controls.rootWidget;
      root["addEventListener"]("tm-edit-text-operation", forward);
      try {
        bubble(scope, el, "click", projectedEvent("click", el, scope, ev));
      } finally {
        root["removeEventListener"]("tm-edit-text-operation", forward);
      }
      const outcome = engine.takeOutcome();
      if (!outcome) return answer("refused", "unclaimed");
      if ("refused" in outcome) return answer("refused", outcome.refused);
      if (ev.localRev !== undefined) takeIn(scope, fieldKey, ev.localRev + 1);
      scope.mark();
      return answer("applied", undefined, outcome.want);
    }
    case "lar:take-theirs": {
      const engine = larFieldEngineOf(el);
      if (!engine) return answer("refused", "unsupported-control");
      engine.takeDescribed();
      if (ev.localRev !== undefined) takeIn(scope, key, ev.localRev);
      scope.mark();
      return answer("applied");
    }
    case "lar:dismiss": {
      if (!scope.controls) return answer("refused", "binding-unavailable");
      scope.controls.dismiss();
      scope.mark();
      return answer("applied");
    }
    default:
      return undefined;
  }
}

// ── Host doors ──────────────────────────────────────────────────────────────────────────────────

/** The act a dispatch runs now, so a door asked inside its handler answers that act. */
let dispatching: { readonly scope: CameraScope; refusal: LarRefusal | undefined } | undefined;
/** Every host-door ask still waiting on its `lar:service-result`, by request id, oldest first. */
const serviceLedger = new Map<string, { readonly kind: LarServiceKind; readonly scope: CameraScope; readonly settle: (status: string) => void }>();
let serviceSeq = 0;
const serviceNonce = Math.random().toString(36).slice(2, 10);

/**
 * Ask the surface to open one host door for `scope`. A kind the surface's manifest lacks, a kind the house never
 * names, or an argument past the bound refuses at once; any other posts `lar:service` and waits in the ledger.
 */
function askService(home: CameraScope, kind: string, args: LaresServiceArgs, settle: (status: string) => void): void {
  const scope = dispatching?.scope ?? home;
  const refuse = (reason: LarRefusal): void => {
    if (dispatching) dispatching.refusal = reason;
    settle(reason);
  };
  if (!LAR_SERVICE_KINDS.has(kind) || !scope.services.has(kind)) { refuse("page-action-unavailable"); return; }
  if (Object.values(args).some((a) => typeof a === "string" && a.length > LAR_WHOLE_BYTES_MAX)) { refuse("input-too-long"); return; }
  const requestId = `lar:service:${serviceNonce}:${++serviceSeq}`;
  serviceLedger.set(requestId, { kind: kind as LarServiceKind, scope, settle });
  if (serviceLedger.size > SERVICE_LEDGER) {
    const [oldest, entry] = serviceLedger.entries().next().value!;
    serviceLedger.delete(oldest);
    entry.settle("superseded");
  }
  scope.post(mkLarService({ wikiUri: scope.wikiUri, requestId, kind: kind as LarServiceKind, args }));
}

/** Close one request by its id: `ok` or the named refusal settles the ask; an id never minted refuses `unknown-request`. */
function settleService(
  ev: LarMsg_ControlEvent, scope: CameraScope | undefined, answer: (status: LarResultStatus, reason?: LarRefusal) => LarMsg_ControlResult,
): LarMsg_ControlResult {
  const asked = ev.requestId === undefined ? undefined : serviceLedger.get(ev.requestId);
  if (!asked) {
    console.warn(`[wiki-worker] lar:service-result names no open request: ${ev.requestId ?? "(none)"}`);
    return answer("refused", "unknown-request");
  }
  serviceLedger.delete(ev.requestId!);
  asked.settle(ev.status === "ok" ? "ok" : ev.status ?? "binding-unavailable");
  asked.scope.mark();
  if (!scope) {
    const result = mkLarControlResult({ eventId: ev.eventId, cameraId: ev.cameraId, mountEpoch: ev.mountEpoch, ...(ev.controlId !== undefined ? { controlId: ev.controlId } : {}), status: "applied" });
    asked.scope.post(result);
    return result;
  }
  return answer("applied");
}

/** Ask every camera of `msg.cameraId` (on `wikiUri`, where named) to paint itself whole under a fresh epoch. */
export function resendLarCamera(msg: LarMsg_Resend, wikiUri?: string): boolean {
  let asked = false;
  for (const camera of cameras) {
    if (camera.cameraId !== msg.cameraId || (wikiUri !== undefined && camera.wikiUri !== wikiUri)) continue;
    camera.resend(msg.manifest);
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
  // The editor's engine seam and the control table stand before the camera renders its first field, and before
  // the declarations wrap the widget classes, so the seam's `edit-text` declares its live value too.
  installLarFieldEngine(tw);
  // Declare every binding at the moment TW5 makes it: the per-widget table stamps what the page cancels.
  patchWidgetDeclarations(tw);
  // The worker's fake document has no browser startup, which normally stands TW5's Popup. Reuse
  // TW5's own manager over a fake root so popup state remains ordinary wiki state and every frame
  // remains a complete snapshot.
  const popupRoot = fakeDoc.createElement("div");
  const storyContainer = fakeDoc.createElement("div");
  const layerContainer = fakeDoc.createElement("div");
  /** Every key's revision rises across the mount's whole life, epochs included. */
  let surfaceRev = 0, styleRev = 0;
  const membershipRev = 1;
  /** The stylesheet text the mount's last frame carried, and whether the next frame carries every key whole. */
  let lastCss: string | undefined;
  let whole = true;
  const scope: CameraScope = {
    wiki: tw.wiki, wikiUri: ctx.wikiUri, cameraId: LAR_CAMERA_STORY, popupRoot, roots: [storyContainer, layerContainer, popupRoot],
    renderIds: new Set(), liveIds: new Set(), controlIds: new Map(),
    mountEpoch: mintEpoch(), sensed: new Map(), answers: new Map(), services: new Set(LAR_SURFACE_DEFAULT_SERVICES),
    ...(ctx.rest ? { rest: ctx.rest } : {}),
    post: (msg) => postLar(ctx, msg),
    mark: () => gate.mark(),
    // A new epoch: every act the page made under the old one now answers stale-target, the old answers leave
    // with it, and the next frame carries every key whole. The sensed revisions stay: the page still holds them.
    resend: (manifest) => {
      scope.mountEpoch = mintEpoch(); scope.answers.clear(); whole = true;
      if (manifest) scope.services = new Set(manifest.services);
      gate.mark();
    },
    alert: (title, text) => tw.wiki.addTiddler(new tw.Tiddler({ title, text, tags: ["$:/tags/Alert"], component: "projection", modified: new Date() })),
  };
  activeEventScope = scope;
  cameras.add(scope);
  mountOffers(scope, tw);
  // The camera's top element (TW5's transclusion wrapper) carries a render id of its own, so every painted node
  // names a node of the fake tree an act can climb from: an act on a node no binding reaches climbs to the top and
  // answers `unclaimed`. A re-render that replaces the top element gets the stamp again before the next frame.
  const stampTop = (): void => {
    const top = storyContainer.children?.[0];
    if (!top?.attributes || top.attributes["data-lar-rid"] !== undefined) return;
    const rid = String(++ridSeq);
    top.setAttribute("data-lar-rid", rid);
    ridMap.set(rid, top);
    eventScopes.set(rid, scope);
    scope.renderIds.add(rid);
  };
  if (typeof tw.utils?.Popup !== "function") {
    throw new Error("TW5 projection cannot install its own popup manager: $tw.utils.Popup is unavailable");
  }
  const popupManager = new tw.utils.Popup({ rootElement: scope.popupRoot });
  tw.popup = popupManager;
  scope.controls = { rootWidget: tw.rootWidget, dismiss: () => popupManager.cancel(0) };
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

  // Root layer — the records the root-services startup keeps (modals, notifications, hints), painted beside the
  // story so they ride the one `lar:surface` key; a layer that holds nothing adds no byte to the frame.
  const layerWidget = tw.wiki.makeTranscludeWidget(TW5_ROOT_LAYER, {
    document:     fakeDoc,
    parentWidget: tw.rootWidget,
  });
  layerWidget.render(layerContainer, null);

  // The host door the root-services startup asks through: one per island, this camera's while it stands.
  const door: LaresServiceDoor = { ask: (kind, args, settle) => askService(scope, kind, args, settle) };
  const lares = (tw.lares ??= {}) as Record<string, unknown>;
  lares["serviceDoor"] = door;

  // Coalesce-family gate (mesh/projection-nalu): a burst of wiki changes collapses to one frame;
  // the newest snapshot wins, intermediates fade (the decay-envelope). The flush snapshots the
  // live fakeDOM lazily at the crest — `mark()` only says "the source moved".
  const gate = new CoalesceGate({
    windowMs: COALESCE_MS,
    onFlush: () => {
      stampTop();
      const layer = tw5ElementToHtml(layerContainer);
      const html = tw5ElementToHtml(storyContainer) + (layer === "" ? "" : `<div class="lar-root-layer">${layer}</div>`);
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
      keys.push(...offerKeys(scope, html, whole));
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
    layerWidget.refresh(changes, layerContainer, null);
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
    if (lares["serviceDoor"] === door) delete lares["serviceDoor"];
    for (const [requestId, entry] of serviceLedger) if (entry.scope === scope) serviceLedger.delete(requestId);
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

// ── S6 · files, drops, order, keys and navigate ─────────────────────────────────────────────────────
//
// The island's half of the import, drop, order, keyboard and navigation classes (dreamdom#/what-a-sink-keeps):
//
//   - `lar:import-offer` lands a picked file on the `$browse` input that bound `change` (or on a drop handler)
//     through TW5's own road: the bytes the page read cross as a projected `File`, the `th-importing-file` hook
//     TW5 offers every reader answers it with `deserializeTiddlers` (or with the tiddlers the page parsed from
//     `text/vnd.tiddler` JSON), and the widget dispatches `tm-import-tiddlers` itself, so `$:/Import` parks.
//   - `lar:drop` hands the dropped payload (bytes, `text/vnd.tiddler` JSON, plain text, or a whole title list
//     resolved to the JSON a drag source carries) to the node's own `drop` listeners as a `dataTransfer`.
//   - `lar:perform-import` names a parked import by its title and dispatches `tm-perform-import` from the widget
//     that parked it, so the same navigator lands it.
//   - `lar:order` writes a `lar-order-list`'s WHOLE ordered id list onto the field it binds; an id the list lacks
//     never deletes a member, and an id outside the members never adds one.
//   - `lar:key` on `lar:document` runs TW5's own keyboard manager; the frame's `lar:shortcuts` key carries the
//     chords that manager parses from `$:/tags/KeyboardShortcut`, the set the page's document leg listens for.
//     A key act on a node under a declared crossing set (`data-lar-keys`) that names no chord of it refuses
//     `unclaimed` and runs nothing.
//   - `lar:route` on `lar:document` navigates the story the way TW5's own `Story` does; the frame's
//     `lar:story-order` key carries the story order and the history tail the page composes `#` from.
//   - a catcher runs only its declared discrete listener; continuous streams and pointer capture refuse by name.

const IMPORT_TITLE = "$:/Import";
const STORY_LIST = "$:/StoryList";
const HISTORY_LIST = "$:/HistoryList";
/** The mark a projected `File` carries: what the page already read, so the reader hook answers it. */
const PROJECTED_FILE = Symbol("lararium.projected-file");
const OFFER_HOOK = Symbol("lararium.offer-hook");

interface ProjectedFile {
  readonly name: string; readonly type: string; readonly size: number;
  readonly [PROJECTED_FILE]: { readonly bytes?: Uint8Array; readonly tiddlers?: readonly Record<string, unknown>[] };
}
interface WidgetLike { dispatchEvent(event: Record<string, unknown>): unknown }

/** Per camera: the engine it speaks for, the imports offers parked, the declared controls the last frame painted, and the
 *  last payload and revision of each key this section emits. */
interface OfferState {
  readonly tw: Record<string, any>;
  readonly parked: Map<string, WidgetLike>;
  declared: Map<string, Record<string, string>>;
  chords?: string; chordsRev: number;
  story?: string; storyRev: number;
}
const offerStates = new WeakMap<CameraScope, OfferState>();

/** The DOM event type an act reaches a listener under. */
const DOM_TYPE: Readonly<Record<string, string>> = {
  "lar:click": "click", "lar:key": "keydown", "lar:drop": "drop", "lar:import-offer": "change",
  "lar:commit": "change", "lar:toggle": "change", "lar:choice": "change",
};

/** Install, once per engine, the reader hook that answers a projected file with what the page read. */
function installOfferHook(tw: Record<string, any>): void {
  if (tw[OFFER_HOOK as unknown as string]) return;
  tw[OFFER_HOOK as unknown as string] = true;
  tw.hooks.addHook("th-importing-file", (info: { file?: ProjectedFile; type: string; isBinary: boolean; callback(fields: unknown[]): void } | true) => {
    const read = info !== true ? info?.file?.[PROJECTED_FILE] : undefined;
    if (info === true || !read) return info;
    if (read.tiddlers) { info.callback([...read.tiddlers]); return true; }
    const bytes = read.bytes ?? new Uint8Array();
    let text: string;
    if (info.isBinary) {
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      text = btoa(binary);
    } else {
      text = new TextDecoder().decode(bytes);
    }
    info.callback(tw.wiki.deserializeTiddlers(info.type, text, { title: info.file!.name || "Untitled" }));
    return true;
  });
}

/** Arm this section for one camera. */
function mountOffers(scope: CameraScope, tw: Record<string, any>): void {
  installOfferHook(tw);
  offerStates.set(scope, { tw, parked: new Map(), declared: new Map(), chordsRev: 0, storyRev: 0 });
}

/** The tiddlers a `text/vnd.tiddler` JSON string names, or null when it names none. */
function tiddlersOfJson(tw: Record<string, any>, json: string): Record<string, unknown>[] | null {
  const data = tw.utils.parseJSONSafe(json, null) as unknown;
  const list = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : null;
  if (!list || list.length === 0) return null;
  return list.every((t) => t && typeof t === "object" && typeof (t as Record<string, unknown>)["title"] === "string")
    ? list as Record<string, unknown>[] : null;
}

/** A projected file over what the page read: bytes with their name and type, or tiddlers the page parsed. */
function projectedFile(ev: LarMsg_ControlEvent, tiddlers?: readonly Record<string, unknown>[]): ProjectedFile {
  const bytes = ev.wholeValue instanceof Uint8Array ? ev.wholeValue : undefined;
  return {
    name: ev.file?.name ?? (tiddlers ? "import.json" : "Untitled"),
    type: ev.file?.type ?? (tiddlers ? "application/json" : ""),
    size: bytes?.byteLength ?? 0,
    [PROJECTED_FILE]: { ...(bytes ? { bytes } : {}), ...(tiddlers ? { tiddlers } : {}) },
  };
}

/** The `dataTransfer` a drop hands its listeners, carrying the payload the page read. */
function dataTransferOf(state: OfferState, ev: LarMsg_ControlEvent): Record<string, unknown> | null {
  const { tw } = state;
  const data = new Map<string, string>();
  let files: ProjectedFile[] = [];
  const v = ev.wholeValue;
  if (v instanceof Uint8Array) {
    files = [projectedFile(ev)];
    data.set("Files", "");
  } else if (typeof v === "string") {
    if (tiddlersOfJson(tw, v)) data.set("text/vnd.tiddler", v);
    data.set("text/plain", v);
  } else if (Array.isArray(v) && v.length > 0) {
    const titles = v as readonly string[];
    const json = titles.map((t) => tw.wiki.getTiddlerAsJson(t) as string);
    data.set("text/vnd.tiddler", json.length === 1 ? json[0]! : `[${json.join(",")}]`);
    data.set("text/plain", tw.utils.stringifyList(titles));
  } else {
    return null;
  }
  return {
    files, types: [...data.keys()], items: [], dropEffect: "none", effectAllowed: "all",
    getData: (type: string) => data.get(type) ?? "",
  };
}

/** Run one projected event's listeners on `el`, noting the import a listener's widget parks along the way. */
function runOffer(state: OfferState, scope: CameraScope, el: RidNode, type: string, event: Record<string, unknown>): void {
  const proto = Object.getPrototypeOf(state.tw.rootWidget) as { dispatchEvent(this: WidgetLike, e: Record<string, unknown>): unknown };
  const dispatch = proto.dispatchEvent;
  proto.dispatchEvent = function (this: WidgetLike, e: Record<string, unknown>): unknown {
    if (e["type"] === "tm-import-tiddlers") {
      const title = String(e["importTitle"] || (e["paramObject"] as Record<string, unknown> | undefined)?.["importTitle"] || IMPORT_TITLE);
      if (!state.parked.has(title) || e["widget"] === undefined) state.parked.set(title, (e["widget"] as WidgetLike | undefined) ?? this);
    }
    return dispatch.call(this, e);
  };
  const doc = state.tw.fakeDocument as Record<string, unknown>;
  const lentBody = doc["body"] === undefined;
  // A dropzone clears its drag state on the document's body; the fake document holds none, so one stands for the drop.
  if (lentBody) doc["body"] = (doc["createElement"] as (t: string) => unknown)("body");
  // TW5's `importDataTransfer` asks the browser whether it runs as IE; a worker holds no `$tw.browser`, so the two
  // facts that reader asks stand for the drop and leave with it.
  const browser = state.tw.browser as unknown;
  const lentBrowser = !browser;
  if (lentBrowser) state.tw.browser = { isIE: false, isMobileChrome: false };
  try {
    runListeners(scope, el, type, event);
  } finally {
    proto.dispatchEvent = dispatch;
    if (lentBody) delete doc["body"];
    if (lentBrowser) state.tw.browser = browser;
  }
}

/** Whether the projected key event matches a chord of a declared crossing set, by the engine's own parse. */
function chordDeclared(tw: Record<string, any>, stamp: string, event: Record<string, unknown>): boolean {
  const km = tw.keyboardManager;
  if (!km) return false;
  const infos = (km.parseKeyDescriptors(stamp) as unknown[]).filter(Boolean);
  return km.getMatchingKeyDescriptor(event, infos) !== null;
}

/**
 * The S6 crossings, ahead of the target resolution `dispatchLarControlEvent` makes: an answer for an act this
 * section owns, or undefined to let the event take its ordinary road.
 */
function dispatchOffer(ev: LarMsg_ControlEvent, scope: CameraScope, answer: (status: LarResultStatus, reason?: LarRefusal) => LarMsg_ControlResult): LarMsg_ControlResult | undefined {
  const state = offerStates.get(scope);
  if (!state || ev.kind !== "lar:act") return undefined;
  const { tw } = state;
  activeEventScope = scope;

  if (ev.controlId === LAR_CONTROL_DOCUMENT) {
    if (ev.action === "lar:key") {
      const km = tw.keyboardManager;
      if (!km || !ev.key) return answer("refused", "unclaimed");
      if (larReservedChord(ev.key.key, { ctrl: !!ev.modifiers?.ctrl, alt: !!ev.modifiers?.alt, shift: !!ev.modifiers?.shift, meta: !!ev.modifiers?.meta })) return answer("refused", "reserved-chord");
      const event = projectedEvent("keydown", scope.popupRoot, scope, ev);
      let handled = false;
      try { handled = km.handleKeydownEvent(event) === true; } catch (error) {
        const refusal = error instanceof Error ? error : new Error(String(error));
        scope.alert("$:/temp/lares/alert/handler-refused", `An action stopped: ${refusal.name || "Error"}: ${refusal.message}`);
        handled = true;
      }
      scope.mark();
      return handled ? answer("applied") : answer("refused", "unclaimed");
    }
    if (ev.action === "lar:route") {
      const title = typeof ev.wholeValue === "string" ? ev.wholeValue : "";
      if (title === "" || !(tw.wiki.tiddlerExists(title) || tw.wiki.isShadowTiddler(title))) return answer("refused", "route-unresolved");
      new tw.Story({ wiki: tw.wiki, storyTitle: STORY_LIST, historyTitle: HISTORY_LIST }).navigateTiddler(title);
      scope.mark();
      return answer("applied");
    }
    return answer("refused", "unsupported-control");
  }

  if (ev.action === "lar:perform-import") {
    const title = ev.controlId ?? "";
    const widget = state.parked.get(title);
    if (!widget || tw.wiki.getTiddler(title)?.fields["plugin-type"] !== "import") return answer("refused", "binding-unavailable");
    widget.dispatchEvent({ type: "tm-perform-import", param: title });
    state.parked.delete(title);
    scope.mark();
    return answer("applied");
  }

  if (ev.action === "lar:order") {
    const attrs = ev.controlId !== undefined ? state.declared.get(ev.controlId) : undefined;
    if (!attrs) return answer("stale-target");
    if (!isKeySet(ev.wholeValue) || (ev.controlType !== undefined && ev.controlType !== "lar-order-list")) return answer("refused", "unsupported-control");
    const tiddler = attrs["data-tiddler"] ?? "", field = attrs["data-field"] ?? "list";
    if (tiddler === "" || field === "title" || !/^[a-z0-9\-._]+$/.test(field)) return answer("refused", "binding-unavailable");
    const members = (tw.utils.parseStringArray(tw.wiki.getTiddler(tiddler)?.getFieldString(field) ?? "") ?? []) as string[];
    const asked = [...new Set(ev.wholeValue)].filter((id) => members.includes(id));
    const next = [...asked, ...members.filter((id) => !asked.includes(id))];
    if (next.join("\n") !== members.join("\n")) tw.wiki.setText(tiddler, field, undefined, tw.utils.stringifyList(next));
    scope.mark();
    return answer("applied");
  }

  const el = resolveTarget(ev, scope);
  if (!el) return undefined;
  const type = ev.action === "lar:event" ? ev.eventType : DOM_TYPE[ev.action] ?? (/^lar:(pointer|mouse|touch|wheel|scroll)/.test(ev.action) ? ev.action.slice(4) : undefined);
  if (ev.action === "lar:event" && !type) return answer("refused", "unsupported-control");
  for (let node: RidNode | null | undefined = el; node && type; node = node.parentNode) {
    if (!(node.attributes["class"] ?? "").split(/\s+/).includes("tc-eventcatcher")) continue;
    // The ruling (page-controls, 2026-10-16): a catcher that asks for pointer capture refuses it by name; any event
    // outside the declared discrete set refuses as a continuous stream.
    if (node.attributes["data-lar-catcher-refused"] === "pointer-capture-refused") return answer("refused", "pointer-capture-refused");
    if (!CATCHER_EVENTS.has(type)) return answer("refused", "continuous-event-refused");
    const match = node.attributes["data-lar-catcher-match-selector"];
    const selector = node.attributes["data-lar-catcher-selector"];
    if (match && !fakeMatches(el, match)) return answer("refused", "unclaimed");
    if (selector) {
      let found = false;
      for (let selected: RidNode | null | undefined = el; selected && selected !== node; selected = selected.parentNode) {
        if (fakeMatches(selected, selector)) { found = true; break; }
      }
      if (!found) return answer("refused", "unclaimed");
    }
  }

  if (ev.action === "lar:key") {
    if (ev.key && larReservedChord(ev.key.key, { ctrl: !!ev.modifiers?.ctrl, alt: !!ev.modifiers?.alt, shift: !!ev.modifiers?.shift, meta: !!ev.modifiers?.meta })) return answer("refused", "reserved-chord");
    const event = projectedEvent("keydown", el, scope, ev);
    const stamps: string[] = [];
    for (let node: RidNode | null | undefined = el; node; node = node.parentNode) {
      const stamp = node.attributes["data-lar-keys"];
      if (stamp !== undefined) stamps.push(stamp);
    }
    if (stamps.length > 0 && !chordDeclared(tw, stamps.join(" "), event)) return answer("refused", "unclaimed");
    return undefined;
  }

  if (ev.action === "lar:event") {
    if (!CATCHER_EVENTS.has(type!)) return answer("refused", "continuous-event-refused");
    let catcherBound = false;
    for (let node: RidNode | null | undefined = el; node; node = node.parentNode) {
      if ((node.attributes["class"] ?? "").split(/\s+/).includes("tc-eventcatcher") && binds(node, type!)) { catcherBound = true; break; }
    }
    if (!catcherBound) return answer("refused", "unclaimed");
    bubble(scope, el, type!, projectedEvent(type!, el, scope, ev));
    scope.mark();
    return answer("applied");
  }

  if (ev.action === "lar:import-offer" || ev.action === "lar:drop") {
    const fileInput = el.tag === "input" && el.attributes["type"] === "file";
    if (ev.action === "lar:import-offer" && fileInput && binds(el, "change")) {
      const tiddlers = typeof ev.wholeValue === "string" ? tiddlersOfJson(tw, ev.wholeValue) : undefined;
      if (tiddlers === null || (tiddlers === undefined && !(ev.wholeValue instanceof Uint8Array))) return answer("refused", "unsupported-control");
      const holder = el as RidNode & { files?: unknown };
      holder.files = [projectedFile(ev, tiddlers)];
      try { runOffer(state, scope, el, "change", projectedEvent("change", el, scope, ev)); } finally { delete holder.files; }
      scope.mark();
      return answer("applied");
    }
    if (!binds(el, "drop")) return answer("refused", ev.action === "lar:drop" ? "unclaimed" : "unsupported-control");
    const dataTransfer = dataTransferOf(state, ev);
    if (!dataTransfer) return answer("refused", "unsupported-control");
    const dropEvent = { ...projectedEvent("drop", el, scope, ev), dataTransfer, isTrusted: false };
    for (let node: RidNode | null | undefined = el; node && !(dropEvent.stopped as () => boolean)(); node = node.parentNode) {
      if (binds(node, "drop")) runOffer(state, scope, node, "drop", dropEvent);
    }
    scope.mark();
    return answer("applied");
  }
  return undefined;
}

/**
 * The keys this section adds to a frame: `lar:shortcuts` and `lar:story-order`, each only when its payload moved
 * since the mount's last frame or the frame runs whole, each under its own rising revision. Also reads the declared
 * controls (`lar-order-list`) the frame paints, the only ones an order act may name.
 */
function offerKeys(scope: CameraScope, html: string, whole: boolean): LarFrameKey[] {
  const state = offerStates.get(scope);
  if (!state) return [];
  const { tw } = state;
  state.declared = new Map();
  for (const [tag] of html.matchAll(/<lar-order-list\b[^>]*>/g)) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1]!, tw.utils.htmlDecode(m[2]!) as string]));
    if (attrs["data-control-id"]) state.declared.set(attrs["data-control-id"], attrs);
  }
  const keys: LarFrameKey[] = [];
  const chords = shortcutChords(tw);
  const chordsJson = JSON.stringify(chords);
  if (whole || chordsJson !== state.chords) keys.push({ key: LAR_KEY_SHORTCUTS, rev: ++state.chordsRev, chords });
  state.chords = chordsJson;
  const history = tw.wiki.getTiddlerData(HISTORY_LIST, []) as unknown;
  const entries = Array.isArray(history) ? history as { title?: unknown }[] : [];
  const tailTitle = entries.at(-1)?.title;
  const story: LarStoryOrder = {
    order: (tw.wiki.getTiddlerList(STORY_LIST) ?? []) as string[],
    tail: typeof tailTitle === "string" && tailTitle !== "" ? tailTitle : null,
    depth: entries.length,
  };
  const storyJson = JSON.stringify(story);
  if (whole || storyJson !== state.story) keys.push({ key: LAR_KEY_STORY_ORDER, rev: ++state.storyRev, story });
  state.story = storyJson;
  return keys;
}

/** The chords `$:/tags/KeyboardShortcut` declares, each descriptor parsed by TW5's own keyboard manager. */
function shortcutChords(tw: Record<string, any>): LarShortcutChord[] {
  const km = tw.keyboardManager;
  if (!km) return [];
  const expand = (descriptors: string, stack: Set<string>): string[] => descriptors.split(" ").filter(Boolean).flatMap((d) => {
    const named = /^\(\((.+)\)\)$/.exec(d);
    if (!named) return [d];
    if (stack.has(d)) return [];
    const inner = new Set(stack).add(d);
    return (km.lookupNames as string[]).flatMap((platform) => expand(tw.wiki.getTiddlerText(`$:/config/${platform}/${named[1]}`) ?? "", inner));
  });
  const chords: LarShortcutChord[] = [];
  const seen = new Set<string>();
  for (const title of km.getShortcutTiddlerList() as string[]) {
    const key = tw.wiki.getTiddler(title)?.fields["key"];
    if (typeof key !== "string") continue;
    for (const descriptor of expand(key, new Set())) {
      const info = km.parseKeyDescriptor(descriptor, {}) as { keyCode: number; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean } | null;
      if (!info || seen.has(descriptor)) continue;
      seen.add(descriptor);
      chords.push({ descriptor, keyCode: info.keyCode, ctrl: info.ctrlKey, shift: info.shiftKey, alt: info.altKey, meta: info.metaKey });
    }
  }
  return chords;
}
