/**
 * daemon-auth-gate — pre-sync WebSocket authentication gate for the daemon doc.
 *
 * Wraps a WebSocketServer as an EventEmitter proxy compatible with
 * NodeWSServerAdapter. The adapter calls .on("connection") and .on("close")
 * and reads .clients — this class satisfies all three without exposing any
 * unauthenticated connections upstream.
 *
 * Auth exchange before Automerge sync:
 *   Server  → lar:challenge  (fresh 32-byte hex nonce)
 *   Client  → lar:auth       (Keyhive ContactCard JSON + nonce echo)
 *   Server  → lar:auth-ok    (signed by the gate key over the leaf's own nonce; emit "connection")
 *        OR   lar:auth-denied + ws.close(4003)
 *
 * THE GATE SIGNS ITS VERDICT. `arm` takes the gate's key — its verifying key AND its signer — and every
 * `lar:auth-ok` carries the gate key's signature over `authOkBytes` (both nonces, the gate key, the proven
 * leaf key, the audience). A leaf reads a pass only under the gate key it pinned, so authentication runs
 * both ways on the one socket. The gate key signs; no root ever does.
 *
 * The gate starts "disarmed" — all connections are rejected with 4503 until
 * arm() is called with the daemon island's AuthVerifierShore, the daemon bag URL and the gate key.
 * The host holds no keyhive after Stage 1; the shore proxies each verify to the
 * daemon island, which answers from its in-worker keyhive and returns the peer's
 * Identifier hex for the sharePolicy map. arm() is called once the daemon VM lives.
 *
 * After a peer authenticates:
 *   1. socketToIdentifier WeakMap records socket → identifierHex.
 *   2. The Repo's sharePolicy should call getIdentifierForSocket() to build
 *      PeerId → identifierHex entries when the adapter emits "peer-candidate".
 *   3. The PRESENTATION riding the lar:auth — the PRESENTED ADMIT (`presentedAdmit`, the dialed island's
 *      quorum-signed admit of that operator's leaf, its causal lineage and the leaf's proof over this socket) —
 *      is kept per socket as UNTRUSTED input, read back by getPresentationForSocket(), beside the nonce and
 *      gate key this gate issued (getChallengeForSocket()), which the seat verifies the leaf proof against.
 *      The gate decides nothing by it: admission stays the worker's verdict, no class or nym is lifted from
 *      it, and a peer that presents nothing stands at the cross-operator floor exactly as one that presents.
 *      A presented admit that fails its structural guard fails `isLarAuthMsg`, so the socket is denied like
 *      any malformed lar:auth — and so is a lar:auth carrying the retired `contractEdge` slot: no root-signed
 *      edge over a cross-operator's vessel key travels on any socket (membership-doctrine #/two-maps).
 *
 * THE SESSION. An admitted socket also carries `lar:session` messages — JSON text frames beside Automerge's
 * binary frames — for protocols that ride an authenticated session. The gate routes every text frame on an
 * admitted socket to its "session" listeners (`socket`, the message) and hands the adapter binary frames
 * alone, so a session message never reaches the Automerge decoder. `sendSession` answers on the same socket.
 * A socket the gate has not admitted carries no session: its only text frame is the lar:auth.
 *
 * Security posture (alpha):
 *   - V3 proof-of-possession (ENFORCED): the gate emits its gate-binding key in
 *     lar:challenge and relays the peer's {nonce, sig} to the keyholder worker,
 *     which verifies the Ed25519 proof (verifyAuthProof) against the card key + the
 *     gate's own key AND folds the result into its verdict (operator-daemon-behavior,
 *     step D). So `verdict.ok` already means capability AND a verified proof; the
 *     gate admits on it directly and stays keyhive-free. A node operator MAY relax
 *     to capability-only with LAR_V3_ALLOW_UNPROVEN=1 (the prior advisory posture).
 *   - ContactCard payload is capped at MAX_CONTACT_CARD_BYTES before TextEncoder.
 *   - Concurrent unauthenticated connections are capped at MAX_PENDING.
 *   - Auth timeout is 5 s (machine-to-machine; no human interaction path).
 *
 * Meme: lar:///ha.ka.ba/lararium/node/daemon-auth-gate
 */

