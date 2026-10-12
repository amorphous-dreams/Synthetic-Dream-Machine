/**
 * projection-sink — the page's replica of the surface a vessel island renders.
 *
 * The island renders; the page holds values, selection, focus and geometry. A frame carries a surface's whole
 * HTML and CSS, that surface's own revision, and the surface's name. The sink paints it into an isolated
 * shadow root, MORPHED in place (idiomorph) so focus, caret and scroll survive a re-projection, and relays
 * the person's acts back by render-id (the interactivity RETURN leg): TW5's own handler fires in the island
 * and re-projects, and the widget tree never learns an event crossed a thread.
 *
 * Three laws this module keeps:
 *   - REVISIONS BELONG TO A SURFACE. Each island counts its own, so the sink orders frames only within one
 *     continuous showing of one surface. A switch paints the arriving surface's first frame whatever its
 *     number; a lower revision of the surface already shown drops as stale.
 *   - AN EVENT NAMES ITS SOURCE. Every relayed event carries the surface whose frame painted its target, read
 *     at the moment of the act, so the vessel routes it to that island and never to whichever stands active.
 *   - NOTHING LEAKS ACROSS A SWITCH. Islands share no render-id space: a field's local value, a pending popup
 *     placement and the painted nodes of one surface never carry into another's frame.
 */
import { Idiomorph } from "idiomorph";

export interface ProjectionFrame {
  readonly html: string;
  readonly css:  string;
  readonly rev:  number;
  readonly surface: string;
}

/** The vessel's return leg, as the sink speaks it. */
export interface ProjectionReturnDoors {
  sendDomEvent(surface: string, renderId: string, eventType: string, fields: Record<string, number | boolean>): unknown;
  sendDomInput(surface: string, renderId: string, eventType: string, value: string): unknown;
}

export interface ProjectionSink {
  /** Paint a frame, or drop it as a stale revision of the surface already shown. */
  apply(frame: ProjectionFrame): "painted" | "stale-frame";
  /** Arm the return leg; before this the pane paints and relays nothing. */
  arm(doors: ProjectionReturnDoors): void;
  /** The surface whose frame the pane shows now, or null before the first frame. */
  surface(): string | null;
}

type TextField = HTMLInputElement | HTMLTextAreaElement;

