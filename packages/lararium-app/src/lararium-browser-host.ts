/**
 * @deprecated web2-era — implementation dead. See lararium-browser-host.web2.ts for the original.
 * Rebuild target: swap LarariumCrdtSyncAdaptor → MemeSyncAdaptor, DirectRecipeVm → MemeRecipeVm.
 * Boot sequence and CompositeStore layering are FFZ-aligned — keep contracts, swap deps.
 */

import { useState } from "react";
import type { LarariumOpenPhase } from "@lararium/core";
import { ReadinessMap, CompositeStore } from "@lararium/core";
import type { LarariumTW5 } from "@lararium/tw5";
import type { LarariumRepo } from "./automerge-store.js";

export interface BrowserHostOptions { hostId: string; roomId: string; }

export interface HostOpenState {
  phase:     LarariumOpenPhase | null;
  repo:      LarariumRepo | null;
  store:     CompositeStore | null;
  tw5:       LarariumTW5 | null;
  receipt:   string | null;
  isLive:    boolean;
  readiness: ReadinessMap;
}

/** @deprecated web2-era — stub throws. Rebuild: meme-browser-host.ts */
export function useLarariumHostOpen(_options: BrowserHostOptions): HostOpenState {
  throw new Error("web2-era dead code — rebuild target: meme-browser-host.ts");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_] = useState(null);
}
