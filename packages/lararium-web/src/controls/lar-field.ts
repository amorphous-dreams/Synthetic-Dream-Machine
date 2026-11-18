/**
 * lar-field — the page's field editor control (page-controls#/the-control-set, ruled first).
 *
 * The island's seam engine paints a field inside `<lar-field data-lar-control="lar-field">`, its native child
 * carrying a VALUE DESCRIPTOR: `data-lar-value` (the whole value the store holds) and `data-lar-value-rev` (the
 * island's revision of that descriptor). The live value, the caret, focus and undo stay on the page:
 *
 *   - A field the person edited keeps its value against any descriptor that disagrees with it. A descriptor that
 *     disagrees and names a revision the page never took shows beside the field as a NEWER VERSION, with a
 *     take-theirs act. A field the person never edited, or one whose value the descriptor matches, takes the
 *     descriptor and stands clean. (The sink's sensed-revision veto holds the node whole before this rule reads.)
 *   - Every value the page writes on the person's behalf (take-theirs, a toolbar operation's `want`) lands as ONE
 *     undoable edit on the same node: the node never leaves, so the browser's edit history keeps every step.
 *   - The element sizes its field to its content where the engine supports `field-sizing`, through its own
 *     stylesheet, so no frame's morph takes the sizing away.
 *
 * The element's own words (the newer version, the take-theirs button) live in its shadow root, beside the field
 * and outside every frame's morph.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/page-controls#/the-control-set
 */

export const LAR_FIELD_TAG = "lar-field";
/** The event a take-theirs raises on the element, for the sink to relay as `lar:take-theirs`. */
export const LAR_FIELD_TAKE_THEIRS = "lar-field-take-theirs";

export type LarFieldNode = HTMLInputElement | HTMLTextAreaElement;
export const isLarFieldNode = (n: unknown): n is LarFieldNode =>
  n instanceof HTMLTextAreaElement || (n instanceof HTMLInputElement && !["checkbox", "radio", "file", "button", "submit", "reset", "image", "hidden"].includes(n.type));

interface FieldState {
  /** The person edited the field since the page last took the island's value. */
  edited: boolean;
  /** The descriptor revision the page last took whole. */
  takenRev: number;
  /** A disagreeing descriptor the page has not taken. */
  newer: { readonly value: string; readonly rev: number } | null;
}
const states = new WeakMap<Element, FieldState>();
const stateOf = (node: Element): FieldState => {
  let st = states.get(node);
  if (!st) { st = { edited: false, takenRev: 0, newer: null }; states.set(node, st); }
  return st;
};
/** The fields the page writes into right now: their own `input` never relays as the person's. */
const applying = new WeakSet<Element>();

export const isApplyingField = (node: Element | null): boolean => node !== null && applying.has(node);

/** The person typed into a field. */
export function markFieldEdited(node: Element): void {
  if (isLarFieldNode(node) && !applying.has(node)) stateOf(node).edited = true;
}

/**
 * Read one arriving descriptor against the field the page shows, and answer the value the node keeps: the
 * descriptor where the field stands clean or agrees, else the page's own value (and the descriptor offered).
 */
export function reconcileFieldDescriptor(node: LarFieldNode, value: string, rev: number): string {
  const st = stateOf(node);
  if (!st.edited || value === node.value) {
    st.edited = false;
    st.takenRev = rev;
    st.newer = null;
  } else if (rev > st.takenRev && st.newer?.rev !== rev) {
    st.newer = { value, rev };
  }
  hostOf(node)?.renderOffer();
  return st.edited ? node.value : value;
}

/** The newer version standing beside a field, or null. */
export const newerVersionOf = (node: Element): string | null => states.get(node)?.newer?.value ?? null;

/**
 * Write a whole value into the field as ONE undoable edit on the same node, then place the selection. The
 * field's own `input` from this write never relays as the person's.
 */
export function applyWholeValue(node: LarFieldNode, value: string, selStart?: number, selEnd?: number): void {
  applying.add(node);
  try {
    node.focus();
    node.select();
    const done = value === "" ? document.execCommand("delete") : document.execCommand("insertText", false, value);
    if (!done || node.value !== value) node.value = value;          // an engine without the edit command still lands the value
    if (selStart !== undefined && selEnd !== undefined) node.setSelectionRange(selStart, selEnd);
  } finally {
    applying.delete(node);
  }
}

const hostOf = (node: Element): LarFieldElement | null => {
  const host = node.parentElement;
  return host instanceof LarFieldElement ? host : null;
};

const SHEET = ":host{display:inline-block;position:relative;max-width:100%}"
  + "::slotted(textarea){field-sizing:content;min-height:3lh;box-sizing:border-box;max-width:100%}"
  + "::slotted(input){field-sizing:content;min-width:8ch}"
  + ".newer{display:block;margin-top:0.25em;padding:0.25em 0.5em;background:#fff6d5;color:#3a2f00;font:13px/1.4 system-ui,sans-serif}"
  + ".newer[hidden]{display:none}"
  + ".newer button{margin-left:0.5em;font:inherit}";

export class LarFieldElement extends HTMLElement {
  #offer: HTMLElement | null = null;
  #words: HTMLElement | null = null;

  /** The native field this control owns. */
  field(): LarFieldNode | null {
    const f = [...this.children].find(isLarFieldNode);
    return f ?? null;
  }

  /** The disagreeing value standing beside the field, or null. */
  get newerVersion(): string | null {
    const f = this.field();
    return f ? newerVersionOf(f) : null;
  }

  connectedCallback(): void {
    if (this.shadowRoot) { this.renderOffer(); return; }
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = SHEET;
    root.appendChild(style);
    root.appendChild(document.createElement("slot"));
    const offer = document.createElement("div");
    offer.className = "newer";
    offer.setAttribute("role", "status");
    offer.hidden = true;
    const words = document.createElement("span");
    const take = document.createElement("button");
    take.type = "button";
    take.setAttribute("part", "take-theirs");
    take.textContent = "Take theirs";
    take.addEventListener("click", (event) => {
      // The take-theirs act belongs to this control; no projected click leg reads it.
      event.stopPropagation();
      this.takeTheirs();
    });
    offer.append(words, take);
    root.appendChild(offer);
    this.#offer = offer;
    this.#words = words;
    this.renderOffer();
  }

  renderOffer(): void {
    if (!this.#offer || !this.#words) return;
    const newer = this.newerVersion;
    this.#offer.hidden = newer === null;
    this.#words.textContent = newer === null ? "" : "A newer version of this field arrived. Your text remains here.";
  }

  /** Replace the field's value with the newer version as one undoable edit, and say so to the sink. */
  takeTheirs(): void {
    const f = this.field();
    const st = f ? states.get(f) : undefined;
    if (!f || !st?.newer) return;
    const { value, rev } = st.newer;
    applyWholeValue(f, value);
    st.edited = false;
    st.takenRev = rev;
    st.newer = null;
    this.renderOffer();
    this.dispatchEvent(new CustomEvent(LAR_FIELD_TAKE_THEIRS, { bubbles: true, composed: true }));
  }
}

/** Define the element once per page. */
export function defineLarField(): void {
  if (!customElements.get(LAR_FIELD_TAG)) customElements.define(LAR_FIELD_TAG, LarFieldElement);
}
