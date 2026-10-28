import { TW5Engine } from "./tw5-vm.js";
import { MIRROR_TOKEN } from "./glass-token.js";
import { makeGlassPortAdaptor } from "./glass-port-adaptor.js";
import type { GlassPortOptions } from "./glass-port-adaptor.js";
import { mountGlassCamera } from "./glass-camera.js";

export interface MirrorSeams {
  bootEngine?: () => void | Promise<void>; paint?: () => void;
  /** Runs on each record an adaptor of this mirror lands; the listener stands before the port's first message can arrive. */
  landed?: (change: { title: string }) => void;
}
type Adaptor = ReturnType<typeof makeGlassPortAdaptor>;
const nameOf = (error: unknown): string => error instanceof Error ? error.name : "Error";

/**
 * The one door through which a main-thread engine boots: engine, port adaptor and camera open together and close
 * in reverse. The caller holds the D2 port binding and passes it as the transport; the mirror reads and writes
 * through that port alone. `deferPaint` leaves the camera unmounted until `paint()` runs, so a caller can
 * wait for the port's first snapshot before it paints.
 */
export async function openMirror(options: Omit<GlassPortOptions, "wiki" | "Tiddler" | "adopt" | "inheritTags"> & {
  inputs: { coreBytes: Uint8Array; coreCid: string; preloadedTiddlers: Record<string, unknown>[] };
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
      await engine.boot({ bytes: options.inputs.coreBytes, sha256: options.inputs.coreCid }, options.inputs.preloadedTiddlers, MIRROR_TOKEN);
    } catch (error) { throw new Error(`mirror-engine-refused:${nameOf(error)}`); }
    const tw = engine.$tw;
    adaptor = makeGlassPortAdaptor({ ...options, wiki: tw.wiki, Tiddler: tw.Tiddler });
    if (seams.landed) adaptor.onLanded(seams.landed);
    if (!options.deferPaint) paint();
    return {
      tw, get adaptor() { return adaptor!; }, paint, unmount,
      /** Close the port and open a fresh one on the same engine; unsettled writes resend under their txId. */
      reopen(next: { transport: GlassPortOptions["transport"]; portId: string; width: GlassPortOptions["width"] }) {
        const adopt = adaptor!.pendingWrites();
        const inheritTags = adaptor!.tagImages();
        adaptor!.close();
        adaptor = makeGlassPortAdaptor({ ...options, ...next, wiki: tw.wiki, Tiddler: tw.Tiddler, adopt, inheritTags });
        if (seams.landed) adaptor.onLanded(seams.landed);
        return adaptor;
      },
    };
  } catch (error) { unmount(); throw error; }
}
