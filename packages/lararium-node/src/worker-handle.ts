/**
 * nodeWorkerHandle — wrap a worker_threads Worker as a platform-blind
 * VesselWorkerHandle (mesh). Shared by the daemon VM wrapper and the island pool.
 */

import { Worker, MessageChannel } from "worker_threads";
import { ISLAND_PROTOCOL_VERSION, type VesselWorkerHandle, type IslandMsg_CasWant, type IslandMsg_CasBlock, type IslandMsg_DocRest, type IslandMsg_DocRested } from "@lararium/mesh";

/** The vessel's answer to a worker's `cas:want` — verified bytes, or null (a miss stays a miss). */
export type CasDoor = (cid: string) => Promise<Uint8Array | null>;

// THE FETCH DOOR, vessel side. ONE cid plane per vessel, so ONE door: every worker this process spawns (the
// daemon island and each wiki island) asks through it. `null` (the boot default) answers every ask with a
// miss at once — a worker's resolver then degenerates to its local read, exactly as before the door stood.
let casDoor: CasDoor | null = null;

/** Stand (or drop) the vessel's fetch door. Set once the transport stands; cleared at close. */
export function setCasDoor(door: CasDoor | null): void { casDoor = door; }

/** Answer a worker's `cas:want` on the same requestId — through the door when one stands, else a miss. */
function attachCasDoor(w: Worker): void {
  w.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_CasWant> | null;
    if (!m || m.type !== "cas:want" || typeof m.requestId !== "string" || typeof m.cid !== "string") return;
    const { requestId, cid } = m;
    const answer = (bytes: Uint8Array | null): void => {
      const reply: IslandMsg_CasBlock = { schema_version: ISLAND_PROTOCOL_VERSION, type: "cas:block", requestId, bytes };
      try { w.postMessage(reply); } catch { /* the worker went away — nothing to answer */ }
    };
    const door = casDoor;
    if (!door) { answer(null); return; }
    door(cid).then(answer, () => answer(null));   // a faulting door reads as a miss, never a worker fault
  });
}

/** The vessel's answer to a worker's `doc:rest` — resolves once every named document rests in the vessel's store. */
export type RestDoor = (documentIds: readonly string[]) => Promise<void>;

// THE REST DOOR, vessel side. A worker's Repo holds no store for the documents it mints beside its own bag: the
// vessel's Repo saves them. ONE store per vessel, so ONE door, stood with the composition and dropped at its
// teardown. No door standing answers every ask `rested: false` — a pointer never lands on an unacknowledged save.
let restDoor: RestDoor | null = null;

/** Stand (or drop) the vessel's rest door. */
export function setRestDoor(door: RestDoor | null): void { restDoor = door; }

/** Answer one `doc:rest` ask through the door standing now. Exported so a test asks it without a worker. */
export async function answerDocRest(ask: Pick<IslandMsg_DocRest, "requestId" | "documentIds">): Promise<IslandMsg_DocRested> {
  const base = { schema_version: ISLAND_PROTOCOL_VERSION, type: "doc:rested" as const, requestId: ask.requestId };
  const door = restDoor;
  if (!door) return { ...base, rested: false, why: "no rest door stands on this vessel" };
  try { await door(ask.documentIds); return { ...base, rested: true }; }
  catch (e) { return { ...base, rested: false, why: e instanceof Error ? e.message : String(e) }; }
}

function attachRestDoor(w: Worker): void {
  w.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_DocRest> | null;
    if (!m || m.type !== "doc:rest" || typeof m.requestId !== "string" || !Array.isArray(m.documentIds)) return;
    if (!m.documentIds.every((id) => typeof id === "string")) return;
    void answerDocRest({ requestId: m.requestId, documentIds: m.documentIds }).then((reply) => {
      try { w.postMessage(reply); } catch { /* the worker went away — nothing to answer */ }
    });
  });
}

export function nodeWorkerHandle(w: Worker): VesselWorkerHandle {
  attachCasDoor(w);
  attachRestDoor(w);
  const post = w.postMessage.bind(w) as (msg: unknown, transfer?: unknown[]) => void;
  return {
    post:      (msg, transfer) => post(msg, transfer),
    listen:    (cb) => { w.on("message", cb); return () => { w.off("message", cb); }; },
    onError:   (cb) => { w.on("error",   cb); return () => { w.off("error",   cb); }; },
    terminate: () => { void w.terminate(); },
  };
}

/** The node island-host parts shared by the daemon VM and the pool: a worker_threads
 *  MessageChannel port pair (the host shore types ports as the global MessagePort), and a
 *  worker_threads Worker spawned + wrapped as a VesselWorkerHandle. */
export function nodeNewSyncChannel(): { mainPort: MessagePort; syncPort: MessagePort } {
  const { port1, port2 } = new MessageChannel();
  return { mainPort: port1 as unknown as MessagePort, syncPort: port2 as unknown as MessagePort };
}

export function nodeSpawnWorker(url: string | URL, workerData?: unknown): VesselWorkerHandle {
  return nodeWorkerHandle(new Worker(url, workerData !== undefined ? { workerData } : undefined));
}
