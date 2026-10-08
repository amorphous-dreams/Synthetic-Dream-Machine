/**
 * daemon-auth-gate — the pre-sync WebSocket gate every proving door of a vessel stands behind.
 *
 * Wraps a WebSocketServer as an EventEmitter proxy compatible with NodeWSServerAdapter. The adapter calls
 * .on("connection") and .on("close") and reads .clients — this class satisfies all three without exposing any
 * unadmitted socket upstream.
 *
 * ── THE ONE RULE ON THE WIRE ──────────────────────────────────────────────────────────────────────
 *   Gate → peer : lar:challenge {nonce}
 *   Peer → gate : lar:auth      (ContactCard, nonce echo, the leaf's own fresh nonce, the V3 proof, and at most
 *                                one presentation)
 *   Gate → peer : lar:auth-ok   (signed by the gate key over both nonces) — OR NOTHING AT ALL.
 *
 * SILENCE (siege-resilience#/the-active-prober). Every refusal — a gate not yet armed, too many pending
 * sockets, a malformed message, a bad proof, a presentation that does not hold, a stranger under PRIVATE
 * posture — draws the same answer: none. The gate draws ONE deadline at accept, uniform in
 * [authTimeout, 2·authTimeout), and a socket that has not passed by then is TERMINATED with no close frame, no
 * code and no reason. Because the deadline is drawn at accept rather than at the failure, how long the gate
 * stays quiet says nothing about which check failed or how long verifying took. The cause goes to the local
 * log alone. A legitimate party sees exactly what an attacker sees.
 *
 * THE KNOCK. A gate answers an upgrade only on `<route>/<knock>` (`knockPath`, mesh `gate-knock`), derived
 * from its own gate key; `upgradePath(route)` names it once armed, and the caller registers exactly that path
 * on the vessel's dispatcher, which destroys every unclaimed upgrade before any HTTP 101.
 *
 * ── THE SORTER ────────────────────────────────────────────────────────────────────────────────────
 * `arm` takes a SORTER and it is REQUIRED, so no gate instance (the relay `/ws`, the oracle socket) stands
 * without one. After the keyholder worker proves the peer's key (and vouches it same-operator when it is), the
 * sorter reads what the socket presented and answers its CLASS — same-operator · contracted · walker · stranger
 * — or null, which is silence. The sort runs BEFORE `lar:auth-ok`; a socket whose class is decided carries it
 * from its first frame. Any session frames the sorter hands back (a walker's renewed grant) follow the
 * verdict on the same socket.
 *
 * THE GATE SIGNS ITS VERDICT. Every `lar:auth-ok` carries the gate key's signature over `authOkBytes` (both
 * nonces, the gate key, the proven leaf key, the audience). A leaf reads a pass only under the gate key it
 * pinned, so authentication runs both ways on the one socket. The gate key signs; no root ever does.
 *
 * THE SESSION. An admitted socket also carries `lar:session` messages — JSON text frames beside Automerge's
 * binary frames. The gate routes every text frame on an admitted socket to its "session" listeners and hands
 * the adapter binary frames alone, so a session message never reaches the Automerge decoder. A socket the
 * gate has not admitted carries no session.
 *
 * The host holds no keyhive; the shore proxies each verify to the daemon island, which answers from its
 * in-worker keyhive. A node operator MAY relax the proof to capability-only with LAR_V3_ALLOW_UNPROVEN=1
 * (worker-side, for its own device fleet only). ContactCard payloads are capped at MAX_CONTACT_CARD_BYTES and
 * concurrent unadmitted sockets at MAX_PENDING.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/daemon-auth-gate
 */

import { EventEmitter }  from "node:events";
import { randomBytes, randomInt } from "node:crypto";
import type WebSocket    from "isomorphic-ws";
import type { WebSocketServer as WSSType } from "isomorphic-ws";
import {
  mkLarChallenge, mkLarAuthOk, isLarAuthMsg, authOkBytes, isLarSessionMsg, mkLarSessionMsg, knockPath,
} from "@lararium/mesh";
import type { AuthVerifierShore, HostingGrant, LarSessionMsg, PeerClass, Presented } from "@lararium/mesh";

/**
 * The challenge THIS gate issued on a socket: the single-use nonce and its own gate key. Trusted — the gate
 * minted both — so a sorter reads a presentation's leaf proof against these values and never against anything
 * the peer echoed.
 */
export interface SocketChallenge {
  readonly nonce:      string;
  readonly gatePubKey: string;
}

/** The gate's own key: its verifying key and the signer that signs its verdicts. A vessel's gate key, never a
 *  persona root. */
