/**
 * nodeWorkerHandle — wrap a worker_threads Worker as a platform-blind
 * VesselWorkerHandle (mesh). Shared by the daemon VM wrapper and the island pool.
 */

import { Worker, MessageChannel } from "worker_threads";
import { answerReceipt, receiptSettlement, answerDyad, answerCustodyWrite, answerSessionSign, answerRestAsk, type IslandMsg_RestAsk, type VesselWorkerHandle, type CapabilityRecord, type CustodyWriteCarrier, type IslandMsg_CasWant, type IslandMsg_CasBlock, type IslandMsg_DyadAsk, type IslandMsg_DyadRead, type IslandMsg_ReceiptRequest, type IslandMsg_ReceiptIssued, type IslandMsg_CustodyWrite, type IslandMsg_CustodyWritten, type IslandMsg_SessionSign, type IslandMsg_SessionSigned } from "@lararium/mesh";

// The answers stand once on the mesh floor (`capability-record.ts`), so the node and the browser answer one ask alike.
export { answerReceipt, answerDyad, answerCustodyWrite, answerSessionSign };

// THE CAPABILITY RECORD, vessel side (`CapabilityRecord`, mesh). The vessel hands each island ONE record at its spawn;
// every answer below reads the member it needs FROM THAT RECORD at ask time, so a vessel may stand a member after the
// spawn (the transport stands late) and drop it at teardown, and two vessels in one process never share one. No
// module-global stands behind any of the four.

/** Answer a worker's `cas:want` on the same requestId: through the record's `cas` when one stands, else a miss. */
function attachCas(w: Worker, caps: CapabilityRecord): void {
  w.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_CasWant> | null;
    if (!m || m.type !== "cas:want" || typeof m.requestId !== "string" || typeof m.cid !== "string") return;
    const { requestId, cid } = m;
    const answer = (bytes: Uint8Array | null): void => {
      const reply: IslandMsg_CasBlock = { type: "cas:block", requestId, bytes };
      try { w.postMessage(reply); } catch { /* the worker went away — nothing to answer */ }
    };
    const cas = caps.cas;
    if (!cas) { answer(null); return; }
    cas(cid).then(answer, () => answer(null));   // a faulting fetch reads as a miss, never a worker fault
  });
}

function attachReceipt(w: Worker, caps: CapabilityRecord): void {
  const settlement = receiptSettlement(() => { try { w.postMessage({ type: "receipt:close" }); } catch { /* the worker already left */ } });
  w.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_ReceiptRequest> | null;
    if ((raw as { type?: unknown } | null)?.type === "receipt:asks-done") { settlement.asksDone(); return; }
    if (!m || m.type !== "receipt:request" || typeof m.requestId !== "string" || !Array.isArray(m.documentIds)) return;
    if (!m.documentIds.every((id) => typeof id === "string")) return;
    void settlement.answering(answerReceipt(caps, { requestId: m.requestId, documentIds: m.documentIds, ...(m.heads && typeof m.heads === "object" ? { heads: m.heads } : {}) }).then((reply) => {
      try { w.postMessage(reply); } catch { /* the worker went away — nothing to answer */ }
    }, () => {
      try { w.postMessage({ type: "receipt:issued", requestId: m.requestId, issued: false }); } catch { /* the worker already left */ }
    }));
  });
}

function attachDyad(w: Worker, caps: CapabilityRecord): void {
  w.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_DyadAsk> | null;
    if (!m || m.type !== "dyad:ask" || typeof m.requestId !== "string") return;
    void answerDyad(caps, { requestId: m.requestId, fleetRoot: m.fleetRoot as string, deviceKey: m.deviceKey as string }).then((reply) => {
      try { w.postMessage(reply); } catch { /* the worker went away — nothing to answer */ }
    });
  });
}

function attachCustodyWrite(w: Worker, caps: CapabilityRecord): void {
  w.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_CustodyWrite> | null;
    if (!m || m.type !== "custody:write" || typeof m.requestId !== "string") return;
    void answerCustodyWrite(caps, { requestId: m.requestId, carrier: m.carrier as CustodyWriteCarrier, bytes: m.bytes as Uint8Array }).then((reply) => {
      try { w.postMessage(reply); } catch { /* the worker went away — nothing to answer */ }
    });
  });
}

