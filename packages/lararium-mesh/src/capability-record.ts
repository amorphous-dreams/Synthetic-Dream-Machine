import type { ShareAudience } from "./share-tighten.js";
import { verifyCidBytes } from "./cas-transit.js";
/**
 * CapabilityRecord — the ONE record a vessel hands an island AT CONSTRUCTION.
 *
 * The vessel holds the authority (its store, its cid plane, its fleet board, its key); an island holds only what its
 * record carries. No process-global setter stands behind it: two vessels in one process hand their islands two
 * records, and a capability one vessel stands never reaches another's island. A member the vessel never stands reads
 * absent, and an ask that needs it refuses by name.
 *
 *   receipt       ask for a durability receipt: resolves once every named document rests in the vessel's store, the
 *                 heads the island holds named beside it. Replaces the four process-global island setters.
 *   cas           the bytes a cid names, or null (a miss stays a miss).
 *   dyad          the vessel's reading of one device edge on one fleet root.
 *   custodyWrite  seal bytes under the vessel key (the daemon island's archive exports cross here).
 *   sessionSign   a LIFT capability: sign through the session that placed a call. A herm is the floor every Lararium
 *                 stands on and signs nothing; only a lifted floor (a Nexus-anchored session) holds this member, so a
 *                 record composed at the floor carries none and the ask refuses by name (`signer-unavailable`).
 *
 * The vessel MAY stand a member after it constructs the island (the transport stands late): the island reads the
 * member from ITS record at ask time, never from shared module state.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/test-recut-road
 */
import type { EdgeStanding } from "./edge-kapae.js";
import type {
  CustodyWriteCarrier, IslandMsg_CasBlock, IslandMsg_CustodyWrite, IslandMsg_CustodyWritten, IslandMsg_DyadAsk, IslandMsg_DyadRead,
  IslandMsg_ReceiptIssued, IslandMsg_ReceiptRequest, IslandMsg_RestAnswer, IslandMsg_RestAsk, IslandMsg_SessionSign, IslandMsg_SessionSigned, SessionOwnChain,
} from "./island-protocol.js";

/** The vessel's answer to an island's receipt ask — resolves once every named document rests in the vessel's store. */
export type ReceiptIssuer = (documentIds: readonly string[], heads?: Readonly<Record<string, readonly string[]>>) => Promise<void>;
/** The vessel's answer to an island's `cas:want` — verified bytes, or null. */
export type CasFetcher = (cid: string, audience: ShareAudience | undefined) => Promise<Uint8Array | null>;
/** The vessel's reading of one device edge on one fleet root. */
export type DyadReader = (fleetRoot: string, deviceKey: string) => EdgeStanding | Promise<EdgeStanding>;
/** The vessel's seal of bytes an island hands across under the vessel key. */
export type CustodyWriter = (carrier: CustodyWriteCarrier, bytes: Uint8Array) => Promise<void>;

/** The vessel's answer to a daemon island's `session:sign` ask — read the booked session, sign through it, or refuse by name. */
export type SessionSignDoor = (ask: Pick<IslandMsg_SessionSign, "op" | "ask" | "verb" | "payload">) => Promise<
  { readonly certificate: unknown; readonly subject: string; readonly chain: SessionOwnChain; readonly foldRead: boolean; readonly counted: readonly string[]; readonly unanswered: readonly string[] }
  | { readonly own: true; readonly chain: SessionOwnChain; readonly foldRead: boolean; readonly counted: readonly string[]; readonly unanswered: readonly string[] }
  | { readonly signature: string } | { readonly refusal: string }>;