import { EventEmitter }  from "node:events";
import { randomBytes }   from "node:crypto";
import type WebSocket    from "isomorphic-ws";
import type { WebSocketServer as WSSType } from "isomorphic-ws";
import {
  mkLarChallenge, mkLarAuthOk, mkLarAuthDenied, isLarAuthMsg, authOkBytes, isLarSessionMsg, mkLarSessionMsg,
} from "@lararium/mesh";
import type { AuthVerifierShore, LarSessionMsg, PeerClass, PresentedAdmit } from "@lararium/mesh";

/**
 * What a peer presented on its lar:auth beyond its card, proof and fleet edge, exactly as it arrived.
 * UNTRUSTED: nothing here is verified at the gate, and its presence or absence changes no admission.
 */
export interface SocketPresentation {
  readonly presentedAdmit: PresentedAdmit;
}

/**
 * The challenge THIS gate issued on a socket: the single-use nonce and the gate key it advertised. Trusted —
 * the gate minted both — so a seat reads a presented admit's leaf proof against these values and never
 * against anything the peer echoed.
 */
export interface SocketChallenge {
  readonly nonce:      string;
  readonly gatePubKey: string;
}

/** The gate's own key: the verifying key it advertises and the signer that signs its verdicts. A vessel's
 *  gate key, never a persona root. */
export interface GateKey {
  readonly pubKey: string;
  readonly sign:   (bytes: Uint8Array) => Promise<string> | string;
}

const AUTH_TIMEOUT_MS       = 5_000;
const MAX_PENDING           = 50;     // max concurrent unauthenticated connections
const MAX_CONTACT_CARD_BYTES = 64_000; // 64 KB — generous for a self-certifying identity packet
const WS_CLOSE_UNAUTHORIZED  = 4003;
const WS_CLOSE_NOT_READY     = 4503;
const WS_CLOSE_RATE_LIMITED  = 4429;

interface ArmedState {
  shore:        AuthVerifierShore;
  daemonBagUrl: string;
  /** The gate key: advertised in lar:challenge (the gate-binding the peer's V3 proof commits to) and the
   *  signer of every lar:auth-ok. */
  gate:         GateKey;
}

/**
 * EventEmitter proxy that NodeWSServerAdapter accepts in place of a
 * WebSocketServer. Intercepts raw connections, runs the auth exchange,
 * and only forwards authenticated sockets to the adapter.
 */
export class DaemonAuthGate extends EventEmitter {
  /** Mirrors the set of authenticated, live WebSocket connections.
   *  NodeWSServerAdapter reads .clients for keep-alive sweeps. */
  readonly clients: Set<WebSocket> = new Set();

  private armed: ArmedState | null = null;
  private _pending = 0;
  /** socket → Keyhive Identifier hex (set on successful auth). */
  private readonly socketToIdentifier = new WeakMap<WebSocket, string>();
  /** socket → the self-slot PeerClass the keyholder vouched (#the self-slot split). Set on a
   *  same-operator admit; ABSENT for any admit the worker could not positively vouch — the
   *  sharePolicy reads that absence as the stricter cross-operator class (fail-closed). */
  private readonly socketToClass = new WeakMap<WebSocket, PeerClass>();
  /** socket → the untrusted presentation an admitted peer carried (see the header, step 3). */
  private readonly socketToPresentation = new WeakMap<WebSocket, SocketPresentation>();
  /** socket → the challenge this gate issued on it (kept for every admitted socket, beside the presentation). */
  private readonly socketToChallenge = new WeakMap<WebSocket, SocketChallenge>();

  constructor(realWss: WSSType) {
    super();
    realWss.on("connection", (socket: WebSocket, req: unknown) => {
      void this._handleConnection(socket, req);
    });
    realWss.on("close", () => this.emit("close"));
    realWss.on("error", (e: Error) => this.emit("error", e));
  }