// THE SESSION SIGN DOOR, vessel side (`session-sign-door.ts`). The daemon island names the invocation a session placed;
// the vessel's book answers from that session's signer, which signs here, behind its owner's table. The DAEMON island's
// channel alone carries the ask: a wiki island's refuses by name.
function attachSessionSignDoor(w: Worker, caps: CapabilityRecord): void {
  const logged = { once: false };
  w.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_SessionSign> | null;
    if (!m || m.type !== "session:sign" || typeof m.requestId !== "string") return;
    if (!caps.sessionSign && !logged.once) {
      logged.once = true;
      console.warn("[vessel-caps] SessionSignDoorRefused: a daemon island asked for the sessionSign capability; this record carries none (a herm floor signs nothing; only a lifted floor does). The ask refused and nothing ran.");
    }
    void answerSessionSign(caps, m as Partial<IslandMsg_SessionSign> & { requestId: string }).then((reply) => {
      try { w.postMessage(reply); } catch { /* the worker went away — nothing to answer */ }
    });
  });
}

/**
 * THE CLASS OF ISLAND A WORKER STANDS AS, named at its spawn. Each class reaches the capabilities it owns and no other,
 * and each reaches them only through the record its vessel handed it:
 *
 *   daemon   the vessel's own immune core. It reaches all four: `cas`, `receipt` (it mints the binding documents the
 *            vessel's store saves), `custodyWrite` (its keyhive archive exports cross to the main thread, which alone
 *            holds the vessel key and seals them) and `dyad` (its gates ask what one device's edge reads on the fleet
 *            board the main thread folds; no `dyad` standing, one that faults and a malformed ask each read `aside`).
 *            It also reaches `sessionSign` where its record carries one: a LIFT member (a herm floor signs nothing).
 *   wiki     an island that runs a wiki's content and plugins. It reaches `cas` alone, for the blobs its own tiddlers
 *            name. Its custody write and its receipt ask each refuse BY NAME on the same request id, and each refusal
 *            logs once per worker: code a wiki loads never writes a row under the vessel key and never drives the
 *            vessel's store. Its dyad ask draws `aside` and logs the same way: a wiki never learns what a device's
 *            edge reads.
 *   session  a session's island. It reaches none of the four and draws no answer: it asks through its scoped
 *            view alone.
 *
 * The class binds at the spawn and never moves: a worker carries no way to name itself another class.
 */
export type IslandClass = "daemon" | "wiki" | "session";

/** Answer a capability a wiki island may not use: the same reply shape the capability gives, refused by name, logged once. */
function attachRefusals(w: Worker, caps: CapabilityRecord): void {
  const logged = new Set<string>();
  const once = (name: string, what: string): void => {
    if (logged.has(name)) return;
    logged.add(name);
    console.warn(`[vessel-caps] ${name}: a wiki island asked for ${what}; only the daemon island reaches it. The ask refused and nothing ran.`);
  };
  const reply = (msg: unknown): void => { try { w.postMessage(msg); } catch { /* the worker went away */ } };
  w.on("message", (raw: unknown) => {
    const m = raw as { type?: unknown; requestId?: unknown } | null;
    if (!m || typeof m !== "object" || typeof m.requestId !== "string") return;
    if (m.type === "custody:write") {
      once("CustodyWriteRefused", "the custodyWrite capability");
      const refused: IslandMsg_CustodyWritten = {
        type: "custody:written", requestId: m.requestId, written: false,
        why: "CustodyWriteRefused: only the daemon island reaches the custodyWrite capability",
      };
      reply(refused);
    } else if (m.type === "receipt:request") {
      // ONE ANSWERER: where the record grants `receipt`, the pool answers this ask from its main Repo (the handle's
      // `grants` below), so this worker stays silent. It refuses only when ITS record lacks the capability.
      if (caps.receipt) return;
      once("ReceiptRefused", "the receipt capability");
      const refused: IslandMsg_ReceiptIssued = {
        type: "receipt:issued", requestId: m.requestId, issued: false,
        why: "ReceiptRefused: this island's record carries no receipt capability",
      };
      reply(refused);
    } else if (m.type === "session:sign") {
      once("SessionSignDoorRefused", "the session sign door");
      const refused: IslandMsg_SessionSigned = { type: "session:signed", requestId: m.requestId, refusal: "signer-unavailable" };
      reply(refused);
    } else if (m.type === "dyad:ask") {
      once("DyadRefused", "the dyad capability");
      const refused: IslandMsg_DyadRead = {
        type: "dyad:read", requestId: m.requestId, standing: "aside",
      };
      reply(refused);
    }
  });
}

