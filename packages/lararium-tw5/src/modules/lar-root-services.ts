/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/lar-root-services
type: application/javascript
module-type: startup
\*/
/**
 * lar-root-services — the root `tm-*` messages a worker island answers itself, and the host doors it asks the
 * surface to open (dreamdom#/host-services; open ruling 9 as the house reads it).
 *
 * Stock TW5 binds these root-widget listeners under `platforms: ["browser"]` alone, so an island that renders
 * through a fake document heard none of them. This module binds them where no browser stands, in two halves:
 *
 *   PURE WIKI LOGIC, run here.
 *     tm-rename-tiddler · tm-relink-tiddler   stock's own handler, over `$tw.wiki`.
 *     tm-home                                 the story from `$:/DefaultTiddlers`, through the stock hook.
 *     tm-modal · tm-show-switcher             a record under `$:/temp/lares/modal/`, painted by the root layer
 *                                             as an `aria-modal` dialog; its own close message removes it.
 *     tm-notify                               a record under `$:/temp/lares/notify/`, painted by the root layer,
 *                                             removed after the notification duration.
 *     tm-scroll · tm-focus-selector           HINTS the frame carries: `$:/temp/lares/hint/{scroll,focus}` with a
 *                                             selector and a rising number, painted as `data-lar-scroll-to` /
 *                                             `data-lar-focus` beside `data-lar-hint`. The page scrolls and
 *                                             focuses; the island never measures.
 *
 *   HOST DOORS, asked through `$tw.lares.serviceDoor` (the mounted camera posts `lar:service` on `ctx.post`).
 *     tm-copy-to-clipboard → clipboard {text}            the success or failure notification on the answer
 *     tm-download-file     → download {filename, text, type}   the template rendered here, as stock saves it
 *     tm-open-window       → open-surface {title, …}
 *     tm-open-external-window → open-external {url, …}
 *     tm-print             → print {}
 *     tm-full-screen       → fullscreen {mode}
 *   A refusal, at once or on the answer, raises `$:/temp/lares/alert/refused/<kind>` tagged `$:/tags/Alert`.
 *
 *   REFUSED BY NAME.
 *     tm-http-request      the Web3-only law: an island makes no HTTP request; `$:/temp/lares/alert/refused/http-request`.
 *
 * A browser page that runs stock TW5 keeps stock's own listeners: this module binds nothing there.
 */

export const name        = "lar-root-services";
export const after       = ["startup"];
export const synchronous = true;

type Args = Record<string, string | number | boolean>;
interface Door { ask(kind: string, args: Args, settle: (status: string) => void): void }
interface WidgetEvent {
  type: string;
  param?: string;
  paramObject?: Record<string, string>;
  tiddlerTitle?: string;
  target?: { attributes?: Record<string, string | undefined> };
  event?: { target?: { attributes?: Record<string, string | undefined> } };
}
interface Wiki {
  addTiddler(fields: Record<string, unknown>): void;
  deleteTiddler(title: string): void;
  getTiddlerText(title: string, fallback?: string): string | null | undefined;
  filterTiddlers(filter: string): string[];
  renderTiddler(type: string, title: string, options?: { variables?: Record<string, string> }): string;
  renameTiddler(from: string, to: string, options?: unknown): void;
  relinkTiddler(from: string, to: string, options?: unknown): void;
  addToHistory(title: string): void;
  getModificationFields(): Record<string, unknown>;
}
interface Tw {
  browser?: unknown;
  wiki: Wiki;
  rootWidget?: { addEventListener(type: string, handler: (event: WidgetEvent) => boolean | void): void };
  hooks: { invokeHook(name: string, value: string[]): string[] };
  config?: { preferences?: { notificationDuration?: number } };
  lares?: Record<string, unknown>;
}

// TW5's evalGlobal injects $tw as a direct function parameter.
declare const $tw: Tw | undefined;

export const ALERT_REFUSED_PREFIX = "$:/temp/lares/alert/refused/";
export const NOTIFY_PREFIX = "$:/temp/lares/notify/";
export const MODAL_PREFIX = "$:/temp/lares/modal/";
export const HINT_SCROLL = "$:/temp/lares/hint/scroll";
export const HINT_FOCUS = "$:/temp/lares/hint/focus";

const COPY_OK = "$:/language/Notifications/CopiedToClipboard/Succeeded";
const COPY_FAILED = "$:/language/Notifications/CopiedToClipboard/Failed";
const SWITCHER = "$:/core/ui/SwitcherModal";
const DEFAULT_SAVE_TEMPLATE = "$:/core/save/all";
const DEFAULT_EXTERNAL = "https://tiddlywiki.com/";

export function startup(): void {
  if (!$tw || $tw.browser || !$tw.rootWidget) return;
  installRootServices($tw);
}

