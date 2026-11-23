/**
 * The Node process readiness face.
 *
 * `/api/health` reports only whether this selected Node boot path completed its
 * required local setup. It carries no identity, authority, document, Oracle,
 * Pronaos, or causal-freshness claim. Where planes stand held back (pending or
 * degraded, read-only), a `held` note counts them, never naming a document and
 * never flipping liveness: a held plane leaves the vessel ready. Where the vessel
 * arms its engine meter, an `engine` note reads its memory (`engine-meter`): sizes
 * alone, never a document.
 *
 * It binds on a LARARIUM alone. A herm describes nothing to a stranger
 * (pronaos#/the-rung-ladder), and a readiness answer is a self-description, so on
 * a herm the route stays unclaimed and draws the vessel's closed door.
 */

import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { MountManifest } from "@lararium/mesh";
import type { HttpFaceDispatcher } from "./http-face-dispatcher.js";
import { engineFallBody, type EngineWatch } from "./engine-watch.js";

export type NodeReadiness = "starting" | "ready" | "engine-terminated";

export interface ReadinessState {
  readonly status: () => NodeReadiness;
  readonly markReady: () => void;
  /** The engine's fall body where it has fallen (`engine-watch`), else null. */
  readonly fall?: () => Record<string, unknown> | null;
  /** Keep the live manifest for counts of pending and degraded planes. */
  readonly notePlanes?: (manifest: MountManifest) => void;
  /** The planes held back, where any stand; null where none do. */
  readonly held?: () => { readonly pending: number; readonly degraded: number } | null;
  /** The body health answers on GET: the fall's, or the status with any held planes; each carries the engine meter's reading
   *  where a meter stands (`engine-meter`). */
  readonly body?: () => Record<string, unknown>;
}

export interface ReadinessFace {
  readonly dispose: () => void;
}

/**
 * A DEAD ENGINE TAKES HEALTH DOWN. With an `engine` watch, a fall (`engine-watch`) reads `engine-terminated` whatever the
 * boot reached, and the health answer names the cause, its time, the last settled wave, the document in flight and the one
 * hand act. Nothing here restarts anything: the vessel's entry answers the fall (`engine-fall`), flushing and exiting once.
 *
 * With a `meter`, every GET body (the status, or the fall's) carries its reading as `engine`: the engine's wasm memory and
 * node's heap (`engine-meter`). A HEAD probe reads no body and so costs the meter nothing.
 */
export function createReadinessState(engine?: EngineWatch, meter?: () => unknown): ReadinessState & Required<Pick<ReadinessState, "held" | "notePlanes" | "body">> {
  let current: "starting" | "ready" = "starting";
  let planes: MountManifest | null = null;
  const status = (): NodeReadiness => (engine?.fallen() ? "engine-terminated" : current);
  const fall = (): Record<string, unknown> | null => { const fallen = engine?.fallen(); return fallen ? engineFallBody(fallen) : null; };
  const held = (): { pending: number; degraded: number } | null => {
    const pending = planes?.entries.filter((e) => e.status === "pending").length ?? 0;
    const degraded = planes?.entries.filter((e) => e.status === "degraded").length ?? 0;
    return pending + degraded > 0 ? { pending, degraded } : null;
  };
  /** THE ENGINE METER RIDES HEALTH (`engine-meter`): a reading that throws costs the answer nothing, it just goes unsaid. */
  const reading = (): Record<string, unknown> => {
    if (!meter) return {};
    try { return { engine: meter() }; } catch { return {}; }
  };
  return {
    status,
    markReady: () => { current = "ready"; },
    fall,
    held,
    notePlanes: (manifest) => { planes = manifest; },
    body: () => {
      const h = held();
      return { ...(fall() ?? { status: status(), ...(h !== null ? { held: h } : {}) }), ...reading() };
    },
  };
}

/**
 * Mark ready only once the verb dispatcher stands. `dispatcherStands` is the daemon island's `ea`:
 * the island starts its dispatcher, then posts `ea`, so the event orders the two. A verb that
 * arrives while health still reads `starting` has no promise of being run; one that arrives after
 * `ready` meets a live dispatcher. A dispatcher that faults leaves health `starting`.
 */
export async function markReadyOnceStanding(state: ReadinessState, dispatcherStands: Promise<unknown>): Promise<void> {
  await dispatcherStands;
  state.markReady();
}

function answer(res: ServerResponse, state: ReadinessState, method: string): void {
  const ready = state.status() === "ready";
  res.writeHead(ready ? 200 : 503, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  if (method === "HEAD") res.end();
  else if (state.body) res.end(JSON.stringify(state.body()));
  else {
    const held = state.held?.() ?? null;
    res.end(JSON.stringify(state.fall?.() ?? { status: state.status(), ...(held !== null ? { held } : {}) }));
  }
}

/** Mount the exact health route on an existing Node server — on a lararium; a herm mounts nothing. */
export function mountReadinessFace(args: {
  readonly httpServer: Server;
  readonly state: ReadinessState;
  /** What the operator asked this vessel to stand as. Only "lararium" binds the route. */
  readonly standing: "lararium" | "herm";
  readonly dispatcher?: HttpFaceDispatcher;
}): ReadinessFace {
  if (args.standing !== "lararium") return { dispose: () => {} };
  const onRequest = (req: IncomingMessage, res: ServerResponse): void => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (pathname !== "/api/health") return;
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        allow: "GET, HEAD",
      });
      res.end(JSON.stringify({ error: "method not allowed" }));
      return;
    }
    answer(res, args.state, req.method);
  };
  const unregister = args.dispatcher?.register({
    name: "readiness",
    routeKeys: ["readiness:/api/health"],
    owns: (req) => new URL(req.url ?? "/", "http://localhost").pathname === "/api/health",
    handle: onRequest,
  });
  if (!unregister) args.httpServer.on("request", onRequest);
  return { dispose: () => unregister ? unregister() : args.httpServer.off("request", onRequest) };
}