// THE REST ASK, vessel side (sealed-store#/owed, V2): every island with a store of its own (the daemon island's owned
// store, a wiki island's) asks before it rests a byte of a document, and the vessel answers from its Repo's sealed rest.
function attachRestAsk(w: Worker, caps: CapabilityRecord): void {
  w.on("message", (raw: unknown) => {
    const m = raw as Partial<IslandMsg_RestAsk> | null;
    if (!m || m.type !== "rest:ask" || typeof m.requestId !== "string") return;
    void answerRestAsk(caps, m as Partial<IslandMsg_RestAsk> & { requestId: string }).then((reply) => {
      try { w.postMessage(reply); } catch { /* the worker went away — nothing to answer */ }
    });
  });
}

/**
 * Wrap a worker as a handle, binding the capability record its vessel handed it and attaching the answers its class
 * owns ({@link IslandClass}). No record handed reads as an empty one: every ask answers absent.
 */
export function nodeWorkerHandle(w: Worker, opts: { readonly island: IslandClass; readonly caps?: CapabilityRecord }): VesselWorkerHandle {
  const caps = opts.caps ?? {};
  if (opts.island === "daemon") {
    attachCas(w, caps);
    attachDyad(w, caps);
    attachReceipt(w, caps);
    attachCustodyWrite(w, caps);
    attachSessionSignDoor(w, caps);
    attachDocStore(w, caps);
    attachRestAsk(w, caps);
  } else if (opts.island === "wiki") {
    attachCas(w, caps);
    attachRefusals(w, caps);
    attachRestAsk(w, caps);
  }
  const post = w.postMessage.bind(w) as (msg: unknown, transfer?: unknown[]) => void;
  return {
    post:      (msg, transfer) => post(msg, transfer),
    listen:    (cb) => { w.on("message", cb); return () => { w.off("message", cb); }; },
    onError:   (cb) => { w.on("error",   cb); return () => { w.off("error",   cb); }; },
    terminate: () => { void w.terminate(); },
    // The record the island holds, read at ask time: the pool answers a wiki island's receipt ask only where it grants one.
    grants:    () => ({ receipt: opts.island === "wiki" && caps.receipt !== undefined }),
  };
}

/** The node island-host parts shared by the daemon VM and the pool: a worker_threads
 *  MessageChannel port pair (the host shore types ports as the global MessagePort), and a
 *  worker_threads Worker spawned + wrapped as a VesselWorkerHandle. */
export function nodeNewSyncChannel(): { mainPort: MessagePort; syncPort: MessagePort } {
  const { port1, port2 } = new MessageChannel();
  return { mainPort: port1 as unknown as MessagePort, syncPort: port2 as unknown as MessagePort };
}

/** Spawn the vessel's DAEMON island: the one worker that reaches every member of its vessel's capability record. */
export function nodeSpawnDaemonWorker(url: string | URL, caps: CapabilityRecord, workerData?: unknown): VesselWorkerHandle {
  return nodeWorkerHandle(new Worker(url, workerData !== undefined ? { workerData } : undefined), { island: "daemon", caps });
}

/** Spawn a WIKI island: a worker that reaches its record's `cas` alone. */
export function nodeSpawnWikiWorker(url: string | URL, caps: CapabilityRecord, workerData?: unknown): VesselWorkerHandle {
  return nodeWorkerHandle(new Worker(url, workerData !== undefined ? { workerData } : undefined), { island: "wiki", caps });
}

/** Spawn a SESSION's island: a worker that reaches no member of the record. */
export function nodeSpawnSessionWorker(url: string | URL, caps?: CapabilityRecord, workerData?: unknown): VesselWorkerHandle {
  return nodeWorkerHandle(new Worker(url, workerData !== undefined ? { workerData } : undefined), { island: "session", ...(caps ? { caps } : {}) });
}

// THE DOCUMENT STORE'S DOOR, vessel side (`@lararium/mesh` `sealed-rest.ts`). The vessel's Repo seals and opens through
// the holder in its DAEMON island, so the record's `docStore` member attaches to that island's channel as it spawns, and
// detaches when the island goes. A record that carries none attaches nothing.
function attachDocStore(w: Worker, caps: CapabilityRecord): void {
  const docStore = caps.docStore;
  if (!docStore) return;
  const detach = docStore({
    post: (msg) => w.postMessage(msg),
    listen: (cb) => { w.on("message", cb); return () => { w.off("message", cb); }; },
  });
  w.once("exit", () => detach());
}