/** Bind every root listener this module names on `tw.rootWidget`. Exported so a vector binds a wiki it built. */
export function installRootServices(tw: Tw): void {
  const root = tw.rootWidget!;
  const wiki = tw.wiki;
  let seq = 0;
  const next = (): string => String(++seq).padStart(6, "0");
  const variablesOf = (event: WidgetEvent): string => JSON.stringify(event.paramObject ?? {});

  const alert = (kind: string, text: string): void => {
    wiki.addTiddler({ title: ALERT_REFUSED_PREFIX + kind, text, tags: ["$:/tags/Alert"], component: name, modified: new Date() });
  };
  const notify = (title: string, variables = "{}"): void => {
    const record = NOTIFY_PREFIX + next();
    wiki.addTiddler({ title: record, text: title, "lar-variables": variables });
    setTimeout(() => wiki.deleteTiddler(record), tw.config?.preferences?.notificationDuration ?? 3000);
  };

  /** Ask the surface for a door; the answer runs `then` with the status, and a refusal raises the kind's alert. */
  const ask = (message: string, kind: string, args: Args, then: (status: string) => void = () => {}): void => {
    const door = tw.lares?.["serviceDoor"] as Door | undefined;
    const settle = (status: string): void => {
      if (status !== "ok") alert(kind, `This surface opens no ${kind} door: ${message} refused (${status}).`);
      then(status);
    };
    if (!door) { settle("page-action-unavailable"); return; }
    door.ask(kind, args, settle);
  };
  /** Only the named fields that stand, as strings. */
  const present = (from: Record<string, string> | undefined, names: readonly string[]): Args =>
    Object.fromEntries(names.filter((n) => from?.[n] !== undefined && from[n] !== "").map((n) => [n, String(from![n])]));

  // ── Pure wiki logic ───────────────────────────────────────────────────────────────────────────

  const rename = (method: "renameTiddler" | "relinkTiddler") => (event: WidgetEvent): void => {
    const p = event.paramObject ?? {};
    const from = p["from"] ?? event.tiddlerTitle;
    if (!from || !p["to"]) return;
    wiki[method](from, p["to"], {
      dontRenameInTags: p["renameInTags"] === "false" || p["renameInTags"] === "no",
      dontRenameInLists: p["renameInLists"] === "false" || p["renameInLists"] === "no",
    });
  };
  root.addEventListener("tm-rename-tiddler", rename("renameTiddler"));
  root.addEventListener("tm-relink-tiddler", rename("relinkTiddler"));

  root.addEventListener("tm-home", () => {
    const story = tw.hooks.invokeHook("th-opening-default-tiddlers-list", wiki.filterTiddlers(wiki.getTiddlerText("$:/DefaultTiddlers") ?? ""));
    wiki.addTiddler({ title: "$:/StoryList", text: "", list: story, ...wiki.getModificationFields() });
    if (story[0]) wiki.addToHistory(story[0]);
  });

  const modal = (title: string, event: WidgetEvent): void => {
    wiki.addTiddler({ title: MODAL_PREFIX + next(), text: title, "lar-variables": variablesOf(event) });
  };
  root.addEventListener("tm-modal", (event) => { if (event.param) modal(event.param, event); });
  root.addEventListener("tm-show-switcher", (event) => modal(SWITCHER, event));
  root.addEventListener("tm-notify", (event) => { if (event.param) notify(event.param, variablesOf(event)); });

  // The node a stock scroller reads off the event: the island names it by the render id the page holds.
  const ridSelector = (event: WidgetEvent): string | undefined => {
    const rid = event.target?.attributes?.["data-lar-rid"] ?? event.event?.target?.attributes?.["data-lar-rid"];
    return rid === undefined ? undefined : `[data-lar-rid="${rid}"]`;
  };
  root.addEventListener("tm-scroll", (event) => {
    const selector = event.paramObject?.["selector"] || ridSelector(event);
    if (selector) wiki.addTiddler({ title: HINT_SCROLL, selector, seq: next() });
  });
  root.addEventListener("tm-focus-selector", (event) => {
    if (!event.param) return;
    wiki.addTiddler({ title: HINT_FOCUS, selector: event.param, seq: next(), ...present(event.paramObject, ["preventScroll"]) });
  });

  // ── Host doors ────────────────────────────────────────────────────────────────────────────────

  root.addEventListener("tm-copy-to-clipboard", (event) => {
    const p = event.paramObject ?? {};
    ask(event.type, "clipboard", { text: event.param ?? "", ...(p["plainText"] ? { plainText: true } : {}) }, (status) => {
      notify(status === "ok" ? p["successNotification"] || COPY_OK : p["failureNotification"] || COPY_FAILED);
    });
  });
  root.addEventListener("tm-download-file", (event) => {
    const template = event.param || DEFAULT_SAVE_TEMPLATE;
    const variables = event.paramObject ?? {};
    const type = variables["type"] || "text/plain";
    ask(event.type, "download", {
      filename: variables["filename"] || template,
      text: wiki.renderTiddler("text/plain", template, { variables }),
      type,
    });
  });
  root.addEventListener("tm-open-window", (event) => {
    const title = event.param || event.tiddlerTitle || "";
    ask(event.type, "open-surface", { title, ...present(event.paramObject, ["template", "windowTitle", "windowID", "width", "height"]) });
  });
  root.addEventListener("tm-open-external-window", (event) => {
    ask(event.type, "open-external", { url: event.param || DEFAULT_EXTERNAL, ...present(event.paramObject, ["windowName", "windowFeatures"]) });
  });
  root.addEventListener("tm-print", (event) => ask(event.type, "print", {}));
  root.addEventListener("tm-full-screen", (event) => {
    ask(event.type, "fullscreen", { mode: event.param === "enter" || event.param === "exit" ? event.param : "toggle" });
  });

  // ── Refused by name ───────────────────────────────────────────────────────────────────────────

  root.addEventListener("tm-http-request", (event) => {
    const url = event.paramObject?.["url"] ?? "";
    alert("http-request", `tm-http-request refuses under the Web3-only law: this wiki makes no HTTP request${url ? ` (${url})` : ""}.`);
  });
}