export interface GateKey {
  readonly pubKey: string;
  readonly sign:   (bytes: Uint8Array) => Promise<string> | string;
}

/** What the sorter reads for one socket whose key the worker proved. */
export interface SortInput {
  /** The Identifier hex the worker proved. */
  readonly identifier:   string;
  /** The raw vessel verifying key the V3 proof proved (the identifier's suffix), lowercase. */
  readonly vesselKey:    string;
  /** The worker vouched the peer same-operator (cap=admin@daemon, or a KEL-pinned device edge). */
  readonly sameOperator: boolean;
  /** What the socket presented beside its proof — UNTRUSTED until the sorter reads it. */
  readonly presented?:   Presented;
  /** The challenge this gate issued on the socket. */
  readonly challenge:    SocketChallenge;
}

/** The sorter's answer for an admitted socket. */
export interface SortVerdict {
  readonly class:     PeerClass;
  /** The leaf a contracted or walker socket stands as, and the Nexus it stands in. */
  readonly standing?: { readonly nym: string; readonly aid: string };
  /** Session frames the gate sends right after `lar:auth-ok`, in order. */
  readonly push?:     ReadonlyArray<{ readonly kind: string; readonly body: unknown }>;
  /** A walker socket's current-epoch grant — what its session verbs read (the mint door). */
  readonly grant?:    HostingGrant;
}

/** The sorter: a class for the socket, or null — silence. It never throws to the gate; a throw reads null. */
export type SocketSorter = (input: SortInput) => Promise<SortVerdict | null>;

/** Tunables a test may tighten. Production takes the defaults. */
export interface DaemonAuthGateOptions {
  /** The base of the silence deadline: a socket has [authTimeoutMs, 2·authTimeoutMs) from accept. */
  readonly authTimeoutMs?: number;
  /** Where the gate logs a refusal's cause (the wire never carries it). Defaults to the console. */
  readonly onRefuse?:      (reason: string) => void;
}

const AUTH_TIMEOUT_MS        = 5_000;
const MAX_PENDING            = 50;     // max concurrent unadmitted connections
const MAX_CONTACT_CARD_BYTES = 64_000; // 64 KB — generous for a self-certifying identity packet

interface ArmedState {
  shore:        AuthVerifierShore;
  daemonBagUrl: string;
  gate:         GateKey;
  sort:         SocketSorter;
}

type Settled =
  | { readonly ok: true; readonly identHex: string; readonly leafNonce: string; readonly verdict: SortVerdict; readonly presented?: Presented }
  | { readonly ok: false; readonly reason: string };

/**
 * EventEmitter proxy that NodeWSServerAdapter accepts in place of a WebSocketServer. Intercepts raw
 * connections, runs the auth exchange and the sort, and forwards only admitted sockets to the adapter.
 */
export class DaemonAuthGate extends EventEmitter {
  /** The admitted, live sockets. NodeWSServerAdapter reads .clients for keep-alive sweeps. */
  readonly clients: Set<WebSocket> = new Set();

  private armed: ArmedState | null = null;
  private _pending = 0;
  private readonly authTimeoutMs: number;
  private readonly onRefuse: (reason: string) => void;
  /** socket → the Keyhive Identifier hex the worker proved. */
  private readonly socketToIdentifier = new WeakMap<WebSocket, string>();
  /** socket → the class the sorter answered. */
  private readonly socketToClass = new WeakMap<WebSocket, PeerClass>();
  /** socket → the leaf and Nexus a contracted or walker socket stands as. */
  private readonly socketToStanding = new WeakMap<WebSocket, { readonly nym: string; readonly aid: string }>();
  /** socket → a walker socket's current-epoch grant. */
  private readonly socketToGrant = new WeakMap<WebSocket, HostingGrant>();
  /** socket → what an admitted peer presented, as it arrived. */
  private readonly socketToPresented = new WeakMap<WebSocket, Presented>();
  /** socket → the challenge this gate issued on it. */
  private readonly socketToChallenge = new WeakMap<WebSocket, SocketChallenge>();

  constructor(realWss: WSSType, opts: DaemonAuthGateOptions = {}) {
    super();
    this.authTimeoutMs = opts.authTimeoutMs ?? AUTH_TIMEOUT_MS;
    this.onRefuse = opts.onRefuse ?? ((reason) => { try { console.log(`[gate] silent: ${reason}`); } catch { /* */ } });
    realWss.on("connection", (socket: WebSocket, req: unknown) => {
      void this._handleConnection(socket, req);
    });
    realWss.on("close", () => this.emit("close"));
    realWss.on("error", (e: Error) => this.emit("error", e));
  }

