/**
 * nodeWorkerHandle — wrap a worker_threads Worker as a platform-blind
 * VesselWorkerHandle (mesh). Shared by the daemon VM wrapper and the island pool.
 */

import { Worker, MessageChannel } from "worker_threads";
import { type VesselWorkerHandle, type EdgeStanding, type IslandMsg_CasWant, type IslandMsg_CasBlock, type IslandMsg_DyadAsk, type IslandMsg_DyadRead, type IslandMsg_DocRest, type IslandMsg_DocRested, type CustodyWriteCarrier, type IslandMsg_CustodyWrite, type IslandMsg_CustodyWritten } from "@lararium/mesh";

/** The vessel's answer to a worker's `cas:want` — verified bytes, or null (a miss stays a miss). */
export type CasDoor = (cid: string) => Promise<Uint8Array | null>;

// THE FETCH DOOR, vessel side. ONE cid plane per vessel, so ONE door: the daemon island and each wiki island ask
// through it (a session island reaches no vessel door). `null` (the boot default) answers every ask with a
// miss at once — a worker's resolver then degenerates to its local read, exactly as before the door stood.
let casDoor: CasDoor | null = null;

/** Stand (or drop) the vessel's fetch door. Set once the transport stands; cleared at close. */
export function setCasDoor(door: CasDoor | null): void { casDoor = door; }

/** Ask the vessel's fetch door for the bytes a cid names. No door standing, or a faulting one, reads as a miss. */
export function fetchThroughCasDoor(cid: string): Promise<Uint8Array | null> {
  const door = casDoor;
  return door ? door(cid).catch(() => null) : Promise.resolve(null);
}

/** Answer a worker's `cas:want` on the same requestId — through the door when one stands, else a miss. */
function attachCasDoor(w: Worker): void {
  w.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_CasWant> | null;
    if (!m || m.type !== "cas:want" || typeof m.requestId !== "string" || typeof m.cid !== "string") return;
    const { requestId, cid } = m;
    const answer = (bytes: Uint8Array | null): void => {
      const reply: IslandMsg_CasBlock = { type: "cas:block", requestId, bytes };
      try { w.postMessage(reply); } catch { /* the worker went away — nothing to answer */ }
    };
    const door = casDoor;
    if (!door) { answer(null); return; }
    door(cid).then(answer, () => answer(null));   // a faulting door reads as a miss, never a worker fault
  });
}

/** The vessel's answer to a worker's `doc:rest` — resolves once every named document rests in the vessel's store. */
export type RestDoor = (documentIds: readonly string[], heads?: Readonly<Record<string, readonly string[]>>) => Promise<void>;

// THE REST DOOR, vessel side. A worker's Repo holds no store for the documents it mints beside its own bag: the
// vessel's Repo saves them. ONE store per vessel, so ONE door, stood with the composition and dropped at its
// teardown. No door standing answers every ask `rested: false` — a pointer never lands on an unacknowledged save.
let restDoor: RestDoor | null = null;

/** Stand (or drop) the vessel's rest door. */
export function setRestDoor(door: RestDoor | null): void { restDoor = door; }

/** Answer one `doc:rest` ask through the door standing now. Exported so a test asks it without a worker. */
export async function answerDocRest(ask: Pick<IslandMsg_DocRest, "requestId" | "documentIds" | "heads">): Promise<IslandMsg_DocRested> {
  const base = { type: "doc:rested" as const, requestId: ask.requestId };
  const door = restDoor;
  if (!door) return { ...base, rested: false, why: "no rest door stands on this vessel" };
  try { await door(ask.documentIds, ask.heads); return { ...base, rested: true, proof: { documentIds: [...ask.documentIds] } }; }
  catch (e) { return { ...base, rested: false, why: e instanceof Error ? e.message : String(e) }; }
}

/** The vessel's answer to a worker's `custody:write` — seals the bytes under the vessel key. */
export type CustodyWriteDoor = (carrier: CustodyWriteCarrier, bytes: Uint8Array) => Promise<void>;

