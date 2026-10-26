/**
 * projection-sink — the page's replica of the surface a vessel island renders, speaking the camera contract.
 *
 * The island renders; the page holds values, selection, focus, composition and geometry. A `lar:frame` arrives
 * keyed (dreamdom#/the-ruling): `lar:surface` carries the pane's whole HTML, `lar:style` the whole sheet,
 * `lar:membership` the complete visible set, each under its own revision within one mount epoch, beside the
 * `sensedRevision` the island had taken in per control. The sink morphs the pane in place (idiomorph) inside an
 * isolated shadow root and relays the person's acts up as `lar:control-event`s; `lar:control-result` answers
 * land on `applyResult` and paint their words beside the control they name (page-controls#/refusals).
 *
 * Laws this module keeps:
 *   - A KEY ORDERS ONLY ITSELF. Each key keeps its own revision within one mount epoch of one surface; a lower
 *     revision of a key drops as stale and leaves the frame's other keys free to paint. A new epoch paints every
 *     key whole whatever its numbers; a switch to another surface paints that surface's keys whole. An absent
 *     `lar:style` key keeps the sheet the sink holds for that surface.
 *   - THE PERSON'S REVISION OUTRANKS AN OLDER RENDER. The sink counts `localRev` per control, bumped on every
 *     relayed sense, commit, toggle and choice, and keeps a live control's node, value, selection, `checked` and
 *     selected options while its `localRev` runs ahead of the frame's `sensedRevision` for it, focused or not. A composing node never morphs; a field whose
 *     value the bound refused never morphs, since its text lives on the page alone. Undo survives because the
 *     node stays. A control names itself by `data-control-id` where the template named one, else by render id.
 *   - EVERY ACT CARRIES WHAT THE PAGE SHOWED. A relayed event carries a minted id, the camera, the shown mount
 *     epoch, the shown surface key's revision and the target, read at the moment of the act, and names the
 *     surface whose frame painted its target, so the vessel routes it to that island.
 *   - THE PAGE CANCELS ONLY WHAT A BINDING DECLARED. A click or a key relays to the first node whose
 *     `data-lar-on` binds its type and cancels only by that climb's `data-lar-cancel`; an unstamped node relays
 *     nothing and the browser's default stands.
 *   - A REFUSAL SAYS SO BESIDE ITS CONTROL. The words stand in a sibling layer beside the pane, keyed by control
 *     id, so no frame's morph claims them; they leave when the control leaves, when a later `applied` lands for
 *     it, or when the surface gives way. A value past the bound never crosses and raises `input-too-long` there.
 *   - A MOUNT NEVER SHOWS BLANK. Until a surface's mount epoch paints its first `lar:surface` key, a loading
 *     plate beside the pane reads the island's latest breath for that surface (`setBreath`). On a switch the
 *     old frame stays visible, inert, under the plate, and the plate drops in the paint that lands the first key.
 *   - NOTHING LEAKS ACROSS A SWITCH. Islands share no render-id space: the old surface's nodes, words and popup
 *     placement end with it; each surface keeps its own revisions, sheet and local revisions.
 *   - A HOST DOOR OPENS UNDER A PERSON'S ACT AND THE SURFACE'S MANIFEST. A `lar:service` ask opens its door only
 *     while the person's last act on the page stands fresh (or the browser's own transient activation does), one
 *     door per act, and only for a kind the manifest the surface opened with names; any other answers by name,
 *     with the words beside the control the person acted on. Every ask gets its `lar:service-result`.
 */
import { Idiomorph } from "idiomorph";
// The contract module carries no imports of its own; its own subpath keeps the mesh barrel (and its wasm) out of
// the page sink.
import {
  LAR_CAMERA_STORY, LAR_KEY_MEMBERSHIP, LAR_KEY_STYLE, LAR_KEY_SURFACE, LAR_SURFACE_DEFAULT_SERVICES, LAR_WHOLE_VALUE_MAX_CHARS,
  LAR_STAMP_BUBBLE, LAR_STAMP_CANCEL, LAR_STAMP_KEYS, LAR_STAMP_ON,
  larKeyChordName, larLogicalKeyCode, larReservedChord, mkLarControlEvent, readLarCancel, readLarControlResult, readLarFrame, readLarService, readLarStampTokens,
  type LarControlKind, type LarMsg_ControlEvent, type LarMsg_ControlResult, type LarMsg_Frame, type LarMsg_Service, type LarRefusal,
  type LarServiceKind, type LarSurfaceManifest,
  LAR_CONTROL_DOCUMENT, LAR_KEY_SHORTCUTS, LAR_KEY_STORY_ORDER, LAR_WHOLE_BYTES_MAX,
  type LarFrameKey, type LarShortcutChord, type LarStoryOrder,
} from "@lararium/mesh/lar-camera";
import {
  LAR_FIELD_TAKE_THEIRS, applyWholeValue, defineLarField, isApplyingField, isLarFieldNode, markFieldEdited,
  reconcileFieldDescriptor, type LarFieldNode,
} from "./controls/lar-field.js";
import { defineLarPopover, dismissPopover, paintPopovers } from "./controls/lar-popover.js";
import { defineLarDisclosure, holdsDisclosure, notePaintedDisclosures, takeDisclosureToggle } from "./controls/lar-disclosure.js";
import { matchChord } from "./controls/lar-chords.js";
import { LarFilePicker, bytesRefusalWords, defineLarFilePicker, maxBytesOf, readFileOffer, readsAsTiddlers, type FileOffer } from "./controls/lar-file-picker.js";
import { defineLarOrderList, type LarOrderDetail } from "./controls/lar-order-list.js";

/** A frame as the page receives it: the contract's keyed frame, plus the surface whose island emitted it. */
export type LarSurfaceFrame = LarMsg_Frame & { readonly surface: string };
/** A host-door ask as the page receives it, plus the surface whose island asked. */
export type LarSurfaceService = LarMsg_Service & { readonly surface: string };

/** One host door the page can open: it resolves when the door opened, and throws when the browser refused it. */
export type LarHostDoor = (args: LarMsg_Service["args"], host: HTMLElement) => void | Promise<void>;
export type ServiceVerdict = "opened" | "refused" | "malformed";

export interface ProjectionSinkOptions {
  readonly inputMaxChars?: number;
  /** The doors this surface carries, named at surface-open; `LAR_SURFACE_DEFAULT_SERVICES` when absent. */
  readonly services?: LarSurfaceManifest["services"];
  /** The doors at hand by kind, over the page's own (clipboard, download, print, fullscreen, open-external); the
   *  vessel hands `route` and `open-surface`, which only it can move. */
  readonly doors?: Partial<Record<LarServiceKind, LarHostDoor>>;
  /** Push the address the story order composes and route Back as `lar:route` (S6); off where the host owns the address. */
  readonly addressBar?: boolean;
}

/** The vessel's return leg, as the sink speaks it. */
export interface ProjectionReturnDoors {
  sendControlEvent(surface: string, ev: LarMsg_ControlEvent): unknown;
}

export type FrameVerdict = "painted" | "held" | "stale-frame" | "malformed";

/** What an island says while it mounts: its phase, and a fraction done where it can count one. */
export interface LarBreath { readonly phase: string; readonly progress?: number }
export type ResultVerdict = "cleared" | "painted" | "ignored";

export interface ProjectionSink {
  /** Paint a frame's keys; hold a frame of another surface that carries no surface key; drop it as stale when
   *  every key falls behind; or refuse it when the reader does. */
  apply(frame: LarSurfaceFrame): FrameVerdict;
  /** Take an answer: `applied` clears its control's words, `stale-target` and `refused` paint them. */
  applyResult(result: LarMsg_ControlResult): ResultVerdict;
  /** The island's latest breath for a surface, read by the loading plate while that surface's mount waits. */
  setBreath(surface: string, breath: LarBreath): void;
  /** The vessel moved its gate to a surface: the plate stands over the shown frame until that surface paints. */
  awaitSurface(surface: string): void;
  /** Arm the return leg; before this the pane paints and relays nothing. */
  arm(doors: ProjectionReturnDoors): void;
  /** The surface whose frame the pane shows now, or null before the first frame. */
  surface(): string | null;
  /** The visible set the shown surface's membership key last named, or null before one arrived. */
  members(): readonly string[] | null;
  /** The address the shown surface's story order composes (`#<navigated>:<story>`), or null before one arrived. */
  route(): string | null;
  /** Take an island's host-door ask: open it under a fresh act and the manifest, or refuse it by name; either
   *  way answer `lar:service-result` on the return leg. */
  applyService(ask: LarSurfaceService): Promise<ServiceVerdict>;
  /** How many reliable acts this page relayed and holds no answer for. */
  pendingActs(): number;
  /** Release the page's unload hold. */
  dispose(): void;
  /** The manifest this surface opened with, for the vessel's surface-open (`lar:resend{manifest}`). */
  manifest(): LarSurfaceManifest;
}

