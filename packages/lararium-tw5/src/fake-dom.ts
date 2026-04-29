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

/**
 * Extract innerHTML (HTML string) from a TW_Element.
 * TW5 builds this natively via TW_Element.prototype.innerHTML.
 * Convenience wrapper for callers that prefer HTML over VDomNode[].
 */
export function tw5ElementToHtml(container: { innerHTML: string }): string {
  return container.innerHTML;
}