  /**
   * Arm the gate: the daemon island's verify shore, the daemon bag URL (the proof's audience), the gate key
   * that signs every verdict, and the SORTER that classes every proven socket. Until armed, every socket is
   * silent until its deadline.
   */
  arm(shore: AuthVerifierShore, daemonBagUrl: string, gate: GateKey, sort: SocketSorter): void {
    this.armed = { shore, daemonBagUrl, gate: { pubKey: gate.pubKey.toLowerCase(), sign: gate.sign }, sort };
  }

  /** The exact upgrade path this gate answers on for `route` (`/ws`, `/oracle`), or null while unarmed. */
  upgradePath(route: string): string | null {
    return this.armed ? knockPath(this.armed.gate.pubKey, route) : null;
  }

  /** The Identifier hex the worker proved for an admitted socket. */
  getIdentifierForSocket(socket: WebSocket): string | undefined {
    return this.socketToIdentifier.get(socket);
  }

  /** The class the sorter answered for an admitted socket. */
  getClassForSocket(socket: WebSocket): PeerClass | undefined {
    return this.socketToClass.get(socket);
  }

  /** The leaf and Nexus a contracted or walker socket stands as. */
  getStandingForSocket(socket: WebSocket): { readonly nym: string; readonly aid: string } | undefined {
    return this.socketToStanding.get(socket);
  }

  /** A walker socket's current-epoch grant, as the sorter answered it. */
  getGrantForSocket(socket: WebSocket): HostingGrant | undefined {
    return this.socketToGrant.get(socket);
  }

  /** What an admitted peer presented on its lar:auth, as received. The sorter has read it. */
  getPresentedForSocket(socket: WebSocket): Presented | undefined {
    return this.socketToPresented.get(socket);
  }

  /** The nonce and gate key this gate issued on an admitted socket. */
  getChallengeForSocket(socket: WebSocket): SocketChallenge | undefined {
    return this.socketToChallenge.get(socket);
  }

  /**
   * Drop an admitted socket SILENTLY — no close frame, no code, no reason — as the gate drops a refused one.
   * The caller's refold uses it when a socket's class no longer holds (a revoked admit under PRIVATE, a
   * posture flipped to PRIVATE under a stranger).
   */
  drop(socket: WebSocket): void {
    this.clients.delete(socket);
    terminate(socket);
  }