/** The words a person reads beside a control (page-controls#/refusals). `input-too-long` names the bound in force. */
export const LAR_REFUSAL_WORDS: Readonly<Partial<Record<LarRefusal, string>>> = {
  "invalid-integer": "Enter a whole level from 1 to 20. Your text remains here.",
  "input-too-long": `This field exceeds ${LAR_WHOLE_VALUE_MAX_CHARS.toLocaleString("en-US")} characters. Shorten it before saving.`,
  "stale-target": "This control changed before your action arrived. Review it and try again.",
  "selection-unavailable": "This formatting command needs the current selection and cannot run here.",
  "geometry-unavailable": "This placement needs a live page measurement; the menu opens in the page instead.",
  "route-unresolved": "This destination no longer resolves.",
  "unsupported-control": "This control has no page binding in this vessel. Your change has not saved.",
  "binding-unavailable": "This control has no page binding in this vessel. Your change has not saved.",
  "page-action-unavailable": "This browser action has no page control here.",
  "continuous-event-refused": "This event streams continuously and cannot cross this surface.",
  "pointer-capture-refused": "Pointer capture cannot cross this surface.",
  "reserved-chord": "This shortcut belongs to the browser or system.",
};
const wordsFor = (reason: LarRefusal, bound: number): string =>
  reason === "input-too-long"
    ? `This field exceeds ${bound.toLocaleString("en-US")} characters. Shorten it before saving.`
    : LAR_REFUSAL_WORDS[reason] ?? `This action has not applied here (${reason}).`;

type LiveControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const isLiveControl = (el: Element): el is LiveControl =>
  el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el instanceof HTMLInputElement;

/** What the sink holds per surface; a switch away keeps it, so the surface's own sheet and revisions return with it. */
interface SurfaceState {
  epoch: number | null;
  readonly revs: Map<string, number>;
  sheet: string;
  members: readonly string[] | null;
  readonly localRev: Map<string, number>;
  /** Whether the current mount epoch has painted its `lar:surface` key into the pane. */
  painted: boolean;
  breath: LarBreath | null;
  /** Highest island hint sequence the page acted on during this mount epoch. */
  hintSequence: number;
}

/** The target an event names: the template's control id where one stands nearest, else the render id. */
interface Target { readonly id: string; readonly field: "controlId" | "renderId"; readonly node: Element }