  /**
   * Arm the gate with the daemon island's verify shore, the daemon bag URL and the gate key that signs every
   * verdict. Call once the daemon VM lives (its in-worker keyhive answers verify-proxy queries). Connections
   * arriving before arm() are rejected with 4503.
   */
  arm(shore: AuthVerifierShore, daemonBagUrl: string, gate: GateKey): void {
    this.armed = { shore, daemonBagUrl, gate: { pubKey: gate.pubKey.toLowerCase(), sign: gate.sign } };
  }

  /**
   * Look up the Keyhive Identifier hex for an authenticated socket.
   * Call this (deferred by one microtask) from a "peer-candidate" listener
   * on the NetworkAdapter to populate the PeerId → identifierHex map used
   * by sharePolicy.
   */
  getIdentifierForSocket(socket: WebSocket): string | undefined {
    return this.socketToIdentifier.get(socket);
  }

  /**
   * Look up the self-slot PeerClass the keyholder vouched for an authenticated socket. Call it
   * (deferred one microtask, ALONGSIDE getIdentifierForSocket) from the "peer-candidate" listener to
   * key the sharePolicy's class map. `undefined` — the worker admitted the peer but could not positively
   * vouch it same-operator — reads as the stricter cross-operator class at the sharePolicy (fail-closed).
   */
  getClassForSocket(socket: WebSocket): PeerClass | undefined {
    return this.socketToClass.get(socket);
  }

  /**
   * The presented admit an admitted peer carried on its lar:auth, as received — undefined for a peer that
   * presented none. UNTRUSTED: the gate verified none of it, so a reader folds it against its own carriage
   * frontier before reading any relation from it.
   */
  getPresentationForSocket(socket: WebSocket): SocketPresentation | undefined {
    return this.socketToPresentation.get(socket);
  }

  /**
   * The nonce and gate key this gate issued on an admitted socket — the values a presented admit's leaf
   * proof must verify against. The gate decides nothing by them; the seat does.
   */
  getChallengeForSocket(socket: WebSocket): SocketChallenge | undefined {
    return this.socketToChallenge.get(socket);
  }

