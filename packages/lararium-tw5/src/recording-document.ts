/** Mutable, clockless DOM target for a TW5 camera. Node ids survive reparenting. */
import type { TW5FakeDocument, TW5FakeElement } from "./types/tiddlywiki.js";

export interface RecordedListener {
  readonly type: string;
  readonly capture: boolean;
  readonly callback: EventListenerOrEventListenerObject;
}

export class RecordingNode {
  readonly attributes: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly childNodes: RecordingNode[] = [];
  readonly listeners: RecordedListener[] = [];
  parentNode: RecordingNode | null = null;
  readonly tagName: string;
  readonly tag: string;
  readonly isTiddlyWikiFakeDom = true;
  private content = "";
  private html = "";
  constructor(readonly nodeId: number, tag: string, readonly nodeType: 1 | 3) {
    this.tagName = tag.toUpperCase();
    this.tag = tag.toLowerCase();
  }
  get children(): RecordingNode[] { return this.childNodes; }
  get id(): string { return this.getAttribute("id") ?? ""; }
  set id(value: string) { this.setAttribute("id", value); }
  get className(): string { return this.getAttribute("class") ?? ""; }
  set className(value: string) { this.setAttribute("class", value); }
  get textContent(): string {
    return this.nodeType === 3 ? this.content : this.childNodes.map(child => child.textContent).join("");
  }
  set textContent(value: string | null) {
    if (this.nodeType === 3) { this.content = value ?? ""; return; }
    this.clearChildren();
    if (value) this.appendChild(new RecordingNode(this.nextChildId(), "#text", 3)).textContent = value;
  }
  private nextChildId(): number { return this.document?.nextId() ?? -(this.nodeId * 100000 + this.childNodes.length + 1); }
  private document: RecordingDocument | null = null;
  bindDocument(document: RecordingDocument): this { this.document = document; return this; }
  setAttribute(name: string, value: string): void { this.attributes[name] = String(value); }
  setAttributeNS(_namespace: string | null, name: string, value: string): void { this.setAttribute(name, value); }
  getAttribute(name: string): string | null { return this.attributes[name] ?? null; }
  removeAttribute(name: string): void { delete this.attributes[name]; }
  hasAttribute(name: string): boolean { return Object.hasOwn(this.attributes, name); }
  appendChild<T extends RecordingNode>(child: T): T { return this.insertBefore(child, null); }
  insertBefore<T extends RecordingNode>(child: T, reference: RecordingNode | null): T {
    if ((child as RecordingNode) === this || child.contains(this)) throw new Error("cyclic-node");
    if (reference !== null && reference.parentNode !== this) throw new Error("reference-not-child");
    child.parentNode?.removeChild(child);
    const index = reference === null ? this.childNodes.length : this.childNodes.indexOf(reference);
    this.childNodes.splice(index, 0, child);
    this.html = "";
    child.parentNode = this;
    if (this.document) child.bindDocument(this.document);
    return child;
  }
  removeChild<T extends RecordingNode>(child: T): T {
    const index = this.childNodes.indexOf(child);
    if (index < 0) throw new Error("node-not-child");
    this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }
  private clearChildren(): void { for (const child of [...this.childNodes]) this.removeChild(child); }
  contains(node: RecordingNode): boolean {
    for (let parent: RecordingNode | null = node; parent; parent = parent.parentNode) if (parent === this) return true;
    return false;
  }
  get firstChild(): RecordingNode | null { return this.childNodes[0] ?? null; }
  get lastChild(): RecordingNode | null { return this.childNodes.at(-1) ?? null; }
  get nextSibling(): RecordingNode | null {
    if (!this.parentNode) return null;
    return this.parentNode.childNodes[this.parentNode.childNodes.indexOf(this) + 1] ?? null;
  }
  get previousSibling(): RecordingNode | null {
    if (!this.parentNode) return null;
    return this.parentNode.childNodes[this.parentNode.childNodes.indexOf(this) - 1] ?? null;
  }
  addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
    if (!callback) return;
    const capture = typeof options === "boolean" ? options : options?.capture ?? false;
    if (!this.listeners.some(l => l.type === type && l.callback === callback && l.capture === capture))
      this.listeners.push({ type, callback, capture });
  }
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void {
    const capture = typeof options === "boolean" ? options : options?.capture ?? false;
    const index = this.listeners.findIndex(l => l.type === type && l.callback === callback && l.capture === capture);
    if (index >= 0) this.listeners.splice(index, 1);
  }
  get innerHTML(): string { return this.html || this.childNodes.map(c => c.outerHTML).join(""); }
  set innerHTML(value: string) { this.clearChildren(); this.html = value; }
  get outerHTML(): string {
    if (this.nodeType === 3) return this.content.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const attrs = Object.entries(this.attributes).map(([k, v]) => ` ${k}="${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`).join("");
    return `<${this.tag}${attrs}>${this.innerHTML}</${this.tag}>`;
  }
}

export class RecordingDocument {
  private sequence = 0;
  readonly body = this.createElement("body");
  readonly head = this.createElement("head");
  nextId(): number { return ++this.sequence; }
  createElement(tag: string): RecordingNode { return new RecordingNode(this.nextId(), tag, 1).bindDocument(this); }
  createElementNS(_namespace: string, tag: string): RecordingNode { return this.createElement(tag); }
  createTextNode(text: string): RecordingNode {
    const node = new RecordingNode(this.nextId(), "#text", 3).bindDocument(this);
    node.textContent = text;
    return node;
  }
}

/** Cast only at the camera boundary, where TW5 accepts the fake-document surface. */
export function cameraDocument(document: RecordingDocument): TW5FakeDocument {
  return document as unknown as TW5FakeDocument;
}
export function cameraContainer(node: RecordingNode): TW5FakeElement {
  return node as unknown as TW5FakeElement;
}
