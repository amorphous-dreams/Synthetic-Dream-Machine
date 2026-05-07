/**
 * Node-scoped projection kinds.
 *
 * Each builder closes over platform-bound deps (filesystem roots, TW5 render
 * functions) and returns a LarProjectionKind that the registry can call.
 *
 * Browser peers register a different set of builders (e.g. OPFS export, IDB
 * mirror) — the registry shape stays identical.
 */

import type { LarProjectionKind, ReadinessMap } from "@lararium/core";
import { LarDiskProjector } from "./disk-projector.js";

export interface DiskKindDeps {
  /** Default root if config.fields["root"] is absent. */
  defaultLaresRoot: string;
  /** Render a parent URI to its carrier text string. Closes over the TW5 engine. */
  renderFn: (parentUri: string) => Promise<string | null>;
  /** Optional readiness map — first flush lights `disk-projector`. */
  readinessMap?: ReadinessMap;
  /** Optional debounce override (ms). */
  debounceMs?: number;
}

/**
 * Build a `disk` projection kind bound to a TW5 render function.
 *
 * Config fields read:
 *   root  — absolute filesystem path (defaults to `defaultLaresRoot`)
 */
export function makeDiskProjectionKind(deps: DiskKindDeps): LarProjectionKind {
  return async (config, peer) => {
    const root = config.fields["root"] ?? deps.defaultLaresRoot;
    const projector = new LarDiskProjector(root, deps.renderFn, deps.debounceMs ?? 1000, deps.readinessMap);
    const stop = projector.start(peer.store);
    return { stop };
  };
}