  private async _handleConnection(socket: WebSocket, req: unknown): Promise<void> {
    if (!this.armed) {
      this._deny(socket, WS_CLOSE_NOT_READY, "vessel not ready");
      return;
    }

    if (this._pending >= MAX_PENDING) {
      this._deny(socket, WS_CLOSE_RATE_LIMITED, "too many pending auth connections");
      return;
    }

    this._pending++;
    const { shore, daemonBagUrl, gate } = this.armed;
    const gatePubKey = gate.pubKey;

    const nonce = randomBytes(32).toString("hex");
    this._send(socket, mkLarChallenge(nonce, gatePubKey));

    const result = await new Promise<
      { ok: true; identHex: string; leafNonce: string; peerClass?: PeerClass; presentation?: SocketPresentation } | { ok: false; reason: string }
    >((resolve) => {
      const timer = setTimeout(
        () => { socket.off("close", onClose); resolve({ ok: false, reason: "auth timeout" }); },
        AUTH_TIMEOUT_MS,
      );

      const onClose = () => {
        clearTimeout(timer);
        socket.off("message", onMessage);
        resolve({ ok: false, reason: "connection closed before auth" });
      };

      const onMessage = async (raw: Buffer | ArrayBuffer | Buffer[]) => {
        clearTimeout(timer);
        socket.off("close", onClose);
        try {
          const text = Buffer.isBuffer(raw)
            ? raw.toString("utf8")
            : Array.isArray(raw)
              ? Buffer.concat(raw).toString("utf8")
              : Buffer.from(raw as ArrayBuffer).toString("utf8");

          const parsed = JSON.parse(text) as unknown;
          if (!isLarAuthMsg(parsed)) {
            resolve({ ok: false, reason: "expected lar:auth message" });
            return;
          }

          if (parsed.nonce !== nonce) {
            resolve({ ok: false, reason: "nonce mismatch" });
            return;
          }

          if (parsed.contactCard.length > MAX_CONTACT_CARD_BYTES) {
            resolve({ ok: false, reason: "contactCard payload too large" });
            return;
          }

          const cardBytes = new TextEncoder().encode(parsed.contactCard);

          // V3 proof relay: carry the peer's signed proof material to the keyholder
          // worker (the only verifier — project_verification_placement). The gate
          // holds no keyhive, so it forwards {nonce, sig} and the worker checks
          // the Ed25519 signature against the card-derived key + this gate's own key.
          const proof = parsed.sig ? { nonce, sig: parsed.sig } : undefined;

          // Path (b): host has no keyhive — proxy to the daemon island, which
          // does receiveContactCard + verify in-worker and returns the verdict
          // plus the peer's Identifier hex for the sharePolicy map. The OPTIONAL
          // device-delegation edge rides through untouched — the gate
          // never adjudicates it; the in-worker keyholder verifies it against the
          // PINNED hearth root.
          const verdict = await shore.verify(cardBytes, daemonBagUrl, "admin", proof, parsed.edge);

          // ENFORCEMENT (V3 step D): the keyholder worker already folded the proof
          // check into `verdict.ok` (it returns ok only on capability AND a verified
          // proof; LAR_V3_ALLOW_UNPROVEN=1 relaxes it worker-side). The gate admits
          // on the verdict directly — it never re-decides policy, staying a relay.
          if (!verdict.ok || !verdict.identifier) {
            resolve({ ok: false, reason: verdict.reason ?? (verdict.ok ? "verify-proxy returned no identifier" : "insufficient capability") });
          } else {
            // Keep the presentation as received; it rides beside the verdict and changes none of it.
            const presentation: SocketPresentation | undefined =
              parsed.presentedAdmit !== undefined ? { presentedAdmit: parsed.presentedAdmit } : undefined;
            // Carry the self-slot class the keyholder vouched (absent → cross-operator at the gate).
            resolve({
              ok: true, identHex: verdict.identifier, leafNonce: parsed.leafNonce,
              ...(verdict.peerClass !== undefined ? { peerClass: verdict.peerClass } : {}),
              ...(presentation ? { presentation } : {}),
            });
          }
        } catch (err) {
          resolve({
            ok:     false,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      };

      socket.once("close", onClose);
      socket.once("message", onMessage);
    });

    this._pending--;

    if (!result.ok) {
      this._send(socket, mkLarAuthDenied(result.reason));
      this._deny(socket, WS_CLOSE_UNAUTHORIZED, result.reason);
      return;
    }

    // The verdict, signed by the gate key over the leaf's own nonce and the key the worker proved.
    let okSig: string;
    try {
      okSig = await gate.sign(authOkBytes({
        nonce, leafNonce: result.leafNonce, gatePubKey, peerPubKey: result.identHex.slice(-64), aud: daemonBagUrl,
      }));
    } catch (err) {
      const reason = `gate could not sign its verdict: ${err instanceof Error ? err.message : String(err)}`;
      this._send(socket, mkLarAuthDenied(reason));
      this._deny(socket, WS_CLOSE_UNAUTHORIZED, reason);
      return;
    }
    this.socketToIdentifier.set(socket, result.identHex);
    if (result.peerClass !== undefined) this.socketToClass.set(socket, result.peerClass);
    if (result.presentation !== undefined) this.socketToPresentation.set(socket, result.presentation);
    this.socketToChallenge.set(socket, { nonce, gatePubKey });
    this._send(socket, mkLarAuthOk(okSig));
    this.clients.add(socket);
    socket.once("close", () => this.clients.delete(socket));
    this._splitSessionFrames(socket);

    // Hand the authenticated socket to NodeWSServerAdapter.
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

  private _send(socket: WebSocket, msg: object): void {
    try { socket.send(JSON.stringify(msg)); } catch { /* socket may have closed */ }
  }

  private _deny(socket: WebSocket, code: number, reason: string): void {
    try { socket.close(code, reason); } catch { /* already closed */ }
  }
}