export interface CapabilityRecord {
  receipt?: ReceiptIssuer | undefined;
  cas?: CasFetcher | undefined;
  dyad?: DyadReader | undefined;
  custodyWrite?: CustodyWriter | undefined;
  sessionSign?: SessionSignDoor | undefined;
  /** The vessel's document store door (`sealed-rest.ts`): attached to each daemon island's port as it spawns, so the
   *  vessel's Repo seals and opens through the holder there, and the island asks the vessel for a bag's live document.
   *  The answer is the detach. Absent → the vessel's sealed rest reaches no island. */
  docStore?: ((port: { post(msg: unknown): void; listen(cb: (msg: unknown) => void): () => void }) => () => void) | undefined;
  /** V2: does the vessel's rest hold a document sealed? An island asks before its own store rests a byte of it
   *  (`islandRestGuard`, `sealed-rest.ts`). Absent → every document reads unsealed. */
  restsSealed?: ((documentId: string) => Promise<boolean>) | undefined;
}

// ── THE ANSWERS, vessel side ────────────────────────────────────────────────────────────────────────
// Each answer reads the member it needs FROM THE RECORD at ask time, so a vessel may stand a member after the spawn and
// drop it at a lock or a teardown. An absent member refuses by name; a fault reads as the same refusal, never a fault
// the island must survive. Both vessels answer through these (the node over a `worker_threads` port, the browser over
// a Web Worker), so one island ask draws one answer whatever thread hosts the vessel.

/** Answer one `receipt:request`: a record with no `receipt` standing answers `issued: false`, naming the absence. */
export async function answerReceipt(caps: CapabilityRecord, ask: Pick<IslandMsg_ReceiptRequest, "requestId" | "documentIds" | "heads">): Promise<IslandMsg_ReceiptIssued> {
  const base = { type: "receipt:issued" as const, requestId: ask.requestId };
  const receipt = caps.receipt;
  if (!receipt) return { ...base, issued: false, why: "ReceiptCapabilityUnavailable: no receipt capability stands on this vessel" };
  try { await receipt(ask.documentIds, ask.heads); return { ...base, issued: true, proof: { documentIds: [...ask.documentIds] } }; }
  catch (e) { return { ...base, issued: false, why: e instanceof Error ? e.message : String(e) }; }
}

/** Answer one dyad ask, failing closed (`aside`) on a missing capability, a fault or a malformed reading. */
export async function answerDyad(caps: CapabilityRecord, ask: Pick<IslandMsg_DyadAsk, "requestId" | "fleetRoot" | "deviceKey">): Promise<IslandMsg_DyadRead> {
  const base = { type: "dyad:read" as const, requestId: ask.requestId };
  if (typeof ask.fleetRoot !== "string" || typeof ask.deviceKey !== "string") return { ...base, standing: "aside" };
  const dyad = caps.dyad;
  if (!dyad) return { ...base, standing: "aside" };
  try {
    const standing = await dyad(ask.fleetRoot, ask.deviceKey);
    return { ...base, standing: standing === "clear" || standing === "aside" || standing === "owing" || standing === "returned" || standing === "unknown" ? standing : "aside" };
  } catch { return { ...base, standing: "aside" }; }
}

/** Answer one `custody:write`: the island holds bytes and never the vessel key, and the vessel's thread seals them. */
export async function answerCustodyWrite(caps: CapabilityRecord, ask: Pick<IslandMsg_CustodyWrite, "requestId" | "carrier" | "bytes">): Promise<IslandMsg_CustodyWritten> {
  const base = { type: "custody:written" as const, requestId: ask.requestId };
  if (ask.carrier !== "veil" || !(ask.bytes instanceof Uint8Array)) return { ...base, written: false, why: "bad custody write ask" };
  const custodyWrite = caps.custodyWrite;
  if (!custodyWrite) return { ...base, written: false, why: "no custodyWrite capability stands on this vessel" };
  try { await custodyWrite(ask.carrier, ask.bytes); return { ...base, written: true }; }
  catch (e) { return { ...base, written: false, why: e instanceof Error ? e.message : String(e) }; }
}

/** Answer one `session:sign` through the record's `sessionSign`; no door, a malformed ask or a fault each refuse by name.
 *  A record composed at the floor carries no door, so its ask answers `signer-unavailable`. */
