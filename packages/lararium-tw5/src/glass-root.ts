import type { TW5Instance } from "./types/tiddlywiki.js";

/** The door a surface lends its mirror: one ask opens one host service, and `settle` hears `ok` or a named refusal once. */
export interface GlassDoor { ask(kind: string, args: Record<string, string | number | boolean>, settle: (status: string) => void): void }
interface RootEvent { type: string; param?: string; paramObject?: Record<string, string>; tiddlerTitle?: string; target?: unknown;
  event?: { target?: unknown }; widget?: unknown }
type Root = { addEventListener(type: string, handler: (event: RootEvent) => boolean | void): void;
  removeEventListener?(type: string, handler: (event: RootEvent) => boolean | void): void };

const REFUSED = "$:/temp/lares/alert/refused/";
const COPY_OK = "$:/language/Notifications/CopiedToClipboard/Succeeded";
const COPY_FAILED = "$:/language/Notifications/CopiedToClipboard/Failed";

/**
 * THE PANE'S SCROLLER. Stock's `PageScroller` scrolls the window; the mirror's story scrolls inside its pane (`glass-sheet.ts`), so
 * `tm-scroll` and the storyviews' direct calls move the pane's own scroll box. The browser paces the motion (`behavior: "smooth"`,
 * honouring the wiki's animation setting): the scroller reads no clock.
 */
export function makePaneScroller(tw: TW5Instance, body: HTMLElement, shadowRoot: ShadowRoot) {
  const duration = (options?: { animationDuration?: string | number }): number => {
    const named = options && Object.hasOwn(options, "animationDuration") ? parseInt(String(options.animationDuration), 10) : NaN;
    return Number.isNaN(named) ? (tw.utils as unknown as { getAnimationDuration(): number }).getAnimationDuration() : named;
  };
  const scroller = {
    isScrolling: (): boolean => false,
    cancelScroll(): void { /* the browser owns the motion */ },
    scrollIntoView(element: Element | null, callback?: (() => DOMRect) | null, options?: { animationDuration?: string | number }): void {
      if (!element && typeof callback !== "function") return;
      const bounds = typeof callback === "function" ? callback() : element!.getBoundingClientRect();
      const frame = body.getBoundingClientRect();
      const toolbar = shadowRoot.querySelector<HTMLElement>(".tc-adjust-top-of-scroll");
      // Stock snaps to the top within 50px of it.
      const snap = (at: number): number => (at < 50 ? 0 : at);
      body.scrollTo({ top: snap(bounds.top - frame.top + body.scrollTop - (toolbar?.offsetHeight ?? 0)),
        left: snap(bounds.left - frame.left + body.scrollLeft), behavior: duration(options) > 0 ? "smooth" : "auto" });
    },
    scrollSelectorIntoView(base: ParentNode | null, selector: string, callback?: (() => DOMRect) | null, options?: { animationDuration?: string | number }): void {
      let target: Element | null = null;
      try { target = (base ?? shadowRoot).querySelector(selector); } catch { /* a selector the browser cannot read names nothing */ }
      if (target) scroller.scrollIntoView(target, callback, options);
    },
    handleEvent(event: RootEvent): boolean {
      if (event.type !== "tm-scroll") return true;
      const options = event.paramObject && Object.hasOwn(event.paramObject, "animationDuration") ? { animationDuration: event.paramObject["animationDuration"]! } : {};
      if (event.paramObject?.["selector"]) scroller.scrollSelectorIntoView(null, event.paramObject["selector"], null, options);
      else if (event.target instanceof Element) scroller.scrollIntoView(event.target, null, options);
      return false;
    },
  };
  return scroller;
}

