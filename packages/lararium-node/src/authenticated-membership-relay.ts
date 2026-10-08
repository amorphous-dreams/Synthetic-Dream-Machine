/**
 * authenticated-membership-relay — the LIVE-WS `MembershipChannel` transport behind the ONE gate, so the cas-wire
 * member gate reads a PROVEN peer identity, never a self-asserted one.
 *
 * WHY AUTH BINDS TO THE ENVELOPE `from`. cas-wire's `carrierShareDecision` gates the sealed-body carry on the
 * requester's peer id (the envelope `from`). A DUMB re-broadcast relay lets a peer CLAIM any `from`, so a stranger
 * could name a member's id and be served the ciphertext. Carry ⊥ read bounds that (a stranger reads nothing without
 * the read-cap), but the member lane's carry-restriction wants a PROVEN id. This relay closes that: a connecting
 * peer proves it HOLDS its verifying key, and the relay STAMPS every envelope's `from` with that proven key. A
 * forged `from` cannot cross — a peer speaks only AS the key it proved.
 *
 * ONE PROVING DOOR, ONE WIRE. The relay stands the vessel gate itself (`DaemonAuthGate`), not a handshake of its
 * own:
 *   · THE KNOCK — it answers an upgrade only on the path its gate key derives (`knockPath`), and destroys every
 *     other upgrade before any HTTP 101. A dialer carries the relay's gate key as its pin, in the URL fragment
 *     (`ws://host:port#<gate key hex>`): the fragment never leaves the dialer, and it is all a dial needs.
 *   · THE WIRE — `lar:challenge {nonce}` → `lar:auth` (the V3 proof over this relay's audience) → the gate's
 *     SIGNED `lar:auth-ok`, which the dialer reads only under the key it pinned.
 *   · SILENCE — a bad proof, a wrong knock, anything malformed: no answer, and the socket cut at the deadline the
 *     gate drew at accept. No close code and no reason cross.
 *   · ENVELOPES — ride the admitted socket as `lar:session` frames of kind `membership/env`.
 *
 * WHO IT ADMITS. A crossroads relay carries opaque envelopes for ANY proven key: it holds NO read-cap, reads NO
 * ciphertext and keeps no roster, so its sorter classes every proven key a stranger and admits it. Membership is
 * never the relay's to decide — the cas-wire gate reads it off its own replica, as of its last sync.
 *
 * Node-side (the transport branch); the `MembershipChannel` shore + the file impl stay platform-blind.
 * Meme: lar:///ha.ka.ba/lararium/node/authenticated-membership-relay
 */

