/**
 * oracle-read-client — the CONSUMER side of the Two-Faced Substrate: pull a peer's oracle read-face over
 * the AUTHENTICATED channel, run the reader rule, and load it as a CRDT.
 *
 * PEERS PROVE FIRST. The read-face answers no stranger: the pointer and its snapshot cross only a socket
 * whose dialer passed the vessel gate's own handshake (lar:challenge → lar:auth → lar:auth-ok, the V3
 * proof-of-possession `runPeerHandshake` composes). A dialer that cannot prove a key reads nothing, and an
 * HTTP request for the oracle meets the vessel's closed door.
 *
 * The reader then VERIFIES before trusting (signature · causal ancestry · publisher binding · rehash == cid ·
 * heads == signed frontier). The publisher binds to the gate by default: the pointer must be signed by the
 * key the gate named in its challenge, the key this dialer's proof committed to — so a socket that proved to
 * one vessel cannot be fed another's map.
 * Isomorphic: the global `WebSocket` (Node 22+/browser) + `Automerge.load`; a browser vessel reads exactly so.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/lararium-identity#/the-oracle-plane
 */

import { load as automergeLoad, getHeads, type Doc } from "@automerge/automerge";
import { verifyOraclePointer, verifyOracleSnapshotBytes, type OraclePointer } from "./oracle-substrate.js";
import { isLarChallengeMsg, runPeerHandshake, type LeafIdentity } from "./auth-wire.js";
import { DAEMON_BAG_ID } from "./lar-uris.js";

/**
 * THE ORACLE SOCKET ROUTE AND FRAME, SPELLED ONCE.
 *
 * A server in `lararium-node` answers this upgrade path and this client dials it. Spelled twice, the two move
 * only when someone remembers both — and they do not run in one process, so nothing forces the memory: a vessel
 * and a Herm built from different commits would simply miss each other, which reads as a peer being down rather
 * than as a rename. Mesh holds them because node imports mesh and never the reverse.
 *
 * After the gate's `lar:auth-ok` the face sends ONE text frame (`ORACLE_POINTER_FRAME`, the signed pointer),
 * then ONE binary frame (the snapshot bytes that pointer names), then closes. A face with no pointer yet closes
 * without a frame.
 */
export const ORACLE_SOCKET_ROUTE  = "/oracle";
export const ORACLE_POINTER_FRAME = "lar:oracle-pointer";

export interface OraclePointerFrame {
  readonly type:    typeof ORACLE_POINTER_FRAME;
  readonly pointer: OraclePointer;
}

export interface OraclePullResult<T = unknown> {
  readonly ok:       boolean;
  readonly reason?:  string;
  readonly pointer?: OraclePointer;
  readonly doc?:     Doc<T>;
  readonly cid?:     string;
}

/** One dialed socket as the reader drives it: frames in order, text out, a close. */
export interface OracleChannel {
  /** The next frame, or null once the socket closed (or the wait ran out). */
  readonly recv:  () => Promise<string | Uint8Array | null>;
  readonly send:  (text: string) => void;
  readonly close: () => void;
}

export interface OraclePullOpts {
  /** The identity this reader proves at the peer's gate. Without one there is nothing to prove, and nothing reads. */
  readonly identity:          LeafIdentity;
  /** Pin the publisher — refuse a pointer signed by any other key. Absent → the key the gate named. */
  readonly verifyingKey?:     string;
  /** Locally held pointer identities; a missing parent is unavailable. */
  readonly knownPointerIds?: readonly string[];
  /** Open the socket (tests inject one). Default: the global `WebSocket`. */
  readonly openChannel?:      (url: string) => Promise<OracleChannel>;
  /** How long any one frame may take to arrive. */
  readonly frameTimeoutMs?:   number;
}

const DEFAULT_FRAME_TIMEOUT_MS = 10_000;

/** The oracle socket URL for a peer's base URL — http(s) maps to ws(s); a ws(s) base rides as given. */
export function oracleSocketUrl(baseUrl: string): string {
  const u = new URL(baseUrl.replace(/\/+$/, "") + ORACLE_SOCKET_ROUTE);
  if (u.protocol === "http:") u.protocol = "ws:";
  else if (u.protocol === "https:") u.protocol = "wss:";
  return u.href;
}

/** Open a channel over the platform's global `WebSocket`. Rejects when the socket never opens. */
export function webSocketChannel(url: string, frameTimeoutMs = DEFAULT_FRAME_TIMEOUT_MS): Promise<OracleChannel> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    const frames: Array<string | Uint8Array> = [];
    const waiters: Array<(f: string | Uint8Array | null) => void> = [];
    let closed = false;
    let opened = false;
    const drain = (): void => { while (waiters.length) waiters.shift()!(null); };
    ws.onmessage = (e: MessageEvent) => {
      const frame = typeof e.data === "string" ? e.data : new Uint8Array(e.data as ArrayBuffer);
      const w = waiters.shift();
      if (w) w(frame); else frames.push(frame);
    };
    ws.onclose = () => { closed = true; drain(); if (!opened) reject(new Error("socket closed before it opened")); };
    ws.onerror = () => { if (!opened) { closed = true; reject(new Error("socket failed to open")); } };
    ws.onopen = () => {
      opened = true;
      resolve({
        recv: () => {
          if (frames.length) return Promise.resolve(frames.shift()!);
          if (closed) return Promise.resolve(null);
          return new Promise((r) => {
            const timer = setTimeout(() => { const i = waiters.indexOf(done); if (i >= 0) waiters.splice(i, 1); r(null); }, frameTimeoutMs);
            const done = (f: string | Uint8Array | null): void => { clearTimeout(timer); r(f); };
            waiters.push(done);
          });
        },
        send:  (text) => { try { ws.send(text); } catch { /* closed */ } },
        close: () => { try { ws.close(); } catch { /* closed */ } },
      });
    };
  });
}

