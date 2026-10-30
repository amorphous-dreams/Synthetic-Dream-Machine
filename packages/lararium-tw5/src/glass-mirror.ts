import { TW5Engine } from "./tw5-vm.js";
import { MIRROR_TOKEN } from "./glass-token.js";
import { makeGlassPortAdaptor } from "./glass-port-adaptor.js";
import type { GlassPortOptions } from "./glass-port-adaptor.js";
import { mountGlassCamera } from "./glass-camera.js";

export interface MirrorSeams {
  bootEngine?: () => void | Promise<void>; paint?: () => void;
  /** Runs on each record an adaptor of this mirror lands; the listener stands before the port's first message can arrive. */
  landed?: (change: { title: string }) => void;
  /** Runs when the island refuses a write the mirror sent: the person's edit did not stand. */
  refused?: (result: { title: string; txId: string; reason: string }) => void;
}
type Adaptor = ReturnType<typeof makeGlassPortAdaptor>;
const nameOf = (error: unknown): string => error instanceof Error ? error.name : "Error";

const HOUSE = "lar:///ha.ka.ba/lararium/plugins/lares/memetic-wikitext";
/**
 * THE CENSUS AND THE GATE, before any module evaluates. A plugin carrying a `syncadaptor` or a `saver` shadow refuses by that
 * name: the mirror is fed by the port alone. Every other person's plugin (not the house plugin, not the core) evaluates only on
 * a vessel whose boot inputs carry `sealedRest` (the browser store's sealed-rest capability, S's row); until then the gate holds it
 * by its own name and never defaults open. The inputs come from the vessel, never from a page value.
 */
function censusPreloads(preloads: Record<string, unknown>[], sealedRest: boolean) {
  const refused: { title: string; kind: string }[] = [];
  const accepted = preloads.filter(plugin => {
    const title = String(plugin.title ?? "");
    if (plugin["plugin-type"] !== "plugin") return true;
    let shadows: Record<string, unknown> = {};
    try { shadows = (JSON.parse(String(plugin.text ?? "{}")) as { tiddlers?: Record<string, unknown> }).tiddlers ?? {}; }
    catch { /* Invalid plugin content is left to the engine. */ }
    const dangerous = Object.values(shadows).some(value => value && typeof value === "object" && ["syncadaptor", "saver"].includes(String((value as Record<string, unknown>)["module-type"])));
    const kind = dangerous ? "plugin-syncadaptor" : !sealedRest && title !== HOUSE && title !== "$:/core" ? "plugin-gate" : "";
    if (kind) refused.push({ title, kind });
    return !kind;
  });
  return { accepted, refused };
}

/**
 * The one door through which a main-thread engine boots: engine, port adaptor and camera open together and close
 * in reverse. The caller holds the D2 port binding and passes it as the transport; the mirror reads and writes
 * through that port alone. `deferPaint` leaves the camera unmounted until `paint()` runs, so a caller can
 * wait for the port's first snapshot before it paints.
 */
export async function openMirror(options: Omit<GlassPortOptions, "wiki" | "Tiddler" | "adopt" | "inheritTags" | "inheritDeferred"> & {
  inputs: { coreBytes: Uint8Array; coreCid: string; preloadedTiddlers: Record<string, unknown>[]; sealedRest?: boolean };
  shadowRoot: ShadowRoot;
  deferPaint?: boolean;
}, seams: MirrorSeams = {}) {
  const engine = new TW5Engine();
  let adaptor: Adaptor | undefined;
  let camera: ReturnType<typeof mountGlassCamera> | undefined;
  let closed = false;
  const unmount = () => {
    if (closed) return;
    closed = true;
    camera?.unmount(); adaptor?.close(); engine.dispose(); engine.releaseGlass();
  };
  const paint = () => {
    if (camera || closed) return;
    try { seams.paint?.(); camera = mountGlassCamera({ tw: engine.$tw, shadowRoot: options.shadowRoot }); }
    catch (error) { options.shadowRoot.replaceChildren(); throw new Error(`mirror-paint-threw:${nameOf(error)}`); }
  };
  try {
    try {
      await seams.bootEngine?.();
      const census = censusPreloads(options.inputs.preloadedTiddlers, options.inputs.sealedRest === true);
      await engine.boot({ bytes: options.inputs.coreBytes, sha256: options.inputs.coreCid }, census.accepted, MIRROR_TOKEN);
      const tw = engine.$tw;
      for (const refusal of census.refused) tw.wiki.addTiddler(new tw.Tiddler({ title: `$:/temp/lares/alert/refused/${refusal.kind}/${refusal.title}`, text: `Plugin refused: ${refusal.title}`, tags: ["$:/tags/Alert"] }));
      if (census.refused.length) options.shadowRoot.host.setAttribute("data-lar-refused-plugins", String(census.refused.length));
      const runtime = tw as unknown as { syncer?: unknown; syncadaptor?: unknown };
      if (runtime.syncer !== undefined || runtime.syncadaptor !== undefined) throw new Error("syncer-stood");
    } catch (error) { if (error instanceof Error && error.message === "syncer-stood") throw error; throw new Error(`mirror-engine-refused:${nameOf(error)}`); }
    const tw = engine.$tw;
    adaptor = makeGlassPortAdaptor({ ...options, wiki: tw.wiki, Tiddler: tw.Tiddler });
    if (seams.landed) adaptor.onLanded(seams.landed);
    if (seams.refused) adaptor.onRefused(seams.refused);
    if (!options.deferPaint) paint();
    return {
      tw, get adaptor() { return adaptor!; }, paint, unmount,
      /** Close the port and open a fresh one on the same engine; unsettled writes resend under their txId. */
      reopen(next: { transport: GlassPortOptions["transport"]; portId: string; width: GlassPortOptions["width"] }) {
        const adopt = adaptor!.pendingWrites();
        const inheritTags = adaptor!.tagImages();
        const inheritDeferred = adaptor!.deferredTitles();
        adaptor!.close();
        adaptor = makeGlassPortAdaptor({ ...options, ...next, wiki: tw.wiki, Tiddler: tw.Tiddler, adopt, inheritTags, inheritDeferred });
        if (seams.landed) adaptor.onLanded(seams.landed);
        if (seams.refused) adaptor.onRefused(seams.refused);
        return adaptor;
      },
    };
  } catch (error) { unmount(); throw error; }
}
