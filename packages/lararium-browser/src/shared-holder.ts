/**
 * shared-holder — the TAB'S door onto the one-per-origin holder (shared-holder-core.ts).
 *
 * When the engine offers `SharedWorker`, the vessel open connects to the holder script, waits for its greeting,
 * and holds the port: the daemon VM then spawns NO worker of its own — `holderWorkerHandle(port)` wraps the
 * port as the mesh worker-handle shape, so the daemon core's shore stays one shape on both paths.
 *
 * THE FLOOR: an engine without `SharedWorker` (Android Chrome before 148, a host with none) reads
 * `{ kind: "floor", why }` and the vessel open spawns its dedicated worker exactly as today. Never a throw.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/device-capabilities-2026#/moves
 */

import type { VesselWorkerHandle } from "@lararium/mesh";
import type { HolderHello } from "./shared-holder-core.js";

/** The one platform member the door reads — injected so a witness drives a fake. */
export interface SharedWorkerHost {
  readonly SharedWorker?: new (url: string | URL, opts?: { type?: "module"; name?: string }) => { readonly port: MessagePort };
}

/** Read the ambient `SharedWorker`, or nothing where the engine offers none. */
export function ambientSharedWorkerHost(): SharedWorkerHost {
  const g = globalThis as unknown as { SharedWorker?: SharedWorkerHost["SharedWorker"] };
  return g.SharedWorker ? { SharedWorker: g.SharedWorker } : {};
}

export type SharedHolderAttach =
  | { readonly kind: "attached"; readonly port: MessagePort; readonly hello: HolderHello }
  | { readonly kind: "floor";    readonly why: string };

/** Connect to the holder and wait for its greeting; the floor where the engine offers no SharedWorker. */
export async function attachSharedHolder(args: {
  readonly holderUrl: URL;
  readonly host?:     SharedWorkerHost;
  /** How long to wait for the greeting before reading the holder as absent (a script that never answers). */
  readonly helloTimeoutMs?: number;
}): Promise<SharedHolderAttach> {
  const host = args.host ?? ambientSharedWorkerHost();
  if (typeof host.SharedWorker !== "function") {
    return { kind: "floor", why: "this engine offers no SharedWorker; the daemon island rides a dedicated worker as before" };
  }
  let port: MessagePort;
  try {
    port = new host.SharedWorker(args.holderUrl, { type: "module", name: "lares:shared-holder" }).port;
  } catch (e) {
    return { kind: "floor", why: `SharedWorker refused to start (${e instanceof Error ? e.message : String(e)}); the daemon island rides a dedicated worker` };
  }
  const hello = await new Promise<HolderHello | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), args.helloTimeoutMs ?? 5_000);
    const onMsg = (e: MessageEvent): void => {
      const d = e.data as { kind?: unknown };
      if (d && d.kind === "holder:hello") { clearTimeout(timer); port.removeEventListener("message", onMsg); resolve(e.data as HolderHello); }
    };
    port.addEventListener("message", onMsg);
    port.start();
  });
  if (!hello) return { kind: "floor", why: "the shared holder never greeted; the daemon island rides a dedicated worker" };
  return { kind: "attached", port, hello };
}

/** The holder's port as the mesh worker-handle shape — the daemon core's spawn seam on the holder path. */
export function holderWorkerHandle(port: MessagePort): VesselWorkerHandle {
  return {
    post: (msg, transfer) => port.postMessage(msg, (transfer ?? []) as Transferable[]),
    listen: (cb) => {
      const fn = (e: MessageEvent): void => {
        const d = e.data as { kind?: unknown };
        if (d && d.kind === "holder:hello") return;   // the greeting is the door's, never the island's
        cb(e.data);
      };
      port.addEventListener("message", fn);
      port.start();
      return () => port.removeEventListener("message", fn);
    },
    onError: (cb) => {
      const fn = (): void => cb(new Error("[shared-holder] the holder port faulted (messageerror)"));
      port.addEventListener("messageerror", fn);
      return () => port.removeEventListener("messageerror", fn);
    },
    // A tab never terminates the shared island; closing its port is the whole of leaving.
    terminate: () => port.close(),
  };
}
