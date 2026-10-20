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

import type { DeviceDelegationTiddler, VesselWorkerHandle } from "@lararium/mesh";
import { signHolderSessionProof } from "@lararium/mesh";
import { validateSessionEnvelope, type SessionEnvelope } from "@lararium/mesh/session-contract";
import { HOLDER_UNAVAILABLE_NO_WORKER, type HolderHello, type HolderRefused } from "./shared-holder-core.js";
import { waitsForAdmission } from "./holder-admission.js";

const portEnvelopes = new WeakMap<MessagePort, SessionEnvelope & { readonly nonce: string }>();
const sessionLocks = new WeakMap<MessagePort, Promise<void>>();

/** The tab holds its session lock until its browsing context goes away. */
function holdSessionLock(sessionId: string): Promise<void> {
  const locks = (globalThis as unknown as { navigator?: { locks?: { request(name: string, callback: () => Promise<void>): Promise<unknown> } } }).navigator?.locks;
  if (!locks) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    void locks.request(`lares:holder-session:${sessionId}`, async () => {
      resolve();
      await new Promise<void>(() => {});
    }).catch(reject);
  });
}

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

/** The shared holder named its store-lock refusal; this tab must stop at the attachment door. */
export class SharedHolderRefusal extends Error {
  readonly storeName: string;
  override readonly cause: string;

  constructor(refusal: HolderRefused) {
    super(`[shared-holder] refused store "${refusal.storeName}": ${refusal.cause}`);
    this.name = "SharedHolderRefusal";
    this.storeName = refusal.storeName;
    this.cause = refusal.cause;
  }
}

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
  const greeting = await new Promise<HolderHello | HolderRefused | null>((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const onMsg = (e: MessageEvent): void => {
      const d = e.data as { kind?: unknown };
      if (d && (d.kind === "holder:hello" || d.kind === "holder:refused")) {
        clearTimeout(timer);
        port.removeEventListener("message", onMsg);
        resolve(e.data as HolderHello | HolderRefused);
      }
    };
    port.addEventListener("message", onMsg);
    port.start();
    timer = setTimeout(() => {
      port.removeEventListener("message", onMsg);
      port.close();
      resolve(null);
    }, args.helloTimeoutMs ?? 5_000);
  });
  if (!greeting) return { kind: "floor", why: "the shared holder never greeted; the daemon island rides a dedicated worker" };
  // A holder whose engine cannot start an island refuses before any admission; the tab takes the dedicated-worker floor.
  if (greeting.kind === "holder:refused" && greeting.cause === HOLDER_UNAVAILABLE_NO_WORKER) {
    port.close();
    return { kind: "floor", why: `${greeting.cause}; the daemon island rides a dedicated worker` };
  }
  if (greeting.kind === "holder:refused") {
    port.close();
    throw new SharedHolderRefusal(greeting);
  }
  const envelope = validateSessionEnvelope(greeting);
  if (!envelope) {
    port.close();
    throw new Error("[shared-holder] malformed holder greeting");
  }
  const nonce = (greeting as HolderHello).nonce;
  if (typeof nonce !== "string" || nonce.length === 0) {
    port.close();
    throw new Error("[shared-holder] holder greeting carries no nonce");
  }
  portEnvelopes.set(port, { ...envelope, nonce });
  sessionLocks.set(port, holdSessionLock(envelope.sessionId));
  globalThis.addEventListener?.("pagehide", () => {
    try { port.postMessage({ type: "session:close", ...envelope }); } catch { /* a gone port already closed */ }
  }, { once: true });
  return { kind: "attached", port, hello: greeting };
}

/** The face a tab wears: the countersigned edge it presents and the atom that signs the holder's challenge. */
export interface HolderFaceSession {
  readonly personaGroup: string;
  readonly edge:         DeviceDelegationTiddler;
  readonly atom:         { sign(bytes: Uint8Array): Promise<string> | string };
}

