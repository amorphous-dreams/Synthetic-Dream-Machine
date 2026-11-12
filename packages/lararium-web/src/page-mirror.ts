import { standMirror, type MirrorState } from "./glass/stand.js";
import type { ReturnTypeOfPagePort } from "./glass/transport-type.js";

type Stand = Parameters<typeof standMirror>[1];
const NONE = (why: string) => ({ kind: "floor" as const, width: "none" as const, why });

interface ReadableEngine { wiki: {
  getTiddlerText(title: string): string | null | undefined; filterTiddlers(filter: string): string[]; getTiddlerList(title: string): string[];
  extractTiddlerDataItem(title: string, index: string): string | undefined; } }
/** What the mirror's engine reads now: the open story, the wiki's own default story, the palette pointer with two of its colours, and the theme's sidebar breakpoint. */
export function mirrorReading(tw: ReadableEngine): { story: string[]; defaults: string[]; palette: string; colours: Record<string, string | null>; breakpoint: string | null } {
  const wiki = tw.wiki;
  const palette = wiki.getTiddlerText("$:/palette") ?? "";
  const colour = (name: string): string | null => (palette ? wiki.extractTiddlerDataItem(palette, name) ?? null : null);
  return { story: wiki.getTiddlerList("$:/StoryList"), defaults: wiki.filterTiddlers(wiki.getTiddlerText("$:/DefaultTiddlers") ?? ""), palette,
    colours: { "tiddler-background": colour("tiddler-background"), "page-background": colour("page-background") },
    breakpoint: wiki.getTiddlerText("$:/themes/tiddlywiki/vanilla/metrics/sidebarbreakpoint") ?? null };
}

/**
 * The page root's one call: stand the mirror for the surface the page shows, from the engine inputs the vessel names for it.
 * The binding arrives explicitly (the root holds it); nothing ambient selects it. The host element carries the outcome in
 * `data-lar-mirror` (`skinny`, `full`, or `none:<why>`), so the page and its tests read one word. A floor leaves the
 * none projection exactly as it stood.
 */
export async function standPageMirror(root: {
  port: ReturnTypeOfPagePort; host: HTMLElement; actor: string;
  surface: () => string | null;
  mirrorInputs: (surface: string) => Promise<{ coreCid: string; pluginCids: readonly string[] } | null>;
  onState?: (state: MirrorState) => void;
}, seams: Stand = {}) {
  // `data-lar-mirror` names the width; `data-lar-shown` names which surface the person reads: the mirror once it stands, else the floor.
  // `data-lar-mirror-why` carries the named reason a mirror holds or steps to skinny (`full-promotion-unfinished`, a capacity error), and
  // stands only while the mirror reads skinny for that reason: a reader never infers why from the width alone.
  const mark = (value: string, why: string | null = null): void => {
    root.host.setAttribute("data-lar-mirror", value);
    root.host.setAttribute("data-lar-shown", value === "skinny" || value === "full" ? "mirror" : "floor");
    if (value === "skinny" && why) root.host.setAttribute("data-lar-mirror-why", why);
    else root.host.removeAttribute("data-lar-mirror-why");
  };
  const surface = root.surface();
  if (surface === null) { mark("none:surface-unknown"); return NONE("surface-unknown"); }
  const inputs = await root.mirrorInputs(surface);
  if (!inputs) { mark("none:mirror-inputs-absent"); return NONE("mirror-inputs-absent"); }
  const result = await standMirror({ host: root.host, port: root.port, inputs, wikiUri: surface, actor: root.actor,
    ...(root.onState ? { onState: root.onState } : {}) }, seams);
  if (result.kind === "floor") { mark(`none:${result.why}`); return result; }
  mark(result.width);
  // A read-only reading for tests: true once no mirror write waits for its answer and no edit waits behind one.
  Object.defineProperty(root.host, "larMirrorWritesSent", { configurable: true, get: () => result.writesSent() });
  Object.defineProperty(root.host, "larMirrorQuiescent", { configurable: true, get: () => result.quiescent() });
  // A read-only reading for the weld: the story the mirror opened, the wiki's own default story, and the palette its sheet reads.
  Object.defineProperty(root.host, "larMirrorReading", { configurable: true, get: () => mirrorReading(result.tw as unknown as ReadableEngine) });
  // THE PAGE HOLDS ITS LEAVE while a mirror write waits for its answer (the answer comes once the write rests), the law the
  // worker-rendered view kept for a confirmed edit. The browser's own prompt carries it; the pending count at the moment of the leave decides.
  const hold = (event: BeforeUnloadEvent): void => { if (result.pending() > 0) { event.preventDefault(); event.returnValue = ""; } };
  window.addEventListener("beforeunload", hold);
  const letGo = (): void => { window.removeEventListener("beforeunload", hold); };
  const unmountMirror = result.unmount.bind(result);
  result.unmount = () => { unmountMirror(); letGo(); mark("none:unmounted"); };
  result.onEvent(event => { if (event.type === "gone" || event.type === "floor") letGo(); });
  void result.settled.then(outcome => { if (outcome.width === "none") letGo(); });
  result.onEvent(event => { mark(event.type === "promoted" ? "full" : event.type === "stepped" ? "skinny" : `none:${event.why}`, event.type === "stepped" ? event.why : null); });
  void result.settled.then(outcome => { mark(outcome.width === "none" ? `none:${outcome.why ?? "unmounted"}` : outcome.width, outcome.why ?? null); });
  return result;
}