export function createProjectionSink(host: HTMLElement, opts: ProjectionSinkOptions = {}): ProjectionSink {
  const bound = Math.min(opts.inputMaxChars ?? LAR_WHOLE_VALUE_MAX_CHARS, LAR_WHOLE_VALUE_MAX_CHARS);
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  // The sink's own rules sit ahead of the frame's sheet, so a frame may restyle anything but the words' layer.
  let ownStyle = shadow.querySelector<HTMLStyleElement>("style.lar-sink-style");
  if (!ownStyle) {
    ownStyle = shadow.appendChild(document.createElement("style"));
    ownStyle.className = "lar-sink-style";
    ownStyle.textContent = ":host{position:relative}"
      + ".lar-refusals{position:absolute;inset:0;pointer-events:none;z-index:2147483647}"
      + ".lar-loading-plate{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5em;background:rgba(20,20,24,0.72);color:#ffffff;font:14px/1.4 system-ui,sans-serif;z-index:2147483646}"
      + ".lar-loading-plate[hidden]{display:none}"
      + ".lar-refusals>output{position:absolute;pointer-events:auto;max-width:28em;padding:0.25em 0.5em;background:#7a1f1f;color:#ffffff;font:13px/1.4 system-ui,sans-serif}";
  }
  let frameStyle = shadow.querySelector<HTMLStyleElement>("style.lar-frame-style");
  if (!frameStyle) { frameStyle = shadow.appendChild(document.createElement("style")); frameStyle.className = "lar-frame-style"; }
  const sheetEl = frameStyle;
  let pane = shadow.querySelector<HTMLElement>(".lar-projection");
  if (!pane) { pane = document.createElement("div"); pane.className = "lar-projection"; shadow.appendChild(pane); }
  const paneEl = pane;
  let layer = shadow.querySelector<HTMLElement>(".lar-refusals");
  if (!layer) { layer = document.createElement("div"); layer.className = "lar-refusals"; shadow.appendChild(layer); }
  const layerEl = layer;
  let plate = shadow.querySelector<HTMLElement>(".lar-loading-plate");
  if (!plate) {
    plate = document.createElement("div");
    plate.className = "lar-loading-plate";
    plate.setAttribute("role", "status");
    plate.setAttribute("aria-live", "polite");
    shadow.appendChild(plate);
  }
  const plateEl = plate;

  const surfaces = new Map<string, SurfaceState>();
  const stateOf = (surface: string): SurfaceState => {
    let st = surfaces.get(surface);
    if (!st) { st = { epoch: null, revs: new Map(), sheet: "", members: null, localRev: new Map(), painted: false, breath: null, hintSequence: 0 }; surfaces.set(surface, st); }
    return st;
  };
  let shownSurface: string | null = null;
  /** The surface the gate moved to whose mount has not painted yet, or null while the shown surface stands. */
  let awaited: string | null = null;
  let doors: ProjectionReturnDoors | null = null;
  const composingFields = new WeakSet<Element>();
  const compositionEndValue = new WeakMap<Element, string>();
  let holdKeysAfterComposition = false;
  const seenModals = new WeakSet<Element>();
  let modalWasPresent = false;
  let restoreRenderId: string | null = null;
  let pendingPopupPlacement: { readonly top: number; readonly left: number } | undefined;

  // ── Identity ──────────────────────────────────────────────────────────────────────────────────

  const targetOf = (from: Element | null): Target | null => {
    for (let node = from; node && node !== paneEl; node = node.parentElement) {
      const controlId = node.getAttribute("data-control-id");
      if (controlId) return { id: controlId, field: "controlId", node };
      const renderId = node.getAttribute("data-lar-rid");
      if (renderId) return { id: renderId, field: "renderId", node };
    }
    return null;
  };
  const findControl = (id: string): Element | null =>
    paneEl.querySelector(`[data-control-id="${CSS.escape(id)}"]`) ?? paneEl.querySelector(`[data-lar-rid="${CSS.escape(id)}"]`);
  const nonce = [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, "0")).join("");
  let eventCount = 0;
  const mintEventId = (): string => `lar:event:${nonce}:${++eventCount}`;

  // ── Refusal words, in a layer beside the pane ─────────────────────────────────────────────────

  const refusals = new Map<string, HTMLOutputElement>();
  const describedBy = new WeakMap<Element, string>();
  let refusalCount = 0;
  const describedNode = (control: Element): Element =>
    isLiveControl(control) ? control : control.querySelector("input, textarea, select, button") ?? control;
  const place = (out: HTMLOutputElement, control: Element): void => {
    const rect = control.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    out.style.top = `${rect.bottom - hostRect.top + host.scrollTop}px`;
    out.style.left = `${rect.left - hostRect.left + host.scrollLeft}px`;
  };
  const dropRefusal = (id: string): void => {
    const out = refusals.get(id);
    if (!out) return;
    refusals.delete(id);
    out.remove();
    for (const node of paneEl.querySelectorAll("[aria-describedby]")) {
      if (describedBy.get(node) === out.id) { describedBy.delete(node); node.removeAttribute("aria-describedby"); }
    }
  };
  const dropAllRefusals = (): void => { for (const id of [...refusals.keys()]) dropRefusal(id); };
  const paintRefusal = (id: string, reason: LarRefusal): void => {
    let out = refusals.get(id);
    if (!out) {
      out = document.createElement("output");
      out.setAttribute("role", "status");
      out.id = `lar-refusal-${nonce}-${++refusalCount}`;
      out.dataset["larFor"] = id;
      layerEl.appendChild(out);
      refusals.set(id, out);
    }
    out.dataset["larReason"] = reason;
    out.textContent = wordsFor(reason, bound);
    const control = findControl(id);
    if (control) {
      const described = describedNode(control);
      described.setAttribute("aria-describedby", out.id);
      describedBy.set(described, out.id);
      place(out, control);
    }
  };
  /** After a paint: a word whose control left goes with it; the rest follow their controls. */
  const settleRefusals = (): void => {
    for (const [id, out] of [...refusals]) {
      const control = findControl(id);
      if (!control) { dropRefusal(id); continue; }
      const described = describedNode(control);
      if (described.getAttribute("aria-describedby") !== out.id) { described.setAttribute("aria-describedby", out.id); describedBy.set(described, out.id); }
      place(out, control);
    }
  };

  // ── The sensed-revision veto ──────────────────────────────────────────────────────────────────

  let painting: { readonly st: SurfaceState; readonly sensed: Readonly<Record<string, number>> } | null = null;
  const holdsLive = (node: Element): boolean => {
    if (!painting || !isLiveControl(node)) return false;
    if (composingFields.has(node)) return true;
    const target = targetOf(node);
    if (!target) return false;
    if (refusals.get(target.id)?.dataset["larReason"] === "input-too-long") return true;
    return (painting.st.localRev.get(target.id) ?? 0) > (painting.sensed[target.id] ?? 0);
  };
  const morphCallbacks = {
    beforeNodeMorphed: (oldNode: Node, newNode: Node): boolean => {
      if (oldNode instanceof Element && holdsLive(oldNode)) return false;
      reconcileDescriptor(oldNode, newNode);
      return true;
    },
    beforeAttributeUpdated: (name: string, element: Element): boolean => {
      if (name === "aria-describedby" && describedBy.has(element)) return false;
      if (name === "open" && painting && holdsDisclosure(element, painting.sensed[ownId(element) ?? ""])) return false;
      if (name === "value" || name === "checked" || name === "selected") {
        const owner = element instanceof HTMLOptionElement ? element.closest("select") : element;
        if (owner && holdsLive(owner)) return false;
      }
      return true;
    },
  };

  // ── The loading plate ─────────────────────────────────────────────────────────────────────────

  const renderPlate = (): void => {
    const waitingOn = awaited ?? shownSurface;
    const up = waitingOn === null || waitingOn !== shownSurface || !stateOf(waitingOn).painted;
    plateEl.hidden = !up;
    paneEl.inert = up;                         // the old frame stays visible; its nodes reach no island
    if (!up) { plateEl.removeAttribute("data-lar-loading"); plateEl.replaceChildren(); return; }
    const breath = waitingOn === null ? [...surfaces.values()].map((s) => s.breath).findLast((b) => b !== null) ?? null : stateOf(waitingOn).breath;
    plateEl.dataset["larLoading"] = breath?.phase ?? "";
    const words = document.createElement("span");
    const percent = breath?.progress !== undefined && Number.isFinite(breath.progress) ? ` · ${Math.round(Math.min(1, Math.max(0, breath.progress)) * 100)}%` : "";
    words.textContent = breath ? `The wiki is ${breath.phase}${percent}` : "The wiki is starting";
    plateEl.replaceChildren(words);
    if (breath?.progress !== undefined && Number.isFinite(breath.progress)) {
      const bar = document.createElement("progress");
      bar.max = 1;
      bar.value = Math.min(1, Math.max(0, breath.progress));
      plateEl.appendChild(bar);
    }
  };
  renderPlate();

  // ── Down: the frame ───────────────────────────────────────────────────────────────────────────

  const apply = (frame: LarSurfaceFrame): FrameVerdict => {
    if (readLarFrame(frame) === null || typeof frame.surface !== "string" || frame.surface === "") return "malformed";
    const switching = frame.surface !== shownSurface;
    const st = stateOf(frame.surface);
    if (st.epoch !== null && st.epoch !== frame.mountEpoch) endEpochPending(frame.surface, st.epoch);
    const newEpoch = switching || st.epoch !== frame.mountEpoch;
    if (newEpoch) {
      if (st.epoch !== frame.mountEpoch) st.hintSequence = 0;
      st.epoch = frame.mountEpoch; st.revs.clear(); st.painted = false;
    }
    const fresh = frame.keys.filter((k) => {
      const held = st.revs.get(k.key);
      if (held !== undefined && k.rev < held) return false;          // a key orders only itself
      st.revs.set(k.key, k.rev);
      return true;
    });
    if (!newEpoch && fresh.length === 0) return "stale-frame";
    if (!newEpoch && frame.surface === shownSurface) resendPending(frame.surface);
    const style = fresh.find((k) => k.key === LAR_KEY_STYLE);
    if (style) st.sheet = style.tombstone ? "" : style.css ?? "";
    const membership = fresh.find((k) => k.key === LAR_KEY_MEMBERSHIP);
    if (membership) st.members = membership.tombstone ? null : membership.members ?? null;
    takeOfferKeys(st, fresh, newEpoch);         // S6: shortcuts and story order
    const surfaceKey = fresh.find((k) => k.key === LAR_KEY_SURFACE);
    if (switching && !surfaceKey) {
      // The arriving surface's mount has not painted: the shown frame stays, under the plate, until it does.
      awaited = frame.surface;
      renderPlate();
      return "held";
    }

    if (switching) {
      // Another island's frame: its render-ids name other nodes, so the old surface's nodes, the words standing
      // beside them and the popup placement measured there all end with it.
      paneEl.replaceChildren();
      dropAllRefusals();
      pendingPopupPlacement = undefined;
      restoreRenderId = null;
      modalWasPresent = false;
    }
    shownSurface = frame.surface;
    if (switching || style) sheetEl.textContent = st.sheet;
    if (!surfaceKey) { renderPlate(); return "painted"; }

    // Read where focus stands BEFORE the morph: a frame that brings a modal turns the rest inert, and an inert
    // node loses focus.
    const focusedBefore = shadow.activeElement;
    const focusedRidBefore = focusedBefore && paneEl.contains(focusedBefore) ? focusedBefore.closest("[data-lar-rid]")?.getAttribute("data-lar-rid") ?? null : null;
    if (surfaceKey.tombstone) {
      paneEl.replaceChildren();
    } else {
      painting = { st, sensed: frame.sensedRevision };
      try {
        Idiomorph.morph(paneEl, surfaceKey.html ?? "", { morphStyle: "innerHTML", callbacks: morphCallbacks });
        paintIndeterminate();
      } finally {
        painting = null;
      }
    }
    st.painted = true;
    if (awaited === frame.surface) awaited = null;
    renderPlate();                             // the plate drops in the paint that lands the mount's first key
    settleRefusals();
    paintControls(frame.sensedRevision);
    afterOfferPaint(st);                       // S6: scroll to the navigated tiddler
    if (pendingPopupPlacement) {
      const visiblePopup = [...paneEl.querySelectorAll<HTMLElement>(".tc-popup, .tc-search-drop-down")]
        .find((popup) => !popup.hidden && getComputedStyle(popup).display !== "none");
      if (visiblePopup) {
        // Popup state arrives from TW5; this page replica owns placement using the rectangle carried with the
        // click that opened it. The island never chooses a current page position.
        visiblePopup.style.position = "fixed";
        visiblePopup.style.top = `${pendingPopupPlacement.top}px`;
        visiblePopup.style.left = `${pendingPopupPlacement.left}px`;
        visiblePopup.style.right = "auto";
        visiblePopup.style.bottom = "auto";
      }
      pendingPopupPlacement = undefined;
    }
    // A MODAL IN THE FRAME TAKES FOCUS. The wiki renders its own modal dialog (`aria-modal="true"`) and marks the
    // rest of its frame `inert`; the page holds focus, so the page moves it in when a modal arrives and back to the
    // node that held it (by render-id) when the modal leaves. No rule here knows what the modal asks.
    const modal = paneEl.querySelector<HTMLElement>('[aria-modal="true"]');
    if (modal) {
      // The island marks what its own document can mark; a node it could not reach (raw markup) still reads
      // inert here. A later frame without the modal carries no mark, and the morph drops these with it.
      for (let node: Element = modal; node !== paneEl && node.parentElement; node = node.parentElement) {
        for (const sibling of node.parentElement.children) {
          if (sibling !== node && !sibling.hasAttribute("inert")) sibling.setAttribute("inert", "");
        }
      }
      if (!seenModals.has(modal)) {
        seenModals.add(modal);
        if (!modalWasPresent) restoreRenderId = focusedRidBefore;
        const focusTarget = modal.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? modal;
        focusTarget.focus();
      }
      modalWasPresent = true;
    } else {
      if (modalWasPresent) {
        const restore = restoreRenderId === null ? null : [...paneEl.querySelectorAll<HTMLElement>("[data-lar-rid]")]
          .find((node) => node.getAttribute("data-lar-rid") === restoreRenderId) ?? null;
        restore?.focus();
        restoreRenderId = null;
      }
      modalWasPresent = false;
    }
    // A selector the engine refuses names no page action; the console names each such selector once.
    const nameBadHint = (kind: string, selector: string): void => {
      if (refusedHintSelectors.has(selector)) return;
      refusedHintSelectors.add(selector);
      console.warn(`[lar] a ${kind} hint named a selector this engine refuses and the page acted on nothing: ${selector}`);
    };
    // The island names a target and a rising sequence; the page owns the physical scroll and focus.
    // Apply after the page's own route and modal placement so this hint lands on the final painted tree.
    for (const hint of paneEl.querySelectorAll<HTMLElement>("[data-lar-hint]")) {
      const sequence = Number(hint.dataset["larHint"]);
      if (!Number.isSafeInteger(sequence) || sequence <= st.hintSequence) continue;
      st.hintSequence = sequence;
      const scrollTo = hint.dataset["larScrollTo"];
      if (scrollTo) {
        try { paneEl.querySelector<HTMLElement>(scrollTo)?.scrollIntoView({ block: "nearest" }); }
        catch { nameBadHint("scroll", scrollTo); }
      }
      const focus = hint.dataset["larFocus"];
      if (focus) {
        try { paneEl.querySelector<HTMLElement>(focus)?.focus(); }
        catch { nameBadHint("focus", focus); }
      }
    }
    return "painted";
  };

  // ── Up: the control event ─────────────────────────────────────────────────────────────────────

  /** Hint selectors the console already named. */
  const refusedHintSelectors = new Set<string>();
  /** Every reliable act this page relayed and has no answer for yet, by event id. */
  const pending = new Map<string, { readonly surface: string; readonly target: string; readonly ev: LarMsg_ControlEvent; readonly mountEpoch: number; attempts: number }>();
  const PENDING_MAX = 1024;
  const RESEND_ATTEMPTS = 3;
  const endPending = (id: string, reason: LarRefusal): void => {
    const asked = pending.get(id);
    if (!asked) return;
    pending.delete(id);
    const fieldId = endFieldAct(id);
    const picker = pickers.get(id);
    if (picker) { pickers.delete(id); picker.setStatus("refused"); }
    if (asked.surface === shownSurface) paintRefusal(fieldId ?? asked.target, reason);
  };
  const endEpochPending = (surface: string, epoch: number): void => {
    for (const [id, asked] of pending) {
      if (asked.surface === surface && asked.mountEpoch === epoch) endPending(id, "stale-target");
    }
  };
  const resendPending = (surface: string): void => {
    if (!doors || surface !== shownSurface) return;
    const epoch = stateOf(surface).epoch;
    for (const [id, asked] of pending) {
      if (asked.surface !== surface || asked.mountEpoch !== epoch) continue;
      if (asked.attempts >= RESEND_ATTEMPTS) { endPending(id, "binding-unavailable"); continue; }
      asked.attempts++;
      doors.sendControlEvent(surface, asked.ev);
    }
  };
  const holdPending = (surface: string, target: string, ev: LarMsg_ControlEvent): void => {
    pending.set(ev.eventId, { surface, target, ev, mountEpoch: ev.mountEpoch, attempts: 1 });
    if (pending.size > PENDING_MAX) endPending(pending.keys().next().value!, "binding-unavailable");
  };
  // THE PAGE HOLDS ITS UNLOAD while a relayed act still waits for its result: a confirmed edit answers once its
  // document rests, and a page that leaves first would lose it. The hold rides the browser's own leave prompt and
  // reads the pending count at the moment of the leave: no timer decides. `pagehide` gives a page no way to hold.
  const holdUnload = (event: BeforeUnloadEvent): void => {
    if (pending.size === 0) return;
    event.preventDefault();
    event.returnValue = "";
  };
  const leaving = host.ownerDocument.defaultView;
  leaving?.addEventListener("beforeunload", holdUnload);
  type EventBody = Omit<LarMsg_ControlEvent, "type" | "eventId" | "cameraId" | "mountEpoch" | "seenFrameRev" | "seenMembershipRev" | "controlId" | "renderId" | "kind">;
  const relay = (target: Target, kind: LarControlKind, body: EventBody): LarMsg_ControlEvent | undefined => {
    if (!doors || shownSurface === null || !plateEl.hidden) return;    // under the plate the shown frame names no live mount
    const st = stateOf(shownSurface);
    if (st.epoch === null) return;
    if (kind !== "lar:sense") resendPending(shownSurface);
    const membershipRev = st.revs.get(LAR_KEY_MEMBERSHIP);
    const ev = mkLarControlEvent({
      eventId: mintEventId(), cameraId: LAR_CAMERA_STORY, mountEpoch: st.epoch, kind,
      seenFrameRev: st.revs.get(LAR_KEY_SURFACE) ?? 0,
      ...(membershipRev !== undefined ? { seenMembershipRev: membershipRev } : {}),
      ...(target.field === "controlId" ? { controlId: target.id } : { renderId: target.id }),
      ...body,
    });
    if (kind !== "lar:sense") holdPending(shownSurface, target.id, ev);
    doors.sendControlEvent(shownSurface, ev);
    if (kind === "lar:act") activation = { at: performance.now(), surface: shownSurface, target: target.id };
    return ev;
  };
  const origin = (event: Event): Element | null => (event.composedPath?.()[0] ?? event.target) as Element | null;

  // ── Declared cancellation: the act legs read the stamps ───────────────────────────────────────
  //
  // The island declares each binding at mount (dreamdom#/the-crossings): `data-lar-on` names the types a node
  // binds, `data-lar-cancel` what the page cancels, `data-lar-keys` the chords a keyboard binding declares,
  // `data-lar-bubble` whether the node's own handler lets the act climb on. A click or a key relays only to the
  // first node up its path whose stamp binds that type (a template's declared control stands for its own
  // bindings), and the page cancels synchronously only what the stamps on that climb declare. No stamp, no relay:
  // the browser's default stands, so an external link opens, a native toggle toggles, a file picker opens.

  /** The act target for one event type: the nearest declared control, or the nearest node whose stamp binds the type. */
  const bindingTargetOf = (from: Element | null, type: string): Target | null => {
    const catcher = from?.closest?.(".tc-eventcatcher");
    const catcherDeclares = !!catcher && paneEl.contains(catcher) && readLarStampTokens(catcher.getAttribute(LAR_STAMP_ON)).has(type);
    const selector = catcher?.getAttribute("data-lar-catcher-selector");
    const matchSelector = catcher?.getAttribute("data-lar-catcher-match-selector");
    let catcherMatches = !catcherDeclares;
    if (catcherDeclares && from) {
      try {
        const selected = selector ? from.closest(selector) : from;
        catcherMatches = (!matchSelector || from.matches(matchSelector))
          && (!selector || !!selected && selected !== catcher && catcher!.contains(selected));
      } catch { catcherMatches = false; }
    }
    if (catcherDeclares && catcherMatches) {
      const rid = from?.getAttribute("data-lar-rid");
      if (rid) return { id: rid, field: "renderId", node: from! };
    }
    for (let node = from; node && node !== paneEl; node = node.parentElement) {
      if (node === catcher && !catcherMatches) continue;
      const controlId = node.getAttribute("data-control-id");
      if (controlId) return { id: controlId, field: "controlId", node };
      const renderId = node.getAttribute("data-lar-rid");
      if (renderId && readLarStampTokens(node.getAttribute(LAR_STAMP_ON)).has(type)) return { id: renderId, field: "renderId", node };
    }
    return null;
  };
  /** An anchor whose `href` names a scheme, or that reads `rel=external` or TW5's external class: the browser opens it. */
  const isExternalLink = (from: Element | null): boolean => {
    const anchor = from?.closest?.("a");
    if (!anchor) return false;
    return /^[a-z][a-z0-9+.-]*:/i.test(anchor.getAttribute("href") ?? "")
      || readLarStampTokens(anchor.getAttribute("rel")).has("external")
      || anchor.classList.contains("tc-tiddlylink-external");
  };
  /** Whether the stamps from the target up its climb declare this act cancelled: each binding node's own rule, until
   *  one whose handler ends the climb. `ordinary` reads an unmodified primary act on a non-external target. */
  const declaresCancel = (target: Target, type: string, ordinary: boolean, chord?: string): boolean => {
    for (let node: Element | null = target.node; node && node !== paneEl; node = node.parentElement) {
      if (!readLarStampTokens(node.getAttribute(LAR_STAMP_ON)).has(type)) continue;
      const rule = readLarCancel(node.getAttribute(LAR_STAMP_CANCEL)).get(type);
      if (rule === "always") return true;
      if (rule === "ordinary" && ordinary) return true;
      if (rule === "declared" && chord !== undefined && readLarStampTokens(node.getAttribute(LAR_STAMP_KEYS)).has(chord)) return true;
      if (node.getAttribute(LAR_STAMP_BUBBLE) !== "yes") return false;
    }
    return false;
  };

  // The KEY leg. Typing rides the text leg as a whole value, so a key crosses only to a node that binds `keydown`,
  // and only when it never types (Escape, or a chord with ctrl, meta or alt) or a binding on its climb declares
  // it; the page cancels a declared chord and leaves every other key to the browser. A key an IME holds never
  // crosses: `isComposing`, `keyCode 229` on every platform, and the task after `compositionend` (Safari sends the
  // committing Enter there with `isComposing` false).
  paneEl.addEventListener("keydown", (event) => {
    const key = event as KeyboardEvent;
    if (key.isComposing || key.keyCode === 229 || holdKeysAfterComposition) return;
    if (["Control", "Meta", "Alt", "Shift"].includes(key.key)) return;
    const src = origin(key);
    const target = bindingTargetOf(src, "keydown");
    if (!target) return;
    const escape = key.key === "Escape" || key.keyCode === 27;
    if (larReservedChord(key.key, modifiersOf(key))) return;
    const chord = larKeyChordName({ keyCode: larLogicalKeyCode(key.key, key.keyCode), ctrl: key.ctrlKey, alt: key.altKey, shift: key.shiftKey, meta: key.metaKey });
    const declared = declaresCancel(target, "keydown", false, chord);
    if (!declared && !escape && !key.ctrlKey && !key.metaKey && !key.altKey) return;
    if (declared || (escape && src?.closest?.('[aria-modal="true"]'))) key.preventDefault();
    relay(target, "lar:act", {
      action: "lar:key",
      key: { key: key.key, code: key.code, keyCode: key.keyCode, repeat: key.repeat },
      modifiers: { ctrl: key.ctrlKey, meta: key.metaKey, alt: key.altKey, shift: key.shiftKey },
    });
  });

  // The CLICK leg. A click relays to the first node that binds `click`; a middle click (`auxclick`, button 1)
  // relays only to a link's ordinary binding, which reads it as "open without navigating". A modified or middle
  // click and an external link leave the browser's default standing; every other cancel reads off the stamps.
  const relayClick = (e: MouseEvent): void => {
    if (leftToToggleLeg(e.target as Element | null)) return;
    const src = origin(e);
    const target = bindingTargetOf(src, "click");
    if (!target || !doors || shownSurface === null) return;
    const middle = e.type === "auxclick";
    if (middle && (e.button !== 1 || readLarCancel(target.node.getAttribute(LAR_STAMP_CANCEL)).get("click") !== "ordinary")) return;
    const ordinary = !middle && e.button === 0 && !e.ctrlKey && !e.metaKey && !isExternalLink(src);
    if (declaresCancel(target, "click", ordinary)) e.preventDefault();
    const rect = target.node.getBoundingClientRect();
    pendingPopupPlacement = { top: rect.bottom, left: rect.left };
    const hostRect = host.getBoundingClientRect();
    relay(target, "lar:act", {
      action: "lar:click",
      modifiers: { ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, shift: e.shiftKey, button: e.button },
      geometry: {
        top: rect.top - hostRect.top, left: rect.left - hostRect.left,
        right: rect.right - hostRect.left, bottom: rect.bottom - hostRect.top,
        width: rect.width, height: rect.height,
      },
    });
  };
  paneEl.addEventListener("click", (e) => relayClick(e as MouseEvent));
  paneEl.addEventListener("auxclick", (e) => relayClick(e as MouseEvent));
  for (const type of ["dblclick", "contextmenu", "focusin", "focusout"]) {
    paneEl.addEventListener(type, (event) => {
      const src = origin(event);
      const catcher = src?.closest?.(".tc-eventcatcher");
      if (!catcher || !paneEl.contains(catcher) || !readLarStampTokens(catcher.getAttribute(LAR_STAMP_ON)).has(type)) return;
      const target = bindingTargetOf(src, type);
      if (!target || !doors || shownSurface === null) return;
      if (declaresCancel(target, type, true)) event.preventDefault();
      relay(target, "lar:act", { action: "lar:event", eventType: type,
        ...(event instanceof MouseEvent ? { modifiers: { ...modifiersOf(event), button: event.button } } : {}) });
    });
  }

  // ── The text leg ──────────────────────────────────────────────────────────────────────────────

  // The TEXT leg. TW5's edit widgets bind `input` (every keystroke) and `change` (commit on blur): `input` crosses
  // as a droppable `lar:sense`, `change` as a reliable `lar:act` / `lar:commit`. The value rides WHOLE, never as a
  // diff, with the control's own revision bumped once per relay; a value past the bound never crosses.
  const relayWholeValue = (event: Event, kind: "sense" | "commit", compositionEnd = false): void => {
    const src = origin(event);
    const target = targetOf(src);
    if (!src || !target || !doors || shownSurface === null) return;
    if (!compositionEnd && (composingFields.has(src) || (event as InputEvent).isComposing)) return;
    const value = (src as LiveControl).value;
    if (typeof value !== "string") return;       // a node with no value carries no text leg
    if (value.length > bound) {
      console.warn(`[vessel] input leg refused — ${value.length} characters exceeds the ${bound} bound; the wiki holds its last accepted value.`);
      paintRefusal(target.id, "input-too-long");
      return;
    }
    if (refusals.get(target.id)?.dataset["larReason"] === "input-too-long") dropRefusal(target.id);
    const st = stateOf(shownSurface);
    const localRev = (st.localRev.get(target.id) ?? 0) + 1;
    st.localRev.set(target.id, localRev);
    relay(target, kind === "sense" ? "lar:sense" : "lar:act", { action: kind === "sense" ? "lar:sense" : "lar:commit", wholeValue: value, localRev });
  };
  paneEl.addEventListener("input", (event) => {
    if (relayToggleFamily(event, "sense")) return;
    const src = origin(event);
    if (!src) return;
    if (composingFields.has(src) || (event as InputEvent).isComposing) return;
    const endedValue = compositionEndValue.get(src);
    if (endedValue !== undefined) {
      compositionEndValue.delete(src);
      if (endedValue === (src as LiveControl).value) return;     // a browser's trailing IME input repeats compositionend
    }
    relayWholeValue(event, "sense");
  });
  paneEl.addEventListener("change", (event) => { if (!relayToggleFamily(event, "commit")) relayWholeValue(event, "commit"); });
  paneEl.addEventListener("compositionstart", (event) => {
    const src = origin(event);
    if (src) composingFields.add(src);
  });
  paneEl.addEventListener("compositionend", (event) => {
    const src = origin(event);
    if (!src || typeof (src as LiveControl).value !== "string") return;
    composingFields.delete(src);
    compositionEndValue.set(src, (src as LiveControl).value);
    holdKeysAfterComposition = true;
    setTimeout(() => { holdKeysAfterComposition = false; }, 0);
    relayWholeValue(event, "sense", true);
  });

  // ── The toggle family: checkbox, radio, select ────────────────────────────────────────────────
  //
  // A toggle crosses as one reliable `lar:act` / `lar:toggle` carrying `checked` as of the act; a select crosses
  // its WHOLE key set (`wholeValue`, the selected options' values in document order) as a `lar:sense` on `input`
  // and a `lar:act` / `lar:choice` on `change`. Each bumps the control's `localRev`, so the sensed-revision veto
  // keeps the person's state against any frame rendered before the island took it in; the change that closes the
  // same gesture as its input (the same key set) carries the input's revision. A click on a toggle, on a select,
  // or on the label that works a toggle stays with the browser: its default IS the toggle, and the change carries it.

  const isToggleInput = (el: Element | null): el is HTMLInputElement =>
    el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio");
  const isToggleFamily = (el: Element | null): el is HTMLInputElement | HTMLSelectElement =>
    isToggleInput(el) || el instanceof HTMLSelectElement;
  const leftToToggleLeg = (el: Element | null): boolean =>
    isToggleFamily(el) || isToggleFamily(el?.closest?.("label")?.control ?? null) || el?.closest?.("select") != null;
  const keySetOf = (select: HTMLSelectElement): string[] => [...select.selectedOptions].map((o) => o.value);
  /** The key set and revision a select's `input` relayed, held for the `change` that closes the same gesture. */
  const sensedChoice = new WeakMap<Element, { readonly keys: string; readonly localRev: number }>();
  /** Relay a toggle-family event; true when the event belongs to the family (relayed or held), false otherwise. */
  const relayToggleFamily = (event: Event, kind: "sense" | "commit"): boolean => {
    const src = origin(event);
    if (!isToggleFamily(src)) return false;
    const target = targetOf(src);
    if (!target || !doors || shownSurface === null) return true;
    const st = stateOf(shownSurface);
    const bump = (): number => { const rev = (st.localRev.get(target.id) ?? 0) + 1; st.localRev.set(target.id, rev); return rev; };
    if (isToggleInput(src)) {
      if (kind === "sense") return true;       // a toggle's input repeats its change: the act alone crosses
      relay(target, "lar:act", { action: "lar:toggle", checked: src.checked, localRev: bump() });
      return true;
    }
    const keys = keySetOf(src as HTMLSelectElement);
    const held = sensedChoice.get(src);
    sensedChoice.delete(src);
    const localRev = kind === "commit" && held?.keys === JSON.stringify(keys) ? held.localRev : bump();
    if (kind === "sense") sensedChoice.set(src, { keys: JSON.stringify(keys), localRev });
    relay(target, kind === "sense" ? "lar:sense" : "lar:act", { action: kind === "sense" ? "lar:sense" : "lar:choice", wholeValue: keys, localRev });
    return true;
  };
  /** After a paint: an unheld checkbox shows the indeterminate state its frame names (`data-lar-indeterminate`). */
  const paintIndeterminate = (): void => {
    for (const box of paneEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
      if (!holdsLive(box)) box.indeterminate = box.hasAttribute("data-lar-indeterminate");
    }
  };


  // ── S6 · files, drops, order, keys and navigate ─────────────────────────────────────────────────
  //
  // The page's half of the import, drop, order, keyboard and navigation classes (dreamdom#/what-a-sink-keeps):
  //
  //   - FILES. A file input in the pane (a `$browse`, alone or inside a `lar-file-picker`) offers each picked file
  //     as one `lar:act` / `lar:import-offer`: tiddler JSON as its text, any other file as bounded bytes beside its
  //     name and type. A file past the bound never crosses and raises `input-too-long` beside the control.
  //   - DROPS. A node that declares `drop` (`data-lar-on` or `data-lar-cancel`, the island's stamps) takes the drop:
  //     the page cancels `dragenter`, `dragover` and `drop` there and relays one `lar:drop` with the whole payload
  //     (a title list, tiddler JSON, plain text, or a dropped file's bounded bytes) and the modifiers.
  //   - ORDER. A `lar-order-list` relays its whole ordered id list as `lar:order`.
  //   - KEYS. A chord a crossing set on its path declares crosses on the declared key leg; otherwise a chord the
  //     `lar:shortcuts` key names crosses on the document leg (`lar:document`), from the pane or from anywhere on
  //     the page, and the page cancels it. A composing key never crosses.
  //   - NAVIGATE. The `lar:story-order` key composes the address (`#<navigated>:<story>`); a navigation within the
  //     mount scrolls the navigated tiddler into view after the paint lands, and, with `addressBar`, pushes the
  //     address, so Back posts a `lar:route` act naming the tiddler it returns to.
  //   - A named page action (`lar-action[data-action]`, allowlisted) relays as that action on its control id.

  defineLarFilePicker();
  defineLarOrderList();
  const NAMED_ACTIONS: ReadonlySet<string> = new Set(["lar:perform-import"]);
  interface OfferPage { chords: readonly LarShortcutChord[]; story: LarStoryOrder | null; scrollTo: string | null; routed: string | null }
  const offerPages = new WeakMap<SurfaceState, OfferPage>();
  const offerPageOf = (st: SurfaceState): OfferPage => {
    let o = offerPages.get(st);
    if (!o) { o = { chords: [], story: null, scrollTo: null, routed: null }; offerPages.set(st, o); }
    return o;
  };
  const documentTarget: Target = { id: LAR_CONTROL_DOCUMENT, field: "controlId", node: paneEl };
  const modifiersOf = (e: KeyboardEvent | MouseEvent) => ({ ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, shift: e.shiftKey });
  /** The event id the last relay minted, so an answer finds the picker that asked. */
  const lastRelayed = (): string | undefined => [...pending.keys()].at(-1);
  const pickers = new Map<string, LarFilePicker>();
  const refuseBytes = (target: Target, maxBytes: number): void => {
    paintRefusal(target.id, "input-too-long");
    const out = refusals.get(target.id);
    if (out) out.textContent = bytesRefusalWords(maxBytes);
  };
  const relayOffer = (target: Target, action: "lar:import-offer" | "lar:drop", offer: FileOffer, extra: Partial<EventBody> = {}): boolean => {
    if ("refused" in offer) { refuseBytes(target, offer.maxBytes); return false; }
    if (refusals.get(target.id)?.dataset["larReason"] === "input-too-long") dropRefusal(target.id);
    relay(target, "lar:act", { action, wholeValue: offer.wholeValue, ...(offer.file ? { file: offer.file } : {}), ...extra });
    return true;
  };

  // FILES: the capture leg takes a file input's change before the text leg reads its value.
  paneEl.addEventListener("change", (event) => {
    const src = origin(event);
    if (!(src instanceof HTMLInputElement) || src.type !== "file") return;
    event.stopPropagation();
    const target = targetOf(src);
    if (!target || !doors || shownSurface === null) return;
    const picker = src.closest("lar-file-picker");
    const maxBytes = maxBytesOf(picker);
    const files = [...(src.files ?? [])];
    if (picker instanceof LarFilePicker) picker.setStatus("reading");
    void (async () => {
      for (const file of files) {
        const sent = relayOffer(target, "lar:import-offer", await readFileOffer(file, maxBytes), { controlType: "lar-file-picker" });
        if (picker instanceof LarFilePicker) {
          picker.setStatus(sent ? "offered" : "refused");
          const id = sent ? lastRelayed() : undefined;
          if (id) pickers.set(id, picker);
        }
      }
    })();
  }, { capture: true });

  // DROPS: a node takes a drop only where the island declared it.
  const declaresDrop = (node: Element): boolean =>
    ["data-lar-on", "data-lar-cancel"].some((a) => (node.getAttribute(a) ?? "").split(/\s+/).includes("drop"));
  const dropZoneOf = (from: Element | null): Element | null => {
    for (let node = from; node && node !== paneEl; node = node.parentElement) if (declaresDrop(node)) return node;
    return null;
  };
  for (const type of ["dragenter", "dragover"]) {
    paneEl.addEventListener(type, (event) => { if (dropZoneOf(origin(event))) event.preventDefault(); }, { capture: true });
  }
  paneEl.addEventListener("drop", (event) => {
    const zone = dropZoneOf(origin(event));
    if (!zone) return;
    event.preventDefault();
    const target = zone.classList.contains("tc-eventcatcher") ? bindingTargetOf(origin(event), "drop") : targetOf(zone);
    const dt = (event as DragEvent).dataTransfer;
    if (!target || !dt || !doors || shownSurface === null) return;
    const modifiers = modifiersOf(event as DragEvent);
    // A drop's data reads only while its event runs: every string now, a file's bytes after.
    const titles = dt.getData("text/x-lar-titles");
    const tiddlerJson = dt.getData("text/vnd.tiddler");
    const plain = dt.getData("text/plain");
    const file = dt.files[0];
    let list: string[] | null = null;
    try { const parsed = titles ? JSON.parse(titles) as unknown : null; list = Array.isArray(parsed) && parsed.every((t) => typeof t === "string") ? parsed : null; } catch { list = null; }
    if (list) { relay(target, "lar:act", { action: "lar:drop", wholeValue: list, modifiers }); return; }
    if (file) { void readFileOffer(file, LAR_WHOLE_BYTES_MAX).then((offer) => relayOffer(target, "lar:drop", offer, { modifiers })); return; }
    const text = tiddlerJson && readsAsTiddlers(tiddlerJson) ? tiddlerJson : plain || tiddlerJson;
    if (!text) return;
    const offer: FileOffer = text.length <= LAR_WHOLE_VALUE_MAX_CHARS ? { wholeValue: text }
      : new TextEncoder().encode(text).byteLength <= LAR_WHOLE_BYTES_MAX ? { wholeValue: new TextEncoder().encode(text), file: { name: "drop.txt", type: tiddlerJson ? "text/vnd.tiddler" : "text/plain" } }
        : { refused: "input-too-long", maxBytes: LAR_WHOLE_BYTES_MAX };
    relayOffer(target, "lar:drop", offer, { modifiers });
  }, { capture: true });

  // ORDER: the list's own event carries the whole ordered list.
  paneEl.addEventListener("lar-order", (event) => {
    const list = (event.target as Element | null)?.closest?.("lar-order-list");
    const id = list?.getAttribute("data-control-id");
    const ids = (event as CustomEvent<LarOrderDetail>).detail?.ids;
    if (!list || !id || !Array.isArray(ids)) return;
    relay({ id, field: "controlId", node: list }, "lar:act", { action: "lar:order", controlType: "lar-order-list", wholeValue: [...ids] });
  });

  // A named page action: an allowlisted `data-action` on its control id; any other name relays nothing here.
  paneEl.addEventListener("click", (event) => {
    const control = (event.target as Element | null)?.closest?.("lar-action[data-action][data-control-id]");
    if (!control || !paneEl.contains(control)) return;
    const action = control.getAttribute("data-action") ?? "";
    if (!NAMED_ACTIONS.has(action)) return;
    event.preventDefault();
    event.stopPropagation();
    relay({ id: control.getAttribute("data-control-id")!, field: "controlId", node: control }, "lar:act", { action });
  }, { capture: true });

  // KEYS: a declared chord crosses to its target; a shortcut chord crosses on the document leg.
  const chordBody = (key: KeyboardEvent): EventBody => ({
    action: "lar:key", key: { key: key.key, code: key.code, keyCode: key.keyCode, repeat: key.repeat }, modifiers: modifiersOf(key),
  });
  const keyHeld = (key: KeyboardEvent): boolean =>
    key.isComposing || key.keyCode === 229 || holdKeysAfterComposition || ["Control", "Meta", "Alt", "Shift"].includes(key.key)
    || larReservedChord(key.key, modifiersOf(key));
  const crossedKeys = new WeakSet<Event>();
  const relayDocumentChord = (key: KeyboardEvent): boolean => {
    if (shownSurface === null || !matchChord(key, offerPageOf(stateOf(shownSurface)).chords)) return false;
    key.preventDefault();
    crossedKeys.add(key);
    relay(documentTarget, "lar:act", chordBody(key));
    return true;
  };
  // A chord a crossing set on the key's path declares (`data-lar-keys`, chords named by `larKeyChordName`) belongs to
  // the declared key leg above; only a chord no binding on the path declares reaches the document leg.
  paneEl.addEventListener("keydown", (event) => {
    const key = event as KeyboardEvent;
    if (keyHeld(key) || crossedKeys.has(key)) return;
    const chord = larKeyChordName({ keyCode: larLogicalKeyCode(key.key, key.keyCode), ctrl: key.ctrlKey, alt: key.altKey, shift: key.shiftKey, meta: key.metaKey });
    for (let node: Element | null = origin(key); node && node !== paneEl; node = node.parentElement) {
      if (readLarStampTokens(node.getAttribute(LAR_STAMP_KEYS)).has(chord)) return;
    }
    if (relayDocumentChord(key)) key.stopPropagation();
  }, { capture: true });
  // The document leg: a shortcut pressed anywhere on the page, outside the pane too.
  document.addEventListener("keydown", (event) => {
    const key = event as KeyboardEvent;
    if (keyHeld(key) || crossedKeys.has(key) || !plateEl.hidden) return;
    relayDocumentChord(key);
  });

  // NAVIGATE: the story order composes the address; a navigation scrolls after the paint.
  const stringifyList = (titles: readonly string[]): string =>
    titles.map((t) => (/[\s\]]/.test(t) || t === "" ? `[[${t}]]` : t)).join(" ");
  const routeOf = (st: SurfaceState): string | null => {
    const story = offerPageOf(st).story;
    if (!story) return null;
    return `#${encodeURIComponent(story.tail ?? story.order[0] ?? "")}:${encodeURIComponent(stringifyList(story.order))}`;
  };
  const takeOfferKeys = (st: SurfaceState, fresh: readonly LarFrameKey[], newEpoch: boolean): void => {
    const o = offerPageOf(st);
    const shortcuts = fresh.find((k) => k.key === LAR_KEY_SHORTCUTS);
    if (shortcuts) o.chords = shortcuts.chords ?? [];
    const key = fresh.find((k) => k.key === LAR_KEY_STORY_ORDER);
    if (!key?.story) return;
    const before = o.story;
    o.story = key.story;
    const navigated = !newEpoch && before !== null && key.story.tail !== null && (key.story.depth > before.depth || key.story.tail !== before.tail);
    if (navigated) o.scrollTo = key.story.tail;
    if (opts.addressBar) {
      const address = routeOf(st)!;
      const returning = o.routed !== null && o.routed === key.story.tail;
      if (location.hash !== address) {
        if (navigated && !returning) history.pushState({ lar: true }, "", address);
        else history.replaceState({ lar: true }, "", address);
      }
      if (returning) o.routed = null;
    }
  };
  const afterOfferPaint = (st: SurfaceState): void => {
    const o = offerPageOf(st);
    const title = o.scrollTo;
    o.scrollTo = null;
    if (title === null) return;
    const frame = paneEl.querySelector<HTMLElement>(`[data-tiddler-title="${CSS.escape(title)}"]`);
    if (!frame) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    frame.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
  };
  if (opts.addressBar) {
    window.addEventListener("popstate", () => {
      if (shownSurface === null) return;
      const tail = decodeURIComponent(location.hash.slice(1).split(":")[0] ?? "");
      if (!tail) return;
      offerPageOf(stateOf(shownSurface)).routed = tail;
      relay(documentTarget, "lar:act", { action: "lar:route", wholeValue: tail });
    });
  }
  /** An answer to a file offer settles its picker's status. */
  const settleOffer = (result: LarMsg_ControlResult): void => {
    const picker = pickers.get(result.eventId);
    if (!picker) return;
    pickers.delete(result.eventId);
    picker.setStatus(result.status === "applied" ? "applied" : "refused");
  };
  // ── The page controls: lar-field, lar-popover, lar-disclosure ─────────────────────────────────
  //
  // page-controls#/the-control-set, the three ruled first. Each binds where the frame names it:
  //   - `lar-field`: a field carrying a value descriptor (`data-lar-value`, `data-lar-value-rev`) keeps the
  //     person's text against a disagreeing descriptor and offers it beside the field (take theirs, one undoable
  //     edit, relayed `lar:take-theirs`); a clean or agreeing field takes the descriptor. A click on a node stamped
  //     `lar-field-operation` crosses as ONE `lar:act` / `lar:edit-operation` carrying the last field's whole value,
  //     its selection and its revision as of the act, and reserves that revision + 1 for the answer: the `want` lands
  //     as one undoable edit only while the field's revision still reads the reserved one, and an answer that brings
  //     no want hands the reservation back. Its words stand beside the field.
  //   - `lar-popover`: an open first-level popover anchors from the control the person activated; Escape closes it
  //     at once, returns focus there and relays `lar:dismiss`.
  //   - `lar-disclosure`: a details the person toggled keeps its open state while its revision runs ahead.

  defineLarField();
  defineLarPopover();
  defineLarDisclosure();
  /** The text field the person last stood in, and the control they last activated. */
  let lastField: LarFieldNode | null = null;
  let lastActivated: HTMLElement | null = null;
  /** Each toolbar act in flight, by event id: its field, the revision it carried and the one it reserved. */
  const fieldActs = new Map<string, { readonly surface: string; readonly id: string; readonly node: LarFieldNode; readonly carried: number; readonly reserved: number }>();
  const endFieldAct = (eventId: string): string | undefined => {
    const act = fieldActs.get(eventId);
    if (!act) return undefined;
    fieldActs.delete(eventId);
    const st = stateOf(act.surface);
    if (st.localRev.get(act.id) === act.reserved) st.localRev.set(act.id, act.carried);
    return act.id;
  };
  /** A node's own control id or render id, never an ancestor's. */
  const ownId = (el: Element): string | null => el.getAttribute("data-control-id") ?? el.getAttribute("data-lar-rid");

  const reconcileDescriptor = (oldNode: Node, newNode: Node): void => {
    if (!isLarFieldNode(oldNode) || !isLarFieldNode(newNode)) return;
    const value = newNode.getAttribute("data-lar-value");
    if (value === null) return;
    const keep = reconcileFieldDescriptor(oldNode, value, Number(newNode.getAttribute("data-lar-value-rev") ?? 0));
    // The arriving node carries the value the field keeps, so the morph writes nothing the person typed away.
    if (newNode instanceof HTMLTextAreaElement) newNode.textContent = keep;
    else newNode.setAttribute("value", keep);
    newNode.value = keep;
  };
  const paintControls = (sensed: Readonly<Record<string, number>>): void => {
    paintPopovers(paneEl, lastActivated);
    notePaintedDisclosures(paneEl, (d) => holdsDisclosure(d, sensed[ownId(d) ?? ""]));
  };
  const settleFieldAct = (result: LarMsg_ControlResult): { readonly id: string } | undefined => {
    const act = fieldActs.get(result.eventId);
    if (!act || shownSurface === null) return undefined;
    fieldActs.delete(result.eventId);
    const st = stateOf(act.surface);
    const rev = st.localRev.get(act.id);
    if (result.status === "applied" && result.want && rev === act.reserved && paneEl.contains(act.node)) {
      applyWholeValue(act.node, result.want.value, result.want.selStart, result.want.selEnd);
    } else if (rev === act.reserved && !(result.status === "applied" && result.want)) {
      st.localRev.set(act.id, act.carried);
    }
    return act;
  };

  paneEl.addEventListener("focusin", (event) => { const src = origin(event); if (isLarFieldNode(src)) lastField = src; });
  paneEl.addEventListener("input", (event) => {
    const src = origin(event);
    if (src && isApplyingField(src)) { event.stopPropagation(); return; }    // the page's own write, never the person's
    if (src) markFieldEdited(src);
  }, true);
  paneEl.addEventListener("click", (event) => {
    const src = origin(event);
    const op = src?.closest?.<HTMLElement>('[data-lar-control="lar-field-operation"]') ?? null;
    if (!op) {
      const activated = src?.closest?.<HTMLElement>("[data-lar-rid], [data-control-id], button, a") ?? null;
      if (activated && paneEl.contains(activated)) lastActivated = activated;
      return;
    }
    // The toolbar act carries the field's pair; the click leg relays nothing beside it.
    event.stopPropagation();
    const target = targetOf(op);
    if (!target || shownSurface === null) return;
    const field = lastField && paneEl.contains(lastField) ? lastField : null;
    const fieldTarget = field ? targetOf(field) : null;
    if (!field || !fieldTarget) { paintRefusal(target.id, "selection-unavailable"); return; }
    if (field.value.length > bound) { paintRefusal(fieldTarget.id, "input-too-long"); return; }
    const st = stateOf(shownSurface);
    const carried = st.localRev.get(fieldTarget.id) ?? 0;
    st.localRev.set(fieldTarget.id, carried + 1);
    const ev = relay(target, "lar:act", {
      action: "lar:edit-operation", controlType: "lar-field-operation", fieldId: fieldTarget.id, wholeValue: field.value,
      selection: { start: field.selectionStart ?? 0, end: field.selectionEnd ?? 0 }, localRev: carried,
    });
    if (!ev) { st.localRev.set(fieldTarget.id, carried); return; }
    fieldActs.set(ev.eventId, { surface: shownSurface, id: fieldTarget.id, node: field, carried, reserved: carried + 1 });
    if (fieldActs.size > PENDING_MAX) fieldActs.delete(fieldActs.keys().next().value!);
  }, true);
  paneEl.addEventListener(LAR_FIELD_TAKE_THEIRS, (event) => {
    const host = origin(event);
    const field = host ? [...host.children].find(isLarFieldNode) : undefined;
    const target = field ? targetOf(field) : null;
    if (target) relay(target, "lar:act", { action: "lar:take-theirs", controlType: "lar-field" });
  });
  paneEl.addEventListener("keydown", (event) => {
    const key = event as KeyboardEvent;
    if (key.isComposing || key.keyCode === 229 || (key.key !== "Escape" && key.keyCode !== 27)) return;
    const closed = dismissPopover(paneEl);
    if (!closed) return;
    // The page closed the popover; the island hears one dismissal, never an Escape key beside it.
    event.stopPropagation();
    const target = closed.anchor ? targetOf(closed.anchor) : null;
    if (target) relay(target, "lar:act", { action: "lar:dismiss", controlType: "lar-popover" });
  }, true);
  paneEl.addEventListener("toggle", (event) => {
    const src = origin(event);
    if (src instanceof HTMLDetailsElement) takeDisclosureToggle(src);
  }, true);

  // ── The answer rail ───────────────────────────────────────────────────────────────────────────

  const applyResult = (result: LarMsg_ControlResult): ResultVerdict => {
    if (readLarControlResult(result) === null) return "ignored";
    settleOffer(result);                                           // S6: a file picker's status
    const asked = pending.get(result.eventId);
    if (!asked) return "ignored";                                  // an answer to nothing this page relayed
    if (asked.surface !== shownSurface) { pending.delete(result.eventId); endFieldAct(result.eventId); return "ignored"; }
    if (result.mountEpoch !== asked.mountEpoch || result.mountEpoch !== stateOf(asked.surface).epoch) return "ignored";
    pending.delete(result.eventId);
    const refusalBeside = settleFieldAct(result)?.id ?? asked.target;  // a toolbar act's words stand beside its field
    if (result.status === "applied") { dropRefusal(refusalBeside); return "cleared"; }
    const reason: LarRefusal = result.status === "stale-target" ? "stale-target" : result.reason ?? "binding-unavailable";
    if (reason === "unclaimed") return "ignored";                  // the browser's default stood; no words owed
    paintRefusal(refusalBeside, reason);
    return "painted";
  };

  // ── Host doors ────────────────────────────────────────────────────────────────────────────────

  /** How long a person's act stands fresh for a door: the browser's own transient activation window. */
  const ACTIVATION_MS = 5_000;
  /** The person's last relayed act, until a door spends it. */
  let activation: { readonly at: number; readonly surface: string; readonly target: string } | null = null;
  const manifestKinds: readonly LarServiceKind[] = opts.services ?? LAR_SURFACE_DEFAULT_SERVICES;
  const carried = new Set<LarServiceKind>(manifestKinds);
  const pageDoors: Partial<Record<LarServiceKind, LarHostDoor>> = {
    clipboard: async (args) => { await navigator.clipboard.writeText(String(args["text"] ?? "")); },
    download: (args) => {
      const url = URL.createObjectURL(new Blob([String(args["text"] ?? "")], { type: String(args["type"] ?? "text/plain") }));
      const a = document.createElement("a");
      a.href = url;
      a.download = String(args["filename"] ?? "download.txt");
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    },
    print: () => { window.print(); },
    fullscreen: async (args, at) => {
      const mode = String(args["mode"] ?? "toggle");
      if (mode === "exit" || (mode === "toggle" && document.fullscreenElement)) await document.exitFullscreen();
      else await at.requestFullscreen();
    },
    "open-external": (args) => {
      if (!window.open(String(args["url"] ?? ""), String(args["windowName"] ?? "_blank"), "noopener,noreferrer")) throw new Error("the browser opened no window");
    },
  };
  const doorFor = (kind: LarServiceKind): LarHostDoor | undefined => opts.doors?.[kind] ?? pageDoors[kind];
  const activeAct = (surface: string): boolean =>
    (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation?.isActive === true
    || (activation !== null && activation.surface === surface && performance.now() - activation.at <= ACTIVATION_MS);
  /** Answer one ask on the document leg of the surface that asked, under the epoch the page holds for it. */
  const answerService = (ask: LarSurfaceService, status: "ok" | LarRefusal): void => {
    const st = stateOf(ask.surface);
    if (!doors || st.epoch === null) return;
    if (ask.surface === shownSurface) resendPending(ask.surface);
    const ev = mkLarControlEvent({
      eventId: mintEventId(), cameraId: LAR_CAMERA_STORY, mountEpoch: st.epoch, kind: "lar:service-result",
      controlId: "lar:document", action: "lar:service-result", seenFrameRev: st.revs.get(LAR_KEY_SURFACE) ?? 0,
      requestId: ask.requestId, status,
    });
    holdPending(ask.surface, "lar:document", ev);
    doors.sendControlEvent(ask.surface, ev);
  };
  const applyService = async (ask: LarSurfaceService): Promise<ServiceVerdict> => {
    if (readLarService(ask) === null || typeof ask.surface !== "string" || ask.surface === "") return "malformed";
    const act = activation;
    const refuse = (reason: LarRefusal): ServiceVerdict => {
      answerService(ask, reason);
      if (act && act.surface === ask.surface && ask.surface === shownSurface) paintRefusal(act.target, reason);
      return "refused";
    };
    if (ask.surface !== shownSurface) return refuse("stale-target");
    if (!activeAct(ask.surface)) return refuse("activation-required");
    activation = null;                                             // one act opens one door
    if (!carried.has(ask.kind)) return refuse("page-action-unavailable");
    const door = doorFor(ask.kind);
    if (!door) return refuse("page-action-unavailable");
    try {
      await door(ask.args, host);
    } catch (error) {
      console.warn(`[vessel] ${ask.kind} door refused: ${error instanceof Error ? error.message : String(error)}`);
      return refuse("page-action-unavailable");
    }
    answerService(ask, "ok");
    return "opened";
  };

  return {
    apply,
    applyResult,
    applyService,
    pendingActs: () => pending.size,
    dispose: () => { leaving?.removeEventListener("beforeunload", holdUnload); },
    manifest: () => ({ services: [...manifestKinds] }),
    setBreath: (surface, breath) => { stateOf(surface).breath = breath; renderPlate(); },
    awaitSurface: (surface) => { awaited = surface === shownSurface ? null : surface; renderPlate(); },
    arm: (d) => { const rearming = doors !== null; doors = d; if (rearming && shownSurface !== null) resendPending(shownSurface); },
    surface: () => shownSurface,
    members: () => (shownSurface === null ? null : stateOf(shownSurface).members),
    route: () => (shownSurface === null ? null : routeOf(stateOf(shownSurface))),
  };
}