import { createServer, type IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import * as ed from "@noble/ed25519";
import {
  MEMBERSHIP_RELAY_DOMAIN, MEMBERSHIP_BROADCAST,
  hex, verifyAuthProof, ed25519SignerFromSeed, runPeerHandshake, isLarSessionMsg, mkLarSessionMsg, knockedUrl,
  type AuthVerifierShore, type MembershipChannel, type MembershipEnvelope,
} from "@lararium/mesh";
import { DaemonAuthGate, type SocketSorter } from "./daemon-auth-gate.js";

/** The audience the membership proof-of-possession binds to — distinct from the daemon-bag audience. */
const MEMBERSHIP_AUD = MEMBERSHIP_RELAY_DOMAIN;
/** The session kind an envelope rides under on an admitted socket. */
export const MEMBERSHIP_ENVELOPE_KIND = "membership/env";

const KEY_RE = /^[0-9a-f]{64}$/;

/** A running authenticated membership relay — the WS server + its bound port + the gate key a dialer pins. */
export interface AuthenticatedMembershipRelay {
  readonly port:       number;
  readonly gatePubKey: string;
  close(): Promise<void>;
}

/**
 * The relay's SNIFF observer — the RE-SHARE leg. `onEnvelope` fires for every PROVEN, `from`-stamped envelope the
 * relay carries, so a composing layer (carriage-relay) can pick the `cas-have` announces and learn `cid → holder`
 * FROM THE WIRE into its bag-tracker. `onLeave` fires when a proven socket drops, so the tracker PRUNES that holder
 * (an offline holder never lingers). The relay stays AGNOSTIC to the cas vocabulary — it just surfaces the proven
 * envelopes + departures; the tracker stays a HINT (a member re-verifies every fetched byte). Absent → no sniff.
 */
export interface RelayAnnounceObserver {
  readonly onEnvelope?: (env: MembershipEnvelope) => void;
  readonly onLeave?:    (from: string) => void;
}

/**
 * A pinned dial address: `ws(s)://host[:port][/path]#<gate key hex>`. The fragment is the dialer's own pin and
 * never rides a request. Throws on an address with no 32-byte hex key — a dial with no pin has no gate to reach.
 */
export function pinnedRelayAddress(url: string): { readonly url: string; readonly gatePubKey: string } {
  const u = new URL(url);
  const gatePubKey = u.hash.replace(/^#/, "").toLowerCase();
  if (!KEY_RE.test(gatePubKey)) throw new Error(`a relay address names its gate key in its fragment (#<gate key hex>): ${url}`);
  u.hash = "";
  return { url: u.href, gatePubKey };
}

/** The relay's verify shore: the card IS the peer's raw verifying key, and the V3 proof must hold under it. */
function proofOnlyShore(gatePubKey: string): AuthVerifierShore {
  return {
    async verify(cardBytes, aud, _access, proof) {
      const key = new TextDecoder().decode(cardBytes).trim().toLowerCase();
      if (!KEY_RE.test(key) || !proof) return { ok: false, reason: "no proof" };
      const v = await verifyAuthProof({ nonce: proof.nonce, gatePubKey, peerPubKey: key, aud, sig: proof.sig });
      return v.ok ? { ok: true, identifier: key, proofVerified: true } : { ok: false, ...(v.reason ? { reason: v.reason } : {}) };
    },
  };
}

/** Every proven key rides a crossroads relay: membership is the cas-wire gate's, never the relay's. */
const admitEveryProvenKey: SocketSorter = async () => ({ class: "stranger" });

/**
 * Start an authenticated membership relay on `port` (0 → any free port), keyed by `gateSeed`. Every socket runs
 * the one gate; every admitted socket's envelopes are re-broadcast with `from` STAMPED to the key it proved.
 *
 * @param gateSeed the relay's 32-byte Ed25519 seed — its gate key derives the knock and signs every verdict.
 */
export async function startAuthenticatedMembershipRelay(
  gateSeed: Uint8Array,
  port = 0,
  observer?: RelayAnnounceObserver,
  opts: { readonly authTimeoutMs?: number } = {},
): Promise<AuthenticatedMembershipRelay> {
  const gatePubKey = hex(await ed.getPublicKeyAsync(gateSeed));
  const httpServer = createServer((_req, res) => { res.socket?.destroy(); });
  const wss = new WebSocketServer({ noServer: true });
  const gate = new DaemonAuthGate(wss as unknown as ConstructorParameters<typeof DaemonAuthGate>[0], {
    ...(opts.authTimeoutMs !== undefined ? { authTimeoutMs: opts.authTimeoutMs } : {}),
    onRefuse: () => { /* silence: the cause is no one's to hear */ },
  });
  gate.arm(proofOnlyShore(gatePubKey), MEMBERSHIP_AUD, { pubKey: gatePubKey, sign: ed25519SignerFromSeed(gateSeed) }, admitEveryProvenKey);
  const path = gate.upgradePath("/")!;
  httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (new URL(req.url ?? "/", "http://localhost").pathname !== path) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  const provenKeyOf = (socket: WebSocket): string | null => {
    const id = gate.getIdentifierForSocket(socket as never);
    return id ? id.slice(-64).toLowerCase() : null;
  };
  gate.on("connection", (socket: WebSocket) => {
    const key = provenKeyOf(socket);
    // On departure, surface the proven holder so the tracker PRUNES it (an offline holder never lingers).
    socket.once("close", () => { if (key) observer?.onLeave?.(key); });
  });
  gate.onSession((socket, msg) => {
    if (msg.kind !== MEMBERSHIP_ENVELOPE_KIND || typeof msg.body !== "object" || msg.body === null) return;
    const provenKey = provenKeyOf(socket as unknown as WebSocket);
    if (!provenKey) return;
    // STAMP `from` with the proven key — a forged `from` is overwritten, never trusted. The relay never reads the
    // opaque payload (ciphertext + verify-cap only ride it).
    const stamped: MembershipEnvelope = { ...(msg.body as MembershipEnvelope), from: provenKey };
    observer?.onEnvelope?.(stamped);
    for (const client of gate.clients) {
      if (client !== socket) gate.sendSession(client, MEMBERSHIP_ENVELOPE_KIND, stamped);
    }
  });

  await new Promise<void>((resolve) => httpServer.listen(port, resolve));
  const addr = httpServer.address();
  const boundPort = typeof addr === "object" && addr ? addr.port : port;
  return {
    port: boundPort,
    gatePubKey,
    close: () => new Promise<void>((resolve) => {
      for (const client of wss.clients) client.terminate();
      wss.close(() => httpServer.close(() => resolve()));
    }),
  };
}

/** An envelope this recipient should receive (addressed or broadcast, never self) — deliver-once on poll. */
function forRecipient(e: MembershipEnvelope, recipient: string): boolean {
  return e.from !== recipient && (e.to === recipient || e.to === MEMBERSHIP_BROADCAST);
}

/**
 * The authenticated live-WS membership channel — one connection per vessel, behind the relay's gate. On `connect`
 * it dials the knock its pin derives and completes the one handshake (signs the relay's challenge with
 * `peerSeed`, reads a verdict only under the pinned key), so every envelope it offers rides its PROVEN key as
 * `from`. Satisfies the exact `MembershipChannel` contract (offer/poll, deliver-once) — cas-wire's `serveCasWire`
 * / `fetchSealedCidOverWire` run over it UNCHANGED.
 */
export class AuthenticatedWSMembershipChannel implements MembershipChannel {
  // The inbox is a STABLE array both the socket message handler (push) and poll (splice) share — NEVER reassigned,
  // so a poll that drains it empty before a response arrives cannot orphan the handler's later pushes.
  private constructor(private readonly ws: WebSocket, private readonly inbox: MembershipEnvelope[]) {}

  /**
   * Connect to a PINNED relay address (`ws://host:port#<gate key hex>`) and complete the handshake. Resolves once
   * the relay's signed verdict verifies under the pin; a relay that answers nothing rejects ("no answer").
   *
   * `onClose` fires when a LIVE (verified) channel's socket drops — the shore a reconnecting dialer watches to
   * re-dial + re-fold its board. A drop BEFORE the verdict rejects the pending connect instead, so a dialer
   * reschedules on it too (never hangs a half-open dial). Both settle exactly once.
   */
  static connect(
    address: string,
    peerSeed: Uint8Array,
    opts?: { readonly onClose?: () => void },
  ): Promise<AuthenticatedWSMembershipChannel> {
    return new Promise((resolve, reject) => {
      let pinned: { url: string; gatePubKey: string };
      try { pinned = pinnedRelayAddress(address); } catch (err) { reject(err); return; }
      const ws = new WebSocket(knockedUrl(pinned.url, pinned.gatePubKey));
      const inbox: MembershipEnvelope[] = [];
      let settled = false;
      let verified = false;
      const frames: unknown[] = [];
      const waiters: Array<(v: unknown) => void> = [];
      const deliver = (v: unknown): void => { const w = waiters.shift(); if (w) w(v); else frames.push(v); };
      ws.on("error", (err: Error) => { if (!settled) { settled = true; reject(err); } });
      ws.on("close", () => {
        while (waiters.length) waiters.shift()!(undefined);
        if (!settled) { settled = true; reject(new Error("socket closed before a verdict")); }
        else if (verified) opts?.onClose?.();
      });
      ws.on("message", (data: RawData) => {
        let msg: unknown;
        try { msg = JSON.parse(data.toString()); } catch { return; }
        if (verified) {
          if (isLarSessionMsg(msg) && msg.kind === MEMBERSHIP_ENVELOPE_KIND && typeof msg.body === "object" && msg.body !== null) {
            inbox.push(msg.body as MembershipEnvelope);
          }
          return;
        }
        deliver(msg);
      });
      ws.on("open", () => {
        void (async () => {
          const peerPubKey = hex(await ed.getPublicKeyAsync(peerSeed));
          const verdict = await runPeerHandshake({
            recv: () => frames.length ? Promise.resolve(frames.shift()) : new Promise((r) => waiters.push(r)),
            send: (m) => { try { ws.send(JSON.stringify(m)); } catch { /* closed */ } },
            contactCard: peerPubKey, peerPubKey, gatePubKey: pinned.gatePubKey, aud: MEMBERSHIP_AUD,
            sign: ed25519SignerFromSeed(peerSeed),
          });
          if (settled) return;
          settled = true;
          if (!verdict.ok) { try { ws.close(); } catch { /* closed */ } reject(new Error(verdict.reason)); return; }
          verified = true;
          resolve(new AuthenticatedWSMembershipChannel(ws, inbox));
        })();
      });
    });
  }

  async offer(env: MembershipEnvelope): Promise<void> {
    // The relay STAMPS `from` with this channel's proven key regardless — a caller cannot spoof another id.
    this.ws.send(JSON.stringify(mkLarSessionMsg(MEMBERSHIP_ENVELOPE_KIND, env)));
  }

  async poll(recipient: string): Promise<readonly MembershipEnvelope[]> {
    // Extract the delivered-once envelopes for this recipient + REMOVE them in place (splice), keeping the shared
    // inbox array identity so the socket handler's later pushes always land where the next poll reads.
    const out: MembershipEnvelope[] = [];
    for (let i = 0; i < this.inbox.length; ) {
      if (forRecipient(this.inbox[i]!, recipient)) { out.push(this.inbox[i]!); this.inbox.splice(i, 1); }
      else i++;
    }
    return out;
  }

  close(): void { this.ws.close(); }
}