/**
 * THE MIRROR'S ROOT: every root `tm-*` message stock TW5 answers from its browser startup (`rootwidget`, `render`, `windows`: all
 * kept out of the mirror's boot), answered here over the mirror's own pane (`d3-glass-lane#/the-doors`). Two halves, as the
 * island's `lar-root-services` keeps them:
 *
 *   PAINTED IN THE PANE, by the engine's own stock classes.
 *     tm-modal · tm-show-switcher   stock's `Modal`, handed a document whose `body` reads as the pane's body stand-in, so the
 *                                   wrapper, the backdrop and the modal's own widget tree land inside the shadow root under the
 *                                   theme's sheet, and `position: fixed` lays out against the pane.
 *     tm-notify                     the notification renders into the pane's body stand-in; the browser's own animation paces
 *                                   its leave over the wiki's notification duration (paint, never truth).
 *     tm-scroll · tm-focus-selector the pane's scroller; focus inside the shadow root.
 *     tm-rename-tiddler · tm-relink-tiddler   stock's own handler, over `$tw.wiki`.
 *
 *   HOST DOORS, asked of the surface (`door`): clipboard, download, open-surface, fullscreen. `lar-story` (the house plugin)
 *   asks print, open-external and route through the same door, read off `$tw.lares.serviceDoor`. A refusal raises
 *   `$:/temp/lares/alert/refused/<kind>`; with no door every ask refuses `page-action-unavailable`.
 *
 *   REFUSED BY NAME: tm-http-request, until the vessel's `http-request` door stands (the Web3-only law: no silent page fetch).
 *
 * Returns the undo: every listener and every lend goes back.
 */