export function createProjectionSink(host: HTMLElement, opts: { readonly inputMaxChars: number }): ProjectionSink {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  const style = shadow.querySelector("style") ?? shadow.appendChild(document.createElement("style"));
  let pane = shadow.querySelector<HTMLElement>(".lar-projection");
  if (!pane) { pane = document.createElement("div"); pane.className = "lar-projection"; shadow.appendChild(pane); }
  const paneEl = pane;

  let shownSurface: string | null = null;
  let shownRev = 0;
  let doors: ProjectionReturnDoors | null = null;
  const compositionEndValue = new WeakMap<Element, string>();
  const composingFields = new WeakSet<Element>();
  let pendingPopupPlacement: { readonly top: number; readonly left: number } | undefined;

  const apply = (frame: ProjectionFrame): "painted" | "stale-frame" => {
    const sameSurface = frame.surface === shownSurface;
    if (sameSurface && frame.rev < shownRev) return "stale-frame";   // coalesce ordering, within one surface
    style.textContent = frame.css;
    const protectedValues = new Map<string, { value: string; selectionStart: number | null; selectionEnd: number | null }>();
    if (sameSurface) {
      for (const field of paneEl.querySelectorAll<TextField>("input[data-lar-rid], textarea[data-lar-rid]")) {
        if (shadow.activeElement === field || composingFields.has(field)) {
          protectedValues.set(field.getAttribute("data-lar-rid")!, {
            value: field.value,
            selectionStart: field.selectionStart,
            selectionEnd: field.selectionEnd,
          });
        }
      }
    } else {
      // Another island's frame: its render-ids name other nodes, so the old surface's nodes, the field values
      // a person typed there and the popup placement measured there all end with it.
      paneEl.replaceChildren();
      pendingPopupPlacement = undefined;
    }
    shownSurface = frame.surface;
    shownRev = frame.rev;
    // Morph (not innerHTML=) — id-set matching keeps unchanged nodes in place; the in-progress value
    // is preserved (ignoreActiveValue). The render-id attributes ride the HTML untouched.
    Idiomorph.morph(paneEl, frame.html, { morphStyle: "innerHTML", ignoreActiveValue: true });
    for (const [renderId, saved] of protectedValues) {
      const field = paneEl.querySelector<TextField>(`[data-lar-rid="${CSS.escape(renderId)}"]`);
      if (!field) continue;
      field.value = saved.value;
      if (saved.selectionStart !== null && saved.selectionEnd !== null) {
        field.setSelectionRange(saved.selectionStart, saved.selectionEnd);
      }
    }
    if (pendingPopupPlacement) {
      const visiblePopup = [...paneEl.querySelectorAll<HTMLElement>(".tc-popup, .tc-search-drop-down")]
        .find((popup) => !popup.hidden && getComputedStyle(popup).display !== "none");
      if (visiblePopup) {
        // Popup state arrives from TW5; this page replica owns placement using the rectangle carried
        // with the click that opened it. The worker never chooses a current page position.
        visiblePopup.style.position = "fixed";
        visiblePopup.style.top = `${pendingPopupPlacement.top}px`;
        visiblePopup.style.left = `${pendingPopupPlacement.left}px`;
        visiblePopup.style.right = "auto";
        visiblePopup.style.bottom = "auto";
      }
      pendingPopupPlacement = undefined;
    }
    return "painted";
  };

  paneEl.addEventListener("click", (e) => {
    const el = (e.target as Element)?.closest?.("[data-lar-rid]");
    if (!el || !doors || shownSurface === null) return;
    e.preventDefault();                        // a projected <a href> must not navigate the host page
    const me = e as MouseEvent;
    const rect = el.getBoundingClientRect();
    pendingPopupPlacement = { top: rect.bottom, left: rect.left };
    const projectionRect = host.getBoundingClientRect();
    doors.sendDomEvent(shownSurface, el.getAttribute("data-lar-rid")!, "click", {
      metaKey: me.metaKey, ctrlKey: me.ctrlKey, altKey: me.altKey, shiftKey: me.shiftKey, button: me.button,
      rectTop: rect.top - projectionRect.top, rectLeft: rect.left - projectionRect.left,
      rectRight: rect.right - projectionRect.left, rectBottom: rect.bottom - projectionRect.top,
      rectWidth: rect.width, rectHeight: rect.height,
    });
  });
  // The TEXT leg. TW5's edit widgets bind `input` (every keystroke) and `change` (commit on blur), so
  // the pane relays exactly those two, rid-stamped by the same `closest("[data-lar-rid]")` walk the
  // click leg makes — the listener allowlist stays two names long and states them here.
  //
  // The value rides WHOLE, never as a diff: the worker holds no keystroke history, and a whole value is
  // idempotent under the coalesced re-projection (a dropped frame cannot desynchronize the field). The
  // event bubbles out of the composed shadow tree, so `composedPath` names the real origin.
  const relayWholeValue = (event: Event, kind: "input" | "change", compositionEnd = false): void => {
    const src = (event.composedPath?.()[0] ?? event.target) as Element | null;
    const el = src?.closest?.("[data-lar-rid]");
    if (!src || !el || !doors || shownSurface === null) return;
    if (!compositionEnd && (composingFields.has(src) || (event as InputEvent).isComposing)) return;
    const value = (src as TextField).value;
    if (typeof value !== "string") return;       // a non-text control carries no input leg
    if (value.length > opts.inputMaxChars) {
      console.warn(`[vessel] input leg refused — ${value.length} characters exceeds the ${opts.inputMaxChars} bound; the wiki holds its last accepted value.`);
      return;
    }
    doors.sendDomInput(shownSurface, el.getAttribute("data-lar-rid")!, kind, value);
  };
  paneEl.addEventListener("input", (event) => {
    const src = (event.composedPath?.()[0] ?? event.target) as TextField | null;
    if (!src) return;
    if (composingFields.has(src) || (event as InputEvent).isComposing) return;
    const endedValue = compositionEndValue.get(src);
    if (endedValue !== undefined) {
      compositionEndValue.delete(src);
      if (endedValue === src.value) return;       // a browser's trailing IME input repeats compositionend
    }
    relayWholeValue(event, "input");
  });
  paneEl.addEventListener("change", (event) => relayWholeValue(event, "change"));
  paneEl.addEventListener("compositionstart", (event) => {
    const src = (event.composedPath?.()[0] ?? event.target) as Element | null;
    if (src) composingFields.add(src);
  });
  paneEl.addEventListener("compositionend", (event) => {
    const src = (event.composedPath?.()[0] ?? event.target) as TextField | null;
    if (!src || typeof src.value !== "string") return;
    composingFields.delete(src);
    compositionEndValue.set(src, src.value);
    relayWholeValue(event, "input", true);
  });

  return { apply, arm: (d) => { doors = d; }, surface: () => shownSurface };
}
