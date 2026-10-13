/**
 * browser-dyad-door — THE DYAD DOOR on the browser shore (kapae#/reach).
 *
 * The daemon island's gates ask what one device's edge reads on its fleet's board before they bind this device or
 * seat another. The island runs in a worker; the leaf's read of that board stands in the page. The island posts
 * `dyad:ask` and the leaf answers `dyad:read` with one of four words on the same request id.
 *
 * ── FAIL CLOSED AT EVERY TURN ───────────────────────────────────────────────────────────────────
 * No answer inside the asker's patience reads `aside`. So does an answer outside the four words, a post that
 * throws, a door that faults, a malformed ask, and a leaf that holds no read. No turn reads `clear` by default.
 *
 * ── THE DAEMON ISLAND ALONE ─────────────────────────────────────────────────────────────────────
 * The composer hangs the door on the daemon island's handle at its one spawn seam. A wiki island's handle takes
 * the refusal instead: its ask draws `aside` and one named warning, so code a wiki loads learns no device's
 * standing.
 *
 * ── ONE ISLAND, SEVERAL TABS ────────────────────────────────────────────────────────────────────
 * Under a shared holder one island speaks to every attached tab, each tab answers from its own read, and the
 * first answer on a request id settles the ask. A tab whose read failed answers `aside` and may beat a tab that
 * read `clear`: that costs a refused bind or join, which the next ask repeats. A tab whose read trails another
 * tab's may answer the earlier word: every tab reads its own replica as of its last sync, the same law a lone
 * tab answers under. Routing an ask to one live tab wants the holder to know which ports still live, and the
 * holder keeps no such reading.
 */

import {
  ISLAND_PROTOCOL_VERSION,
  type EdgeStanding,
  type IslandMsg_DyadAsk,
  type IslandMsg_DyadRead,
  type VesselWorkerHandle,
} from "@lararium/mesh";

type BrowserDyadScope = {
  postMessage(msg: unknown): void;
  addEventListener(type: "message", fn: (e: { data: unknown }) => void): void;
};

const isStanding = (value: unknown): value is EdgeStanding =>
  value === "clear" || value === "aside" || value === "owing" || value === "returned";

/** Ask the vessel for one fleet edge; unmatched, malformed, or late replies draw aside. */
export function browserDyadAsker(
  scope: BrowserDyadScope,
  patienceMs = 60_000,
): (fleetRoot: string, deviceKey: string) => Promise<EdgeStanding> {
  const pending = new Map<string, (standing: EdgeStanding) => void>();
  const prefix = crypto.randomUUID();
  let seq = 0;
  scope.addEventListener("message", (event) => {
    const message = event.data as Partial<IslandMsg_DyadRead> | null;
    if (!message || message.type !== "dyad:read" || typeof message.requestId !== "string") return;
    const settle = pending.get(message.requestId);
    if (!settle) return;
    pending.delete(message.requestId);
    settle(isStanding(message.standing) ? message.standing : "aside");
  });

  return (fleetRoot, deviceKey) => new Promise<EdgeStanding>((resolve) => {
    const requestId = `dyad-${prefix}-${++seq}`;
    const timer = setTimeout(() => {
      pending.delete(requestId);
      resolve("aside");
    }, patienceMs);
    pending.set(requestId, (standing) => {
      clearTimeout(timer);
      resolve(standing);
    });
    const ask: IslandMsg_DyadAsk = {
      schema_version: ISLAND_PROTOCOL_VERSION, type: "dyad:ask", requestId, fleetRoot, deviceKey,
    };
    try { scope.postMessage(ask); }
    catch {
      pending.delete(requestId);
      clearTimeout(timer);
      resolve("aside");
    }
  });
}

export type BrowserDyadDoor = (fleetRoot: string, deviceKey: string) => EdgeStanding | Promise<EdgeStanding>;

/** Read one vessel-owned dyad door, refusing absent, malformed, or faulting asks. */
export async function answerBrowserDyadAsk(
  door: BrowserDyadDoor | null,
  ask: Pick<IslandMsg_DyadAsk, "requestId" | "fleetRoot" | "deviceKey">,
): Promise<IslandMsg_DyadRead> {
  const base = { schema_version: ISLAND_PROTOCOL_VERSION, type: "dyad:read" as const, requestId: ask.requestId };
  if (typeof ask.fleetRoot !== "string" || typeof ask.deviceKey !== "string") return { ...base, standing: "aside" };
  if (!door) return { ...base, standing: "aside" };
  try {
    const standing = await door(ask.fleetRoot, ask.deviceKey);
    return { ...base, standing: isStanding(standing) ? standing : "aside" };
  } catch { return { ...base, standing: "aside" }; }
}

/** Attach the daemon island's asks to this vessel's door. */
export function attachBrowserDyadDoor(
  handle: Pick<VesselWorkerHandle, "post" | "listen">,
  door: () => BrowserDyadDoor | null,
): () => void {
  return handle.listen((raw) => {
    const message = raw as Partial<IslandMsg_DyadAsk> | null;
    if (!message || message.type !== "dyad:ask" || typeof message.requestId !== "string") return;
    let activeDoor: BrowserDyadDoor | null;
    try { activeDoor = door(); } catch { activeDoor = null; }
    void answerBrowserDyadAsk(activeDoor, {
      requestId: message.requestId,
      fleetRoot: message.fleetRoot as string,
      deviceKey: message.deviceKey as string,
    }).then((reply) => { try { handle.post(reply); } catch { /* the worker went away */ } });
  });
}

/** Refuse wiki island asks by name; a wiki never learns a device edge's standing. */
export function refuseBrowserDyadAsks(handle: Pick<VesselWorkerHandle, "post" | "listen">): () => void {
  let logged = false;
  return handle.listen((raw) => {
    const message = raw as { type?: unknown; requestId?: unknown } | null;
    if (!message || message.type !== "dyad:ask" || typeof message.requestId !== "string") return;
    if (!logged) {
      logged = true;
      console.warn("[vessel-door] DyadDoorRefused: a wiki island asked the dyad door; only the daemon island reaches it. The ask refused and nothing ran.");
    }
    const reply: IslandMsg_DyadRead = {
      schema_version: ISLAND_PROTOCOL_VERSION, type: "dyad:read", requestId: message.requestId, standing: "aside",
    };
    try { handle.post(reply); } catch { /* the worker went away */ }
  });
}
