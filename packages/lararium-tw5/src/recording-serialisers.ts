import { RecordingNode } from "./recording-document.js";

export type CameraResult<T> = T | { readonly missing: "camera" };
export interface TextResult { readonly text: string; readonly handles: readonly string[] }
export interface Affordance { readonly id: string; readonly kind: string; readonly target?: string; readonly nodeId: number }
export interface Block {
  readonly kind: string;
  readonly children: readonly Block[];
  readonly text?: string;
  readonly affordances: readonly Affordance[];
}

const QT = new Set(["b", "i", "u", "s", "a", "br", "p", "span", "font", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "table", "tr", "td", "th"]);
function escapeText(value: string): string { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function escapeAttribute(value: string): string { return escapeText(value).replace(/"/g, "&quot;"); }
function href(node: RecordingNode): string | null { return node.getAttribute("href") ?? node.getAttribute("data-tiddler-title"); }
function handle(node: RecordingNode): string {
  const target = href(node) ?? "";
  return target.startsWith("#") ? target.slice(1) : target;
}
function walkText(node: RecordingNode, handles: string[]): string {
  if (node.nodeType === 3) return node.textContent;
  if (node.tag === "a" && href(node)) {
    const target = handle(node);
    handles.push(target);
    return `[[${target}]]`;
  }
  const text = node.childNodes.map(child => walkText(child, handles)).join("");
  return ["p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "br"].includes(node.tag) ? `${text}\n` : text;
}
export function toText(root: RecordingNode | null): CameraResult<TextResult> {
  if (!root) return { missing: "camera" };
  const handles: string[] = [];
  return { text: walkText(root, handles).trim(), handles };
}

function label(node: RecordingNode): string {
  if (node.nodeType === 3) return escapeText(node.textContent);
  if (!QT.has(node.tag)) return node.childNodes.map(label).join("");
  if (node.tag === "br") return "<br>";
  const attrs: string[] = [];
  if (node.tag === "a" && href(node)) attrs.push(`href="${escapeAttribute(href(node)!)}"`);
  const style = node.getAttribute("style") ?? Object.entries(node.style).map(([key, value]) => `${key}:${value}`).join(";");
  if (style) attrs.push(`style="${escapeAttribute(style)}"`);
  return `<${node.tag}${attrs.length ? ` ${attrs.join(" ")}` : ""}>${node.childNodes.map(label).join("")}</${node.tag}>`;
}
export function toLabelHtml(root: RecordingNode | null): CameraResult<string> {
  if (!root) return { missing: "camera" };
  return root.childNodes.map(label).join("");
}

export function toBlocks(root: RecordingNode | null): CameraResult<Block> {
  if (!root) return { missing: "camera" };
  let position = 0;
  const walk = (node: RecordingNode): Block => {
    const id = position++;
    if (node.nodeType === 3) return { kind: "text", children: [], text: node.textContent, affordances: [] };
    const children = node.childNodes.map(walk);
    const affordances: Affordance[] = [];
    if (node.tag === "a" && href(node)) affordances.push({ id: `a${id}`, kind: "link", target: handle(node), nodeId: node.nodeId });
    for (const listener of node.listeners) affordances.push({ id: `a${id}-${affordances.length}`, kind: listener.type, nodeId: node.nodeId });
    return { kind: node.tag, children, affordances };
  };
  return walk(root);
}
