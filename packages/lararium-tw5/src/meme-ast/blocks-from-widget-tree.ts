import type { Block } from "../recording-serialisers.js";
import type { WidgetTreeNode } from "./widget-tree.js";

/** The root div and preorder ids match `toBlocks` on a recording camera. */
export function widgetTreeToBlocks(tree: readonly WidgetTreeNode[]): Block {
  let position = 0;
  const walk = (node: WidgetTreeNode): Block => {
    const id = position++;
    const children = node.children.map(walk);
    const affordances = (node.affordances ?? []).map((item, index) => ({
      id: index === 0 ? `a${id}` : `a${id}-${index}`,
      kind: item.kind,
      ...(item.target !== undefined ? { target: item.target } : {}),
      nodeId: id,
    }));
    const kind = node.kind === "section" ? `h${node.attrs?.level ?? "1"}`
      : node.kind === "paragraph" ? "p"
      : node.kind === "list" ? node.attrs?.ordered === "true" ? "ol" : "ul"
      : node.kind === "list-item" ? "li"
      : node.kind === "link-handle" ? "a"
      : node.kind === "code" ? "pre"
      : node.kind;
    return { kind, children, ...(node.text !== undefined ? { text: node.text } : {}), affordances };
  };
  return walk({ kind: "div", children: tree });
}

/** Declared Qt label projection from the structural block answer. */
export function blocksToLabelHtml(root: Block): string {
  const allowed = new Set(["b", "i", "u", "s", "a", "br", "p", "span", "font", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "table", "tr", "td", "th"]);
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const visit = (block: Block): string => {
    if (block.kind === "text") return escape(block.text ?? "");
    const body = block.children.map(visit).join("");
    if (!allowed.has(block.kind)) return body;
    if (block.kind === "br") return "<br>";
    const target = block.kind === "a" ? block.affordances.find(a => a.kind === "link")?.target : undefined;
    const href = target ? ` href="${escape(/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target) ? target : `#${target}`)}"` : "";
    return `<${block.kind}${href}>${body}</${block.kind}>`;
  };
  return root.children.map(visit).join("");
}