  private async _handleConnection(socket: WebSocket, req: unknown): Promise<void> {
    // ONE DEADLINE, drawn at accept. Whatever happens below, a socket that has not passed by then is cut.
    const deadline = this.authTimeoutMs + randomInt(0, Math.max(1, this.authTimeoutMs));
    const timer = setTimeout(() => terminate(socket), deadline);
    socket.once("close", () => clearTimeout(timer));
    const silence = (reason: string): void => {
      try { socket.removeAllListeners("message"); } catch { /* closed */ }
      this.onRefuse(reason);
    };

    if (!this.armed) { silence("gate not armed"); return; }
    if (this._pending >= MAX_PENDING) { silence("too many pending sockets"); return; }

    this._pending++;
    const { shore, daemonBagUrl, gate, sort } = this.armed;
    const gatePubKey = gate.pubKey;
    const nonce = randomBytes(32).toString("hex");
    send(socket, mkLarChallenge(nonce));

    const result = await new Promise<Settled>((resolve) => {
      const onClose = (): void => { socket.off("message", onMessage); resolve({ ok: false, reason: "closed before auth" }); };
      const onMessage = async (raw: Buffer | ArrayBuffer | Buffer[]): Promise<void> => {
        socket.off("close", onClose);
        try {
          const text = Buffer.isBuffer(raw)
            ? raw.toString("utf8")
            : Array.isArray(raw)
              ? Buffer.concat(raw).toString("utf8")
              : Buffer.from(raw as ArrayBuffer).toString("utf8");
          const parsed = JSON.parse(text) as unknown;
          if (!isLarAuthMsg(parsed))                              { resolve({ ok: false, reason: "not a lar:auth" }); return; }
          if (parsed.nonce !== nonce)                             { resolve({ ok: false, reason: "nonce mismatch" }); return; }
          if (parsed.contactCard.length > MAX_CONTACT_CARD_BYTES) { resolve({ ok: false, reason: "contactCard too large" }); return; }

          // The V3 proof rides to the keyholder worker (the only verifier); the fleet edge rides untouched.
          const proof = parsed.sig ? { nonce, sig: parsed.sig } : undefined;
          const verdict = await shore.verify(new TextEncoder().encode(parsed.contactCard), daemonBagUrl, "admin", proof, parsed.edge);
          if (!verdict.ok || !verdict.identifier) { resolve({ ok: false, reason: verdict.reason ?? "unproven" }); return; }

          const identHex = verdict.identifier;
          let sorted: SortVerdict | null = null;
          try {
            sorted = await sort({
              identifier: identHex,
              vesselKey: identHex.slice(-64).toLowerCase(),
              sameOperator: verdict.peerClass === "same-operator",
              ...(parsed.presented !== undefined ? { presented: parsed.presented } : {}),
              challenge: { nonce, gatePubKey },
            });
          } catch (err) {
            resolve({ ok: false, reason: `sorter fault: ${err instanceof Error ? err.message : String(err)}` });
            return;
          }
          if (!sorted) { resolve({ ok: false, reason: "sorted to silence" }); return; }
          resolve({
            ok: true, identHex, leafNonce: parsed.leafNonce, verdict: sorted,
            ...(parsed.presented !== undefined ? { presented: parsed.presented } : {}),
          });
        } catch (err) {
          resolve({ ok: false, reason: err instanceof Error ? err.message : String(err) });
        }
      };
      socket.once("close", onClose);
      socket.once("message", onMessage);
    });

    this._pending--;
    if (!result.ok) { silence(result.reason); return; }

    let okSig: string;
    try {
      okSig = await gate.sign(authOkBytes({
        nonce, leafNonce: result.leafNonce, gatePubKey, peerPubKey: result.identHex.slice(-64), aud: daemonBagUrl,
      }));
    } catch (err) {
      silence(`gate could not sign its verdict: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    if (socket.readyState !== 1) { clearTimeout(timer); return; }   // the peer left while the sort ran
    clearTimeout(timer);
    this.socketToIdentifier.set(socket, result.identHex);
    this.socketToClass.set(socket, result.verdict.class);
    if (result.verdict.standing) this.socketToStanding.set(socket, result.verdict.standing);
    if (result.verdict.grant) this.socketToGrant.set(socket, result.verdict.grant);
    if (result.presented !== undefined) this.socketToPresented.set(socket, result.presented);
    this.socketToChallenge.set(socket, { nonce, gatePubKey });
    send(socket, mkLarAuthOk(okSig));
    this.clients.add(socket);
    socket.once("close", () => this.clients.delete(socket));
    this._splitSessionFrames(socket);
    for (const frame of result.verdict.push ?? []) this.sendSession(socket, frame.kind, frame.body);

    // Hand the admitted socket to NodeWSServerAdapter.
    this.emit("connection", socket, req);
  }

  /** Hear `lar:session` messages arriving on admitted sockets. Returns the unsubscribe. */
  onSession(listener: (socket: WebSocket, msg: LarSessionMsg) => void): () => void {
    this.on("session", listener);
    return () => { this.off("session", listener); };
  }

  /** Send one session message on an admitted, open socket. False — nothing sent — for any other socket. */
  sendSession(socket: WebSocket, kind: string, body: unknown): boolean {
    if (!this.clients.has(socket)) return false;
    try { socket.send(JSON.stringify(mkLarSessionMsg(kind, body))); return true; } catch { return false; }
  }

  /**
   * Split an admitted socket's frames: text frames are the session's and go to the "session" listeners; the
   * adapter's own "message" listeners see binary frames alone, so a session message never reaches the
   * Automerge decoder (which closes a socket on a frame it cannot decode).
   */
  private _splitSessionFrames(socket: WebSocket): void {
    const ws = socket as unknown as {
      on(event: string, listener: (...args: unknown[]) => void): unknown;
      addListener(event: string, listener: (...args: unknown[]) => void): unknown;
    };
    const on = ws.on.bind(ws);
    const binaryOnly = (event: string, listener: (...args: unknown[]) => void): unknown =>
      event === "message"
        ? on(event, (data: unknown, isBinary: unknown) => { if (isBinary !== false) listener(data, isBinary); })
        : on(event, listener);
    ws.on = binaryOnly;
    ws.addListener = binaryOnly;
    on("message", (data: unknown, isBinary: unknown) => {
      if (isBinary !== false) return;
      let msg: unknown;
      try { msg = JSON.parse(Buffer.isBuffer(data) ? data.toString("utf8") : String(data)); } catch { return; }
      if (isLarSessionMsg(msg)) this.emit("session", socket, msg);
    });
  }
}

function send(socket: WebSocket, msg: object): void {
  try { socket.send(JSON.stringify(msg)); } catch { /* socket may have closed */ }
}

/** Cut a socket with no close frame: `terminate` where the transport has it, else a bare close. */
function terminate(socket: WebSocket): void {
  const s = socket as unknown as { terminate?: () => void; close: () => void };
  try { if (typeof s.terminate === "function") s.terminate(); else s.close(); } catch { /* already gone */ }
}