/** What a tab does when the holder locks the face it wears. */
export interface HolderHandleHooks {
  /** The face locked (its house ended or its last session closed): drop this tab's unlock. */
  readonly onLock?: (personaGroup: string) => void;
}

/**
 * The holder's port as the mesh worker-handle shape — the daemon core's spawn seam on the holder path. With a
 * `session`, the handle admits the tab's session first: it signs the port's challenge with the face atom and posts
 * `session:open`, so the holder stands this face's house and the island boots behind it. The holder's refusal
 * reaches the daemon core as a fault that names its cause.
 */
export function holderWorkerHandle(port: MessagePort, session?: HolderFaceSession, hooks?: HolderHandleHooks): VesselWorkerHandle {
  const held = portEnvelopes.get(port);
  if (!held) throw new Error("[shared-holder] holder greeting absent");
  const { nonce, ...envelope } = held;
  // A tab's asks wait for its admission: the holder answers a port only once its session admitted.
  let admitted = session === undefined;
  const waiting: Array<{ msg: object; transfer: Transferable[] }> = [];
  const send = (msg: object, transfer: Transferable[]): void => port.postMessage({ ...msg, ...envelope }, transfer);
  if (session) {
    port.addEventListener("message", (e: MessageEvent) => {
      const d = e.data as { kind?: unknown; sessionId?: unknown; personaGroup?: unknown };
      if (d?.kind === "holder:lock" && d.sessionId === envelope.sessionId) { hooks?.onLock?.(String(d.personaGroup)); return; }
      if (admitted || d?.kind !== "holder:admitted" || d.sessionId !== envelope.sessionId) return;
      admitted = true;
      for (const queued of waiting.splice(0)) send(queued.msg, queued.transfer);
    });
    port.start();
    void (async () => {
      await (sessionLocks.get(port) ?? holdSessionLock(envelope.sessionId));
      const signature = await signHolderSessionProof(session.atom, {
        ownerEpoch: envelope.ownerEpoch, sessionId: envelope.sessionId, nonce, personaGroup: session.personaGroup,
      });
      port.postMessage({ type: "session:open", personaGroup: session.personaGroup, edge: session.edge, signature, ...envelope });
    })().catch((error) => console.warn(`[shared-holder] session:open failed (${error instanceof Error ? error.message : String(error)})`));
  }
  return {
    post: (msg, transfer) => {
      // The island's boot (the manifest, the answers to its asks) crosses while its gate proves the face; a verb waits.
      if (admitted || !waitsForAdmission(String((msg as { type?: unknown }).type))) send(msg as object, (transfer ?? []) as Transferable[]);
      else waiting.push({ msg: msg as object, transfer: (transfer ?? []) as Transferable[] });
    },
    listen: (cb) => {
      const fn = (e: MessageEvent): void => {
        const d = e.data as { kind?: unknown; cause?: unknown };
        if (d && (d.kind === "holder:hello" || d.kind === "holder:admitted" || d.kind === "holder:lock")) return;   // the door's words, never the island's
        if (d && d.kind === "holder:house-ended" && session) {
          cb({ type: "fault", wikiUri: "", error: `[shared-holder] the holder ended this house: ${String(d.cause)}` });
          return;
        }
        if (d && d.kind === "holder:refused" && session) {
          cb({ type: "fault", wikiUri: "", error: `[shared-holder] the holder refused this session: ${String(d.cause)}` });
          return;
        }
        const incoming = validateSessionEnvelope(e.data);
        const refusal = !incoming ? "malformed-message"
          : incoming.ownerEpoch !== envelope.ownerEpoch ? "stale-owner-epoch"
          : incoming.sessionId !== envelope.sessionId ? "unknown-session"
          : incoming.generation !== envelope.generation ? "stale-generation" : null;
        if (refusal) {
          console.warn(`[shared-holder] dropped ${refusal}`);
          return;
        }
        const { ownerEpoch: _epoch, sessionId: _session, generation: _generation, ...message } = e.data as Record<string, unknown>;
        cb(message);
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
    terminate: () => { send({ type: "session:close" }, []); port.close(); },
  };
}