/** The vessel's reading of one device edge on one fleet root. */
export type DyadDoor = (fleetRoot: string, deviceKey: string) => EdgeStanding | Promise<EdgeStanding>;
let dyadDoor: DyadDoor | null = null;

/** Stand (or drop) the vessel's dyad reading door. */
export function setDyadDoor(door: DyadDoor | null): void { dyadDoor = door; }

/** Answer one dyad ask through the vessel's live board, failing closed on missing or malformed readings. */
export async function answerDyadAsk(ask: Pick<IslandMsg_DyadAsk, "requestId" | "fleetRoot" | "deviceKey">): Promise<IslandMsg_DyadRead> {
  const base = { type: "dyad:read" as const, requestId: ask.requestId };
  if (typeof ask.fleetRoot !== "string" || typeof ask.deviceKey !== "string") return { ...base, standing: "aside" };
  const door = dyadDoor;
  if (!door) return { ...base, standing: "aside" };
  try {
    const standing = await door(ask.fleetRoot, ask.deviceKey);
    return { ...base, standing: standing === "clear" || standing === "aside" || standing === "owing" || standing === "returned" || standing === "unknown" ? standing : "aside" };
  } catch { return { ...base, standing: "aside" }; }
}

function attachDyadDoor(w: Worker): void {
  w.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_DyadAsk> | null;
    if (!m || m.type !== "dyad:ask" || typeof m.requestId !== "string") return;
    void answerDyadAsk({ requestId: m.requestId, fleetRoot: m.fleetRoot as string, deviceKey: m.deviceKey as string }).then((reply) => {
      try { w.postMessage(reply); } catch { /* the worker went away — nothing to answer */ }
    });
  });
}

// THE CUSTODY WRITE DOOR, vessel side. The daemon island holds bytes but never the vessel key; the main thread seals
// them. The DAEMON island's channel alone carries the ask (`IslandClass`): a wiki island's ask refuses by name.
let custodyWriteDoor: CustodyWriteDoor | null = null;

/** Stand (or drop) the vessel's custody write door. */
export function setCustodyWriteDoor(door: CustodyWriteDoor | null): void { custodyWriteDoor = door; }

/** Answer one `custody:write` ask through the door standing now. */
export async function answerCustodyWrite(ask: Pick<IslandMsg_CustodyWrite, "requestId" | "carrier" | "bytes">): Promise<IslandMsg_CustodyWritten> {
  const base = { type: "custody:written" as const, requestId: ask.requestId };
  if (ask.carrier !== "veil" || !(ask.bytes instanceof Uint8Array)) {
    return { ...base, written: false, why: "bad custody write ask" };
  }
  const door = custodyWriteDoor;
  if (!door) return { ...base, written: false, why: "no custody write door stands on this vessel" };
  try { await door(ask.carrier, ask.bytes); return { ...base, written: true }; }
  catch (e) { return { ...base, written: false, why: e instanceof Error ? e.message : String(e) }; }
}

function attachCustodyWriteDoor(w: Worker): void {
  w.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_CustodyWrite> | null;
    if (!m || m.type !== "custody:write" || typeof m.requestId !== "string") return;
    void answerCustodyWrite({ requestId: m.requestId, carrier: m.carrier as CustodyWriteCarrier, bytes: m.bytes as Uint8Array }).then((reply) => {
      try { w.postMessage(reply); } catch { /* the worker went away — nothing to answer */ }
    });
  });
}

function attachRestDoor(w: Worker): void {
  w.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_DocRest> | null;
    if (!m || m.type !== "doc:rest" || typeof m.requestId !== "string" || !Array.isArray(m.documentIds)) return;
    if (!m.documentIds.every((id) => typeof id === "string")) return;
    void answerDocRest({ requestId: m.requestId, documentIds: m.documentIds, ...(m.heads && typeof m.heads === "object" ? { heads: m.heads } : {}) }).then((reply) => {
      try { w.postMessage(reply); } catch { /* the worker went away — nothing to answer */ }
    });
  });
}