function parseText(frame: string | Uint8Array | null): unknown {
  if (typeof frame !== "string") return undefined;
  try { return JSON.parse(frame) as unknown; } catch { return undefined; }
}

function isOraclePointerFrame(v: unknown): v is OraclePointerFrame {
  return typeof v === "object" && v !== null
    && (v as { type?: unknown }).type === ORACLE_POINTER_FRAME
    && typeof (v as { pointer?: unknown }).pointer === "object";
}

/**
 * Pull + verify + load the oracle doc from a peer at `baseUrl`, proving `opts.identity` at its gate first.
 * Never throws; a failure returns `{ ok: false, reason }` (and the pointer, when it got that far).
 * Order: dial → prove → pointer frame → verify → snapshot frame → rehash → load → heads.
 */
export async function pullAndVerifyOracle<T = unknown>(
  baseUrl: string,
  opts: OraclePullOpts,
): Promise<OraclePullResult<T>> {
  const timeoutMs = opts.frameTimeoutMs ?? DEFAULT_FRAME_TIMEOUT_MS;
  let channel: OracleChannel;
  try {
    const url = oracleSocketUrl(baseUrl);
    channel = await (opts.openChannel ?? ((u: string) => webSocketChannel(u, timeoutMs)))(url);
  } catch (e) {
    return { ok: false, reason: `dial failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  try {
    return await pullOverChannel<T>(channel, opts);
  } finally {
    channel.close();
  }
}

async function pullOverChannel<T>(channel: OracleChannel, opts: OraclePullOpts): Promise<OraclePullResult<T>> {
  // 1. the gate speaks first; its challenge names the key this dialer's proof commits to.
  const challenge = parseText(await channel.recv());
  if (!isLarChallengeMsg(challenge)) return { ok: false, reason: "no gate challenge" };
  // A pinned publisher pins the gate too: the vessel key is both, so a socket answered by any other gate is
  // refused before this dialer proves anything to it. Unpinned, the dialer adopts the key the gate named —
  // the gate then proves it holds that key by signing its verdict, and the pointer must carry the same key.
  const gatePubKey = opts.verifyingKey ?? challenge.gatePubKey;
  if (!gatePubKey) return { ok: false, reason: "the gate named no key to prove against" };
  if (challenge.gatePubKey && challenge.gatePubKey.toLowerCase() !== gatePubKey.toLowerCase())
    return { ok: false, reason: "the gate is not the pinned publisher" };

  // 2. prove — the gate's own handshake, composed unchanged.
  let replayed = false;
  const verdict = await runPeerHandshake({
    recv: async () => {
      if (!replayed) { replayed = true; return challenge; }
      return parseText(await channel.recv());
    },
    send:        (msg) => channel.send(JSON.stringify(msg)),
    contactCard: opts.identity.contactCard,
    peerPubKey:  opts.identity.peerPubKey,
    gatePubKey,
    aud:         DAEMON_BAG_ID,
    sign:        opts.identity.sign,
    ...(opts.identity.edge ? { edge: opts.identity.edge } : {}),
  });
  if (!verdict.ok) return { ok: false, reason: `gate refused: ${verdict.reason ?? "denied"}` };

  // 3. the signed pointer — verify BEFORE trusting, bound to the gate this socket proved to.
  const frame = parseText(await channel.recv());
  if (!isOraclePointerFrame(frame)) return { ok: false, reason: "peer published no pointer" };
  const pointer = frame.pointer;
  const pointerVerdict = await verifyOraclePointer(pointer, {
    verifyingKey: gatePubKey,
    ...(opts.knownPointerIds !== undefined ? { knownPointerIds: opts.knownPointerIds } : {}),
  });
  if (!pointerVerdict.ok) return { ok: false, reason: `pointer rejected: ${pointerVerdict.reason}`, pointer };

  // 4. the content-addressed snapshot — rehash == cid (the host cannot lie about the bytes).
  const bytes = await channel.recv();
  if (!(bytes instanceof Uint8Array)) return { ok: false, reason: "peer sent no snapshot", pointer };
  if (!(await verifyOracleSnapshotBytes(bytes, pointer.cid)))
    return { ok: false, reason: "snapshot hash mismatch (cid does not match bytes)", pointer };

  // 5. load read-only.
  let doc: Doc<T>;
  try {
    doc = automergeLoad<T>(bytes);
  } catch (e) {
    return { ok: false, reason: `automerge load failed: ${e instanceof Error ? e.message : String(e)}`, pointer };
  }

  const loadedHeads = [...new Set(getHeads(doc) as string[])].sort();
  const signedHeads = [...new Set(pointer.heads)].sort();
  if (loadedHeads.length !== signedHeads.length || loadedHeads.some((head, i) => head !== signedHeads[i]))
    return { ok: false, reason: "snapshot heads mismatch (signed frontier does not match bytes)", pointer };

  return { ok: true, pointer, doc, cid: pointer.cid };
}
