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
  larKeyChordName, mkLarControlEvent, readLarCancel, readLarControlResult, readLarFrame, readLarService, readLarStampTokens,
  type LarControlKind, type LarMsg_ControlEvent, type LarMsg_ControlResult, type LarMsg_Frame, type LarMsg_Service, type LarRefusal,
  type LarServiceKind, type LarSurfaceManifest,
} from "@lararium/mesh/lar-camera";

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
  /** Take an island's host-door ask: open it under a fresh act and the manifest, or refuse it by name; either
   *  way answer `lar:service-result` on the return leg. */
  applyService(ask: LarSurfaceService): Promise<ServiceVerdict>;
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
    if (!st) { st = { epoch: null, revs: new Map(), sheet: "", members: null, localRev: new Map(), painted: false, breath: null }; surfaces.set(surface, st); }
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
    beforeNodeMorphed: (oldNode: Node): boolean => !(oldNode instanceof Element && holdsLive(oldNode)),
    beforeAttributeUpdated: (name: string, element: Element): boolean => {
      if (name === "aria-describedby" && describedBy.has(element)) return false;
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
    const newEpoch = switching || st.epoch !== frame.mountEpoch;
    if (newEpoch) { st.epoch = frame.mountEpoch; st.revs.clear(); st.painted = false; }
    const fresh = frame.keys.filter((k) => {
      const held = st.revs.get(k.key);
      if (held !== undefined && k.rev < held) return false;          // a key orders only itself
      st.revs.set(k.key, k.rev);
      return true;
    });
    if (!newEpoch && fresh.length === 0) return "stale-frame";
    const style = fresh.find((k) => k.key === LAR_KEY_STYLE);
    if (style) st.sheet = style.tombstone ? "" : style.css ?? "";
    const membership = fresh.find((k) => k.key === LAR_KEY_MEMBERSHIP);
    if (membership) st.members = membership.tombstone ? null : membership.members ?? null;
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
    return "painted";
  };

  // ── Up: the control event ─────────────────────────────────────────────────────────────────────

  /** Every reliable act this page relayed and has no answer for yet, by event id. */
  const pending = new Map<string, { readonly surface: string; readonly target: string }>();
  const PENDING_MAX = 1024;
  type EventBody = Omit<LarMsg_ControlEvent, "type" | "eventId" | "cameraId" | "mountEpoch" | "seenFrameRev" | "seenMembershipRev" | "controlId" | "renderId" | "kind">;
  const relay = (target: Target, kind: LarControlKind, body: EventBody): void => {
    if (!doors || shownSurface === null || !plateEl.hidden) return;    // under the plate the shown frame names no live mount
    const st = stateOf(shownSurface);
    if (st.epoch === null) return;
    const membershipRev = st.revs.get(LAR_KEY_MEMBERSHIP);
    const ev = mkLarControlEvent({
      eventId: mintEventId(), cameraId: LAR_CAMERA_STORY, mountEpoch: st.epoch, kind,
      seenFrameRev: st.revs.get(LAR_KEY_SURFACE) ?? 0,
      ...(membershipRev !== undefined ? { seenMembershipRev: membershipRev } : {}),
      ...(target.field === "controlId" ? { controlId: target.id } : { renderId: target.id }),
      ...body,
    });
    if (kind !== "lar:sense") {
      pending.set(ev.eventId, { surface: shownSurface, target: target.id });
      if (pending.size > PENDING_MAX) pending.delete(pending.keys().next().value!);
    }
    doors.sendControlEvent(shownSurface, ev);
    if (kind === "lar:act") activation = { at: performance.now(), surface: shownSurface, target: target.id };
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
    for (let node = from; node && node !== paneEl; node = node.parentElement) {
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
    const chord = larKeyChordName({ keyCode: key.keyCode, ctrl: key.ctrlKey, alt: key.altKey, shift: key.shiftKey, meta: key.metaKey });
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

  // ── The answer rail ───────────────────────────────────────────────────────────────────────────

  const applyResult = (result: LarMsg_ControlResult): ResultVerdict => {
    if (readLarControlResult(result) === null) return "ignored";
    const asked = pending.get(result.eventId);
    if (!asked) return "ignored";                                  // an answer to nothing this page relayed
    if (asked.surface !== shownSurface) { pending.delete(result.eventId); return "ignored"; }
    if (result.mountEpoch !== stateOf(asked.surface).epoch) return "ignored";
    pending.delete(result.eventId);
    if (result.status === "applied") { dropRefusal(asked.target); return "cleared"; }
    const reason: LarRefusal = result.status === "stale-target" ? "stale-target" : result.reason ?? "binding-unavailable";
    if (reason === "unclaimed") return "ignored";                  // the browser's default stood; no words owed
    paintRefusal(asked.target, reason);
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
    const ev = mkLarControlEvent({
      eventId: mintEventId(), cameraId: LAR_CAMERA_STORY, mountEpoch: st.epoch, kind: "lar:service-result",
      controlId: "lar:document", action: "lar:service-result", seenFrameRev: st.revs.get(LAR_KEY_SURFACE) ?? 0,
      requestId: ask.requestId, status,
    });
    pending.set(ev.eventId, { surface: ask.surface, target: "lar:document" });
    if (pending.size > PENDING_MAX) pending.delete(pending.keys().next().value!);
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
    manifest: () => ({ services: [...manifestKinds] }),
    setBreath: (surface, breath) => { stateOf(surface).breath = breath; renderPlate(); },
    awaitSurface: (surface) => { awaited = surface === shownSurface ? null : surface; renderPlate(); },
    arm: (d) => { doors = d; },
    surface: () => shownSurface,
    members: () => (shownSurface === null ? null : stateOf(shownSurface).members),
  };
}