export function installGlassRoot(opts: { tw: TW5Instance; root: Root; shadowRoot: ShadowRoot; body: HTMLElement; door?: GlassDoor;
  scroller: ReturnType<typeof makePaneScroller> }): () => void {
  const { tw, root, shadowRoot, body, door } = opts;
  const twAny = tw as unknown as Record<string, any>;
  const wiki = tw.wiki as unknown as { addTiddler(fields: unknown): void; getTiddler(title: string): unknown; getTiddlerText(title: string, fallback?: string): string | null | undefined;
    renderTiddler(type: string, title: string, options?: unknown): string; makeTranscludeWidget(title: string, options: unknown): { render(parent: Node, next: Node | null): void; refresh(changes: unknown, container?: Node, next?: Node | null): boolean };
    renameTiddler(from: string, to: string, options?: unknown): void; relinkTiddler(from: string, to: string, options?: unknown): void;
    addEventListener(type: string, listener: (changes: unknown) => void): void; removeEventListener(type: string, listener: (changes: unknown) => void): void };
  const doc = shadowRoot.ownerDocument;
  const bound: Array<[string, (event: RootEvent) => boolean | void]> = [];
  const on = (type: string, handler: (event: RootEvent) => boolean | void): void => { root.addEventListener(type, handler); bound.push([type, handler]); };
  const alert = (kind: string, text: string): void =>
    wiki.addTiddler(new tw.Tiddler({ title: REFUSED + kind, text, tags: ["$:/tags/Alert"], component: "glass-root" }));
  const ask = (message: string, kind: string, args: Record<string, string | number | boolean>, then: (status: string) => void = () => {}): void => {
    const settle = (status: string): void => { if (status !== "ok") alert(kind, `This surface opens no ${kind} door: ${message} refused (${status}).`); then(status); };
    if (!door) { settle("page-action-unavailable"); return; }
    door.ask(kind, args, settle);
  };
  const present = (from: Record<string, string> | undefined, names: readonly string[]): Record<string, string> =>
    Object.fromEntries(names.filter(name => from?.[name] !== undefined && from[name] !== "").map(name => [name, String(from![name])]));

  // A document that reads as the page's own, except that its `body` names the pane's body stand-in: stock classes that append to
  // `document.body` land inside the shadow root. Methods run against the real document.
  const paneDocument = new Proxy(doc, { get(target, key) {
    if (key === "body") return body;
    const value = Reflect.get(target, key, target) as unknown;
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
  } });
  const Modal = twAny.utils?.Modal as (new (wiki: unknown) => { display(title: string, options: unknown): void }) | undefined;
  const priorModal = twAny.modal;
  if (Modal) twAny.modal = new Modal(tw.wiki);
  const modal = (title: string, event: RootEvent): void => {
    if (!Modal) { alert("modal", `This engine carries no modal: ${event.type} refused.`); return; }
    twAny.modal.display(title, { variables: event.paramObject, event: { ...event, event: { target: { ownerDocument: paneDocument } } } });
  };
  on("tm-modal", event => { if (event.param) modal(event.param, event); });
  on("tm-show-switcher", event => modal("$:/core/ui/SwitcherModal", event));

  const notes = new Set<{ node: HTMLElement; leave: () => void }>();
  const notify = (title: string, variables: Record<string, string> = {}): void => {
    if (!title || !wiki.getTiddler(title)) return;
    const node = doc.createElement("div");
    node.className = "tc-notification";
    node.setAttribute("role", "alert");
    const widget = wiki.makeTranscludeWidget(title, { parentWidget: root, document: doc, variables: { currentTiddler: title, ...variables }, importPageMacros: true });
    widget.render(node, null);
    const refresh = (changes: unknown): void => { widget.refresh(changes, node, null); };
    wiki.addEventListener("change", refresh);
    body.appendChild(node);
    node.style.opacity = "1.0"; node.style.transform = "translateY(0px)";
    const note = { node, leave: (): void => { wiki.removeEventListener("change", refresh); node.remove(); notes.delete(note); } };
    notes.add(note);
    // The browser's own animation paces how long the words show (the wiki's notification duration, then a fade); its end removes
    // them. Nothing here reads a clock, and nothing reads the animation as truth.
    const shown = Number(twAny.config?.preferences?.notificationDuration ?? 3000);
    const fade = (tw.utils as unknown as { getAnimationDuration(): number }).getAnimationDuration();
    const whole = Math.max(1, shown + fade);
    const play = node.animate?.([{ opacity: 1 }, { opacity: 1, offset: shown / whole }, { opacity: 0 }], { duration: whole, fill: "forwards" });
    if (play) play.finished.then(note.leave, note.leave);
  };
  const priorNotifier = twAny.notifier;
  twAny.notifier = { display: (title: string, options?: { variables?: Record<string, string> }) => notify(title, options?.variables) };
  on("tm-notify", event => { if (event.param) notify(event.param, event.paramObject); });

  const rename = (method: "renameTiddler" | "relinkTiddler") => (event: RootEvent): void => {
    const p = event.paramObject ?? {};
    const from = p["from"] ?? event.tiddlerTitle;
    if (!from || !p["to"]) return;
    wiki[method](from, p["to"], { dontRenameInTags: p["renameInTags"] === "false" || p["renameInTags"] === "no",
      dontRenameInLists: p["renameInLists"] === "false" || p["renameInLists"] === "no" });
  };
  on("tm-rename-tiddler", rename("renameTiddler"));
  on("tm-relink-tiddler", rename("relinkTiddler"));

  on("tm-scroll", event => opts.scroller.handleEvent(event));
  on("tm-focus-selector", event => {
    let target: HTMLElement | null = null;
    try { target = event.param ? shadowRoot.querySelector<HTMLElement>(event.param) : null; } catch { /* an unreadable selector names nothing */ }
    target?.focus?.(event.paramObject as FocusOptions | undefined);
  });

  on("tm-copy-to-clipboard", event => {
    const p = event.paramObject ?? {};
    ask(event.type, "clipboard", { text: event.param ?? "" }, status => notify(status === "ok" ? p["successNotification"] || COPY_OK : p["failureNotification"] || COPY_FAILED));
  });
  on("tm-download-file", event => {
    const template = event.param || "$:/core/save/all";
    const variables = event.paramObject ?? {};
    ask(event.type, "download", { filename: variables["filename"] || template, text: wiki.renderTiddler("text/plain", template, { variables }), type: variables["type"] || "text/plain" });
  });
  on("tm-open-window", event => {
    ask(event.type, "open-surface", { title: event.param || event.tiddlerTitle || "", ...present(event.paramObject, ["template", "windowTitle", "windowID", "width", "height"]) });
  });
  on("tm-full-screen", event => ask(event.type, "fullscreen", { mode: event.param === "enter" || event.param === "exit" ? event.param : "toggle" }));
  on("tm-http-request", event => {
    const url = event.paramObject?.["url"] ?? "";
    alert("http-request", `tm-http-request refuses under the Web3-only law: this surface makes no HTTP request${url ? ` (${url})` : ""}; the reach rides the vessel's http-request door once it stands.`);
  });
  on("tm-http-cancel-all-requests", () => { /* no request ever left */ });

  // `lar-story` and a person's own wikitext read the door off `$tw.lares.serviceDoor`.
  const priorLares = twAny.lares;
  if (door) twAny.lares = { ...(priorLares ?? {}), serviceDoor: door };

  return () => {
    for (const [type, handler] of bound) root.removeEventListener?.(type, handler);
    for (const note of [...notes]) note.leave();
    twAny.modal = priorModal; twAny.notifier = priorNotifier;
    if (door) twAny.lares = priorLares;
  };
}