/**
 * THE CLASS OF ISLAND A WORKER STANDS AS, named at its spawn. Each class reaches the vessel doors it owns and no other:
 *
 *   daemon   the vessel's own immune core. It reaches all four: the fetch door, the rest door (it mints the
 *            binding documents the vessel's store saves), the custody write door (its keyhive archive exports
 *            cross to the main thread, which alone holds the vessel key and seals them) and the dyad door (its
 *            gates ask what one device's edge reads on the fleet board the main thread folds; no door standing,
 *            a door that faults and a malformed ask each read `aside`).
 *   wiki     an island that runs a wiki's content and plugins. It reaches the fetch door alone, for the blobs its
 *            own tiddlers name. Its custody write and its rest ask each refuse BY NAME on the same request id, and
 *            each refusal logs once per worker: code a wiki loads never writes a row under the vessel key and
 *            never drives the vessel's store. Its dyad ask draws `aside` and logs the same way: a wiki never
 *            learns what a device's edge reads.
 *   session  a session's island. It reaches none of the four and draws no answer: it asks through its scoped
 *            view alone.
 *
 * The class binds at the spawn and never moves: a worker carries no way to name itself another class.
 */
export type IslandClass = "daemon" | "wiki" | "session";

/** Answer a door a wiki island may not use: the same reply shape the door gives, refused by name, logged once. */
function attachRefusals(w: Worker): void {
  const logged = new Set<string>();
  const once = (name: string, door: string): void => {
    if (logged.has(name)) return;
    logged.add(name);
    console.warn(`[vessel-door] ${name}: a wiki island asked the ${door}; only the daemon island reaches it. The ask refused and nothing ran.`);
  };
  const reply = (msg: unknown): void => { try { w.postMessage(msg); } catch { /* the worker went away */ } };
  w.on("message", (raw: unknown) => {
    const m = raw as { type?: unknown; requestId?: unknown } | null;
    if (!m || typeof m !== "object" || typeof m.requestId !== "string") return;
    if (m.type === "custody:write") {
      once("CustodyDoorRefused", "custody write door");
      const refused: IslandMsg_CustodyWritten = {
        type: "custody:written", requestId: m.requestId, written: false,
        why: "CustodyDoorRefused: only the daemon island reaches the custody write door",
      };
      reply(refused);
    } else if (m.type === "doc:rest") {
      once("RestDoorRefused", "rest door");
      const refused: IslandMsg_DocRested = {
        type: "doc:rested", requestId: m.requestId, rested: false,
        why: "RestDoorRefused: only the daemon island reaches the rest door",
      };
      reply(refused);
    } else if (m.type === "dyad:ask") {
      once("DyadDoorRefused", "dyad door");
      const refused: IslandMsg_DyadRead = {
        type: "dyad:read", requestId: m.requestId, standing: "aside",
      };
      reply(refused);
    }
  });
}

/** Wrap a worker as a handle, attaching the vessel doors its class owns ({@link IslandClass}). */
export function nodeWorkerHandle(w: Worker, opts: { readonly island: IslandClass }): VesselWorkerHandle {
  if (opts.island === "daemon") {
    attachCasDoor(w);
    attachDyadDoor(w);
    attachRestDoor(w);
    attachCustodyWriteDoor(w);
  } else if (opts.island === "wiki") {
    attachCasDoor(w);
    attachRefusals(w);
  }
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

/** Spawn the vessel's DAEMON island: the one worker that reaches every vessel door. */
export function nodeSpawnDaemonWorker(url: string | URL, workerData?: unknown): VesselWorkerHandle {
  return nodeWorkerHandle(new Worker(url, workerData !== undefined ? { workerData } : undefined), { island: "daemon" });
}

/** Spawn a WIKI island: a worker that reaches the fetch door alone. */
export function nodeSpawnWikiWorker(url: string | URL): VesselWorkerHandle {
  return nodeWorkerHandle(new Worker(url), { island: "wiki" });
}

/** Spawn a SESSION's island: a worker that takes none of the vessel's own doors. */
export function nodeSpawnSessionWorker(url: string | URL): VesselWorkerHandle {
  return nodeWorkerHandle(new Worker(url), { island: "session" });
}