export async function answerSessionSign(caps: CapabilityRecord, ask: Partial<IslandMsg_SessionSign> & { requestId: string }): Promise<IslandMsg_SessionSigned> {
  const base = { type: "session:signed" as const, requestId: ask.requestId };
  if ((ask.op !== "read" && ask.op !== "sign" && ask.op !== "own") || typeof ask.ask !== "string" || typeof ask.verb !== "string" ||
      (ask.op === "sign" && !(ask.payload instanceof Uint8Array))) return { ...base, refusal: "signer-unavailable" };
  const door = caps.sessionSign;
  if (!door) return { ...base, refusal: "signer-unavailable" };
  try {
    const answer = await door({ op: ask.op, ask: ask.ask, verb: ask.verb, ...(ask.payload ? { payload: ask.payload } : {}) });
    return { ...base, ...answer } as IslandMsg_SessionSigned;
  } catch { return { ...base, refusal: ask.op === "sign" ? "signer-refused" : "signer-unavailable" }; }
}

/** Answer one `rest:ask`. A vessel that stands no `restsSealed` seals no bag, so it answers unsealed; a malformed ask or
 *  a fault of the rest answers its refusal by name, never unsealed. */
export async function answerRestAsk(caps: CapabilityRecord, ask: Partial<IslandMsg_RestAsk> & { requestId: string }): Promise<IslandMsg_RestAnswer> {
  const base = { type: "rest:answer" as const, requestId: ask.requestId };
  if (typeof ask.documentId !== "string" || ask.documentId.length === 0) return { ...base, refused: "ask-malformed" };
  const restsSealed = caps.restsSealed;
  if (!restsSealed) return { ...base, sealed: false };
  try { return { ...base, sealed: (await restsSealed(ask.documentId)) === true }; } catch { return { ...base, refused: "rest-fault" }; }
}

/**
 * THE VESSEL'S HALF OF THE SETTLEMENT ROUND (L29, 2026-11-07). The vessel answers every receipt ask whenever asked, during the
 * island's submit too. Once the island says `receipt:asks-done` and every answer still being made has posted, `close` runs ONCE
 * (the vessel sends `receipt:close`). No clock: the island's own word and the answers end the round, and the vessel's force-kill
 * stays the one liveness for a worker wedged alive. Each vessel door that answers receipts (the wiki pool, the node daemon worker,
 * the browser daemon) holds one per island.
 */
export function receiptSettlement(close: () => void): { answering<T>(answer: Promise<T>): Promise<T>; asksDone(): void } {
  let answering = 0;
  let asked = false;
  let closed = false;
  const settle = (): void => {
    if (!asked || answering !== 0 || closed) return;
    closed = true;
    close();
  };
  return {
    answering(answer) {
      answering++;
      return answer.finally(() => { answering--; settle(); });
    },
    asksDone() { asked = true; settle(); },
  };
}

/** The island-to-vessel kinds the record answers, each by the member of its own name. */
export const RECORD_ASKS = ["cas:want", "receipt:request", "dyad:ask", "custody:write", "session:sign"] as const;

/**
 * Answer a DAEMON island's asks through its record, over any port: `cas:want`, `receipt:request`, `dyad:ask`,
 * `custody:write` and `session:sign`. Returns the unsubscribe. The node answers over its `worker_threads` channel by
 * kind (`worker-handle.ts`); a browser vessel worker answers its daemon island here.
 */
