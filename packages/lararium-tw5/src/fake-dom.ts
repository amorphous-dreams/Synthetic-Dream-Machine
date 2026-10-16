/**
 * fake-dom — VDomNode converter for TW5's built-in fake DOM.
 *
 * TW5 ships $tw.fakeDocument (TW_Element / TW_TextNode) in:
 *   tiddlywiki/core/modules/utils/fakedom.js
 *
 * TW_Element has: tag, attributes{}, children[], outerHTML, innerHTML, textContent
 * TW_TextNode has: textContent, children: []
 *
 * We do NOT duplicate TW5's fake DOM. We use it as the render target and
 * convert the finished tree to our immutable VDomNode format for downstream use.
 *
 * Usage:
 *   const container = $tw.fakeDocument.createElement("div");
 *   widgetRoot.render(container, null);
 *   const vdom = tw5ElementToVdom(container);
 */

// ---------------------------------------------------------------------------
// VDomNode — immutable virtual DOM node (our canonical render output)
// ---------------------------------------------------------------------------

export interface VDomNode {
  readonly type:     "element" | "text";
  readonly tagName?: string;
  readonly attrs?:   Readonly<Record<string, string>>;
  readonly children: readonly VDomNode[];
  readonly text?:    string;
}

// ---------------------------------------------------------------------------
// TW5FakeElement / TW5FakeTextNode — minimal typing for TW5's fake DOM nodes.
//
// TW5 defines TW_Element and TW_TextNode internally (not exported as types).
// We type only the fields we read; the isTiddlyWikiFakeDom flag distinguishes
// element nodes from text nodes at runtime.
// ---------------------------------------------------------------------------

export interface TW5FakeElement {
  readonly isTiddlyWikiFakeDom: true;
  readonly tag: string;
  readonly attributes: Record<string, string>;
  readonly children: Array<TW5FakeElement | TW5FakeTextNode>;
  readonly _style: Record<string, string>;
}

export interface TW5FakeTextNode {
  readonly isTiddlyWikiFakeDom?: undefined;
  readonly textContent: string;
  readonly children: [];
}

export type TW5FakeNode = TW5FakeElement | TW5FakeTextNode;

// ---------------------------------------------------------------------------
// tw5ElementToVdom — convert a TW_Element tree to VDomNode[]
// ---------------------------------------------------------------------------

function nodeToVdom(n: TW5FakeNode): VDomNode {
  if (!("isTiddlyWikiFakeDom" in n) || !n.isTiddlyWikiFakeDom) {
    // TW_TextNode
    return { type: "text", text: (n as TW5FakeTextNode).textContent, children: [] };
  }
  const el = n as TW5FakeElement;
  const attrs = { ...el.attributes };
  // Flatten inline style back to string if present
  if (el._style && Object.keys(el._style).length > 0) {
    attrs["style"] = Object.entries(el._style)
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
  }
  return {
    type:     "element",
    tagName:  el.tag,
    attrs,
    children: el.children.map(nodeToVdom),
  };
}

/**
 * Convert a rendered TW_Element container into an array of VDomNodes.
 * Pass the same container you gave to widgetRoot.render(container, null).
 *
 * Requires $tw to be booted — $tw.fakeDocument must exist.
 */
export function tw5ElementToVdom(container: TW5FakeElement): VDomNode[] {
  return container.children.map(nodeToVdom);
}

// ---------------------------------------------------------------------------
// Control state promotion — a toggle's and a choice's live state, painted as attributes
//
// TW5's checkbox, radio and select widgets keep a control's live state in node PROPERTIES (`checked`,
// `indeterminate`, `option.selected`, `select.value`), and the fake DOM serialises attributes alone. The frame
// serialiser promotes each property to the attribute a page reads, so a frame paints a toggle's true state:
//
//   - `input.checked` (a boolean the widget or the act set)  → `checked="checked"`, or no `checked`;
//   - `input.indeterminate`                                    → `data-lar-indeterminate=""`, or none;
//   - a single `select`'s value (TW5 sets `select.value`)      → `selected="selected"` on the option it names, none on the rest;
//   - a multiple `select`'s `option.selected`                  → `selected="selected"`, or no `selected`.
//
// A node whose widget set its state only as an attribute (TW5's first render of a checked checkbox) keeps that
// attribute: the promotion reads a property only where one stands.
// ---------------------------------------------------------------------------

interface PromotableNode {
  readonly tag?: string;
  readonly attributes?: Record<string, string | undefined>;
  readonly children?: readonly PromotableNode[];
  readonly isRaw?: boolean;
  readonly textContent?: string;
  readonly checked?: unknown;
  readonly indeterminate?: unknown;
  readonly selected?: unknown;
}

function setFlag(node: PromotableNode, name: string, on: boolean, value: string): void {
  if (on) node.attributes![name] = value;
  else delete node.attributes![name];
}

/** The options a select holds, through its option groups, in document order. */
export function selectOptions(select: PromotableNode): PromotableNode[] {
  const out: PromotableNode[] = [];
  for (const child of select.children ?? []) {
    if (child.tag === "option") out.push(child);
    else if (child.tag === "optgroup") for (const grand of child.children ?? []) if (grand.tag === "option") out.push(grand);
  }
  return out;
}

/** The key an option carries: its `value`, else its text (what a browser submits). */
export function optionKey(option: PromotableNode): string {
  return option.attributes?.["value"] ?? option.textContent ?? "";
}

function promoteSelect(select: PromotableNode): void {
  const options = selectOptions(select);
  if (select.attributes!["multiple"] === undefined) {
    const value = select.attributes!["value"];
    const chosen = value !== undefined
      ? options.find((o) => optionKey(o) === value)
      : [...options].reverse().find((o) => o.selected === true);
    if (value === undefined && chosen === undefined && !options.some((o) => typeof o.selected === "boolean")) return;
    for (const o of options) setFlag(o, "selected", o === chosen, "selected");
    return;
  }
  for (const o of options) if (typeof o.selected === "boolean") setFlag(o, "selected", o.selected, "selected");
}

/** Promote every toggle's and choice's live property under `node` to the attribute the frame paints. */
export function promoteControlState(node: PromotableNode): void {
  if (!node.attributes || node.isRaw) return;
  if (node.tag === "input") {
    if (typeof node.checked === "boolean") setFlag(node, "checked", node.checked, "checked");
    if (typeof node.indeterminate === "boolean") setFlag(node, "data-lar-indeterminate", node.indeterminate, "");
  } else if (node.tag === "select") {
    promoteSelect(node);
  }
  for (const child of node.children ?? []) promoteControlState(child);
}

/**
 * Serialise a rendered TW_Element container's children as the frame's HTML. TW5 builds the markup natively
 * (TW_Element.prototype.innerHTML); the control state its widgets hold as properties rides as attributes first
 * (`promoteControlState`), so the HTML paints what the person and the store last chose.
 */
export function tw5ElementToHtml(container: { innerHTML: string }): string {
  promoteControlState(container as PromotableNode);
  return container.innerHTML;
}
