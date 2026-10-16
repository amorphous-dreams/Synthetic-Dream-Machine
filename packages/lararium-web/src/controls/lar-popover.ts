/**
 * lar-popover — the page's popover control (page-controls#/the-control-set, ruled first).
 *
 * The wiki keeps a popup's state as open or closed; the page owns where it stands, its dismissal and focus:
 *
 *   - A panel the frame stamps `data-lar-control="lar-popover"` (TW5's `$reveal type="popup"`, read off the
 *     island's control table) anchors from its OWN anchor's box: the control the person activated to open it,
 *     measured live after each paint, never a position the island chose. Only a first-level popover anchors; a
 *     popover nested in another stays in the flow of its parent.
 *   - Escape closes the open first-level popover at once, returns focus to its anchor, and asks the island to
 *     close the popup state (`lar:dismiss`), so the next frame agrees.
 *   - A template-named `<lar-popover>` over a native `[popover]` panel takes the browser's top layer and
 *     dismissal; the element anchors the panel from its invoker's box as it opens.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/page-controls#/the-control-set
 */

export const LAR_POPOVER_TAG = "lar-popover";
export const LAR_POPOVER_SELECTOR = '[data-lar-control="lar-popover"]';

/** Each stamped popover's anchor, so focus returns where the person stood. */
const anchors = new WeakMap<Element, HTMLElement>();

const shown = (el: HTMLElement): boolean => !el.hidden && !el.hasAttribute("hidden") && getComputedStyle(el).display !== "none";

/** The open first-level popovers under `root`, in document order. */
export function openPopovers(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(LAR_POPOVER_SELECTOR)]
    .filter((p) => shown(p) && !p.parentElement?.closest(LAR_POPOVER_SELECTOR));
}

/** Place a panel just below its anchor's box, in the viewport's frame. */
function placeFrom(panel: HTMLElement, anchor: Element): void {
  const box = anchor.getBoundingClientRect();
  panel.style.position = "fixed";
  panel.style.top = `${box.bottom}px`;
  panel.style.left = `${box.left}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}

/**
 * After a paint: anchor every open first-level popover from the anchor the person last activated (a popover that
 * opened earlier keeps its own anchor while that anchor stands in the pane).
 */
export function paintPopovers(pane: HTMLElement, lastActivated: HTMLElement | null): void {
  for (const panel of openPopovers(pane)) {
    let anchor = anchors.get(panel);
    if (!anchor || !pane.contains(anchor)) {
      if (!lastActivated || !pane.contains(lastActivated) || panel.contains(lastActivated)) continue;
      anchor = lastActivated;
      anchors.set(panel, anchor);
    }
    placeFrom(panel, anchor);
  }
}

/**
 * Escape over an open popover: close the newest at once, return focus to its anchor and hand the anchor back
 * (null where none stood); null outright when no popover stands open.
 */
export function dismissPopover(pane: HTMLElement): { readonly anchor: HTMLElement | null } | null {
  const panel = openPopovers(pane).at(-1);
  if (!panel) return null;
  panel.hidden = true;
  const anchor = anchors.get(panel) ?? null;
  anchors.delete(panel);
  anchor?.focus();
  return { anchor };
}

/** A template-named `<lar-popover>`: the native panel opens in the top layer, anchored from its invoker. */
export class LarPopoverElement extends HTMLElement {
  connectedCallback(): void {
    this.addEventListener("toggle", (event) => {
      const panel = event.target as HTMLElement;
      if (!(event instanceof ToggleEvent) || event.newState !== "open" || !panel.hasAttribute("popover")) return;
      const invoker = this.querySelector(`[popovertarget="${CSS.escape(panel.id)}"]`);
      if (invoker) placeFrom(panel, invoker);
    }, true);
  }
}

export function defineLarPopover(): void {
  if (!customElements.get(LAR_POPOVER_TAG)) customElements.define(LAR_POPOVER_TAG, LarPopoverElement);
}