export function answerIslandAsks(port: { post(msg: unknown): void; listen(cb: (msg: unknown) => void): () => void }, caps: CapabilityRecord): () => void {
  const reply = (msg: unknown): void => { try { port.post(msg); } catch { /* the island went away: nothing to answer */ } };
  const settlement = receiptSettlement(() => reply({ type: "receipt:close" }));
  const detachDocStore = caps.docStore?.(port) ?? (() => {});
  const stop = port.listen((raw) => {
    const m = raw as { type?: unknown; requestId?: unknown; [k: string]: unknown } | null;
    // The island's word reads whole, as at every island door: a type with any other key is no asks-done.
    if (m?.type === "receipt:asks-done") { if (Object.keys(m).length === 1) settlement.asksDone(); return; }
    if (!m || typeof m.requestId !== "string") return;
    const requestId = m.requestId;
    switch (m.type) {
      case "cas:want": {
        if (typeof m["cid"] !== "string") return;
        void answerCas(caps, { requestId, cid: m["cid"] }, "in-process").then(reply);
        return;
      }
      case "receipt:request": {
        const ids = m["documentIds"];
        if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) return;
        const heads = m["heads"];
        void settlement.answering(answerReceipt(caps, { requestId, documentIds: ids, ...(heads && typeof heads === "object" ? { heads: heads as Record<string, string[]> } : {}) })
          .then(reply, () => reply({ type: "receipt:issued", requestId, issued: false })));
        return;
      }
      case "dyad:ask":
        void answerDyad(caps, { requestId, fleetRoot: m["fleetRoot"] as string, deviceKey: m["deviceKey"] as string }).then(reply);
        return;
      case "custody:write":
        void answerCustodyWrite(caps, { requestId, carrier: m["carrier"] as CustodyWriteCarrier, bytes: m["bytes"] as Uint8Array }).then(reply);
        return;
      case "session:sign":
        void answerSessionSign(caps, m as Partial<IslandMsg_SessionSign> & { requestId: string }).then(reply);
        return;
      case "rest:ask":
        void answerRestAsk(caps, m as Partial<IslandMsg_RestAsk> & { requestId: string }).then(reply);
        return;
      default:
        return;
    }
  });
  return () => { stop(); detachDocStore(); };
}

/** Answer bytes through the one gated member; preserve a named refusal across the worker boundary. */
export async function answerCas(caps: CapabilityRecord, ask: { requestId: string; cid: string }, audience: ShareAudience | undefined): Promise<IslandMsg_CasBlock> {
  const answer = { type: "cas:block" as const, requestId: ask.requestId };
  if (!caps.cas) return { ...answer, bytes: null, refusal: "cas-unavailable" };
  try { return { ...answer, bytes: await caps.cas(ask.cid, audience) }; }
  catch (error) {
    const reason = error && typeof error === "object" && "reason" in error ? String(error.reason)
      : error instanceof Error ? error.message : String(error);
    return { ...answer, bytes: null, refusal: reason };
  }
}

/** Worker-side byte door. Every read asks the vessel, including local hits: a hash proves bytes, never readership.
 * The vessel answers each request and the island dies with its vessel, so no clock decides a miss. */
export function vesselCasAsker(port: {
  post(msg: unknown): void;
  listen(cb: (msg: unknown) => void): void;
}): (cid: string) => Promise<Uint8Array | null> {
  const pending = new Map<string, { cid: string; resolve(bytes: Uint8Array | null): void; reject(error: Error): void }>();
  let seq = 0;
  port.listen((raw) => {
    const m = raw as Partial<IslandMsg_CasBlock> | null;
    if (!m || m.type !== "cas:block" || typeof m.requestId !== "string") return;
    const ask = pending.get(m.requestId);
    if (!ask) return;
    pending.delete(m.requestId);
    if (m.refusal) {
      const error = new Error(m.refusal);
      error.name = m.refusal.startsWith("declared-tier-") ? "DeclaredTierRefusal" : "CasRefused";
      ask.reject(Object.assign(error, { reason: m.refusal }));
    } else if (m.bytes instanceof Uint8Array && !verifyCidBytes(m.bytes, ask.cid)) {
      ask.reject(new Error(`CID mismatch for ${ask.cid}`));
    } else ask.resolve(m.bytes instanceof Uint8Array ? m.bytes : null);
  });
  return (cid) => new Promise((resolve, reject) => {
    const requestId = `cas-${++seq}`;
    pending.set(requestId, { cid, resolve, reject });
    try { port.post({ type: "cas:want", requestId, cid }); }
    catch (error) { pending.delete(requestId); reject(error); }
  });
}
