/** Refuse a wiki island's dyad ask; only the daemon island reads its fleet board. */
import type { IslandMsg_DyadRead, VesselWorkerHandle } from "@lararium/mesh";

export function refuseBrowserDyadAsks(handle: Pick<VesselWorkerHandle, "post" | "listen">): () => void {
  let logged = false;
  return handle.listen((raw) => {
    const message = raw as { type?: unknown; requestId?: unknown } | null;
    if (!message || message.type !== "dyad:ask" || typeof message.requestId !== "string") return;
    if (!logged) {
      logged = true;
      console.warn("[vessel-door] DyadDoorRefused: a wiki island asked for a fleet edge reading. The ask refused and nothing ran.");
    }
    const reply: IslandMsg_DyadRead = { type: "dyad:read", requestId: message.requestId, standing: "aside" };
    try { handle.post(reply); } catch { /* the worker went away */ }
  });
}
