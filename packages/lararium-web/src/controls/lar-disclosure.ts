/**
 * lar-disclosure — the page's disclosure control (page-controls#/the-control-set, ruled first).
 *
 * A `<details>` element's open state belongs to the page. When the person opens or closes one, the page counts a
 * local revision for it and keeps its `open` state against every frame whose `sensedRevision` for that control
 * names less; a details the island cannot sense (no control id, no render id) stays the page's for as long as it
 * stands. A frame's own change to `open` never reads as the person's toggle. A `<lar-disclosure>` element names
 * the control in a template; a `$reveal` keyed to a state paints `data-lar-control="lar-disclosure"` for the
 * page to know it.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/page-controls#/the-control-set
 */

export const LAR_DISCLOSURE_TAG = "lar-disclosure";

/** Per details, the page's own revision of its open state. */
const localRevs = new WeakMap<HTMLDetailsElement, number>();
/** Per details, the open state the last paint left, so the toggle a paint raised never reads as the person's. */
const painted = new WeakMap<HTMLDetailsElement, boolean>();

/** After a paint: remember the state the frame decided for each details the page did not hold. */
export function notePaintedDisclosures(pane: ParentNode, held: (details: HTMLDetailsElement) => boolean): void {
  for (const d of pane.querySelectorAll("details")) if (!held(d)) painted.set(d, d.open);
}

/** A `toggle` reached the pane: the person's, unless it matches the state the last paint left. */
export function takeDisclosureToggle(details: HTMLDetailsElement): boolean {
  if (painted.get(details) === details.open) return false;
  painted.set(details, details.open);
  localRevs.set(details, (localRevs.get(details) ?? 0) + 1);
  return true;
}

/** Whether the page keeps this details' open state against the frame: its revision runs ahead of what was sensed. */
export function holdsDisclosure(details: Element, sensed: number | undefined): boolean {
  if (!(details instanceof HTMLDetailsElement)) return false;
  const rev = localRevs.get(details);
  return rev !== undefined && rev > (sensed ?? 0);
}

export class LarDisclosureElement extends HTMLElement {}

export function defineLarDisclosure(): void {
  if (!customElements.get(LAR_DISCLOSURE_TAG)) customElements.define(LAR_DISCLOSURE_TAG, LarDisclosureElement);
}
