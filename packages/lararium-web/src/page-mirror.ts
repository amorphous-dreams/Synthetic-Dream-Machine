import { standMirror, type MirrorState } from "./glass/stand.js";
import type { ReturnTypeOfPagePort } from "./glass/transport-type.js";

type Stand = Parameters<typeof standMirror>[1];
const NONE = (why: string) => ({ kind: "floor" as const, width: "none" as const, why });

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
  const mark = (value: string): void => {
    root.host.setAttribute("data-lar-mirror", value);
    root.host.setAttribute("data-lar-shown", value === "skinny" || value === "full" ? "mirror" : "floor");
  };
  const surface = root.surface();
  if (surface === null) { mark("none:surface-unknown"); return NONE("surface-unknown"); }
  const inputs = await root.mirrorInputs(surface);
  if (!inputs) { mark("none:mirror-inputs-absent"); return NONE("mirror-inputs-absent"); }
  const result = await standMirror({ host: root.host, port: root.port, inputs, wikiUri: surface, actor: root.actor,
    ...(root.onState ? { onState: root.onState } : {}) }, seams);
  if (result.kind === "floor") { mark(`none:${result.why}`); return result; }
  mark(result.width);
  // THE PAGE HOLDS ITS LEAVE while a mirror write waits for its answer (the answer comes once the write rests), the law the
  // worker-rendered view kept for a confirmed edit. The browser's own prompt carries it; the pending count at the moment of the leave decides.
  const hold = (event: BeforeUnloadEvent): void => { if (result.pending() > 0) { event.preventDefault(); event.returnValue = ""; } };
  window.addEventListener("beforeunload", hold);
  const letGo = (): void => { window.removeEventListener("beforeunload", hold); };
  const unmountMirror = result.unmount.bind(result);
  result.unmount = () => { unmountMirror(); letGo(); mark("none:unmounted"); };
  result.onEvent(event => { if (event.type === "gone" || event.type === "floor") letGo(); });
  void result.settled.then(outcome => { if (outcome.width === "none") letGo(); });
  result.onEvent(event => { mark(event.type === "promoted" ? "full" : event.type === "stepped" ? "skinny" : `none:${event.why}`); });
  void result.settled.then(outcome => { mark(outcome.width === "none" ? `none:${outcome.why ?? "unmounted"}` : outcome.width); });
  return result;
}
