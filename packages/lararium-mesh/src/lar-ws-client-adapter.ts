/**
 * LarWSClientAdapter — the V3 peer transport for a sovereign LEAF actor (platform-blind).
 *
 * The stock `WebSocketClientAdapter` opens its socket and immediately speaks Automerge — no shore for
 * a pre-sync handshake. This subclass interposes the lar:challenge → lar:auth → verdict handshake
 * (operator-peer #actor-parity) on the SAME socket the gate authenticates, THEN hands that
 * authenticated socket to the parent's Automerge machinery. It mirrors the server side, where
 * DaemonAuthGate runs the handshake on the raw socket before emitting "connection" to the adapter.
 *
 * Composition, not a fork: the handshake half (`runPeerHandshake`) and the leaf IDENTITY
 * (`LeafIdentity` — bare-Ed25519 signer + cached ContactCard, no keyhive) inject; the transport
 * composes them. One core, every platform that holds a leaf identity reuses it — node CLI, the
 * always-on relay's leaf legs, AND the browser vessel (the global `WebSocket` + automerge's
 * isomorphic `WebSocketClientAdapter` carry it unchanged across the worker/window boundary).
 *
 * THE GATE PROVES ITSELF BACK. `runPeerHandshake` reads a passing verdict only when the PINNED gate key
 * signed it over this leaf's own fresh nonce. Once it has, the peer that socket's join yields is a peer whose
 * key this leaf PROVED, and `provenKeyOf(peerId)` answers that key — the proof source a leaf's PersonaGroup
 * ring reads. A peer that arrived on no verified socket reads null.
 *
 * THE SESSION. A verified socket also carries `lar:session` messages — JSON text frames beside Automerge's
 * binary frames — for protocols that ride an authenticated session (a hosting hearth's countersign, say).
 * `session` names what both sides hold for it: the gate's challenge nonce and the pinned gate key. A text
 * frame never reaches the Automerge decoder; a session message is sent only on the verified socket.
 *
 * THE KNOCK. The socket opens on `url` with the knock the PINNED gate key derives (`knockedUrl`), so a leaf
 * reaches only the gate it pinned; a gate keyed otherwise never answers the upgrade.
 *
 * SILENCE IS AN ANSWER. A gate that refuses says nothing and cuts the socket at its own deadline. A socket
 * cut before any challenge is a transport fault (the parent re-dials); a socket cut after this leaf sent its
 * lar:auth is a refusal, and the leaf ANERGIZES exactly as it would on a spoken one.
 *
 * Wire-format note: the handshake speaks JSON text frames; Automerge speaks CBOR binary frames. The
 * two never overlap — the handshake completes (a temporary text pump) before the parent's binary
 * `onMessage` attaches and `join()` fires.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/lar-ws-client-adapter
 */

import { WebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
// automerge-repo 2.6's WebSocket adapter types its socket as the DOM WebSocket — a global in both
// Node 22+ and every browser; use that, not isomorphic-ws (keeps this leaf truly platform-blind).
import type { PeerId, PeerMetadata } from "@automerge/automerge-repo";
import { runPeerHandshake, isLarSessionMsg, mkLarSessionMsg } from "./auth-wire.js";
import { knockedUrl } from "./gate-knock.js";
import type { PeerHandshake, LeafIdentity, LarSessionMsg } from "./auth-wire.js";

/** The authenticated session a verified socket holds: the gate's challenge nonce and the pinned gate key. */
export interface LarLeafSession {
  readonly nonce:      string;
  readonly gatePubKey: string;
}

export interface LarWSClientOptions {
  /** ws:// or wss:// URL of the relay gate's route (`…/ws`). The knock the pinned gate key derives is appended. */
  url:        string;
  /** The leaf's light identity — cached ContactCard + bare-Ed25519 signer. */
  identity:   LeafIdentity;
  /** The target bag URI the leaf seeks (the proof's `aud`). */
  aud:        string;
  /**
   * The relay gate's verifying-key hex — the gate-binding the proof commits to. Known out-of-band
   * (anti-relay; NEVER trusted from the wire). For a leaf connecting to its OWN operator's relay
   * this equals the operator verifying key (= `identity.peerPubKey`). The worker recomputes against
   * its own key, so a mismatch fails closed.
   */
  gatePubKey: string;
  /** The parent's reconnect delay (ms) after a socket closes. Defaults to the parent's own. */
  retryInterval?: number;
}

export class LarWSClientAdapter extends WebSocketClientAdapter {
  #identity:            LeafIdentity;
  readonly #aud:        string;
  readonly #gatePubKey: string;
  /** The gate's refusal, once it has come. A leaf that holds one has ANERGIZED and does not re-present. */
  #anergized: string | null = null;
  /** Set by `disconnect()` — the caller stood this transport down, and nothing below re-dials it. */
  #stopped = false;
  /** The socket whose gate signed its verdict for this leaf; null while none has. */
  #verifiedSocket: WebSocket | null = null;
  /** peerId → the gate key that peer's socket PROVED. Entered only for a peer met on the verified socket. */
  readonly #provenPeers = new Map<PeerId, string>();
  /** The session the verified socket holds; null while none is verified. */
  #session: LarLeafSession | null = null;
  readonly #sessionListeners = new Set<(msg: LarSessionMsg) => void>();

  constructor(opts: LarWSClientOptions) {
    super(knockedUrl(opts.url, opts.gatePubKey), opts.retryInterval);
    this.#identity   = opts.identity;
    this.#aud        = opts.aud;
    this.#gatePubKey = opts.gatePubKey;
    // A peer counts as proven only when it arrives on the socket whose gate signed this leaf's verdict.
    this.on("peer-candidate", ({ peerId }: { peerId: PeerId }) => {
      if (this.#verifiedSocket !== null && this.#verifiedSocket === this.socket) {
        this.#provenPeers.set(peerId, this.#gatePubKey.toLowerCase());
      }
    });
    this.on("peer-disconnected", ({ peerId }: { peerId: PeerId }) => { this.#provenPeers.delete(peerId); });
  }

  /** The authenticated session the open socket holds, or null while no socket's gate has proved itself. */
  get session(): LarLeafSession | null { return this.#session; }

  /** Hear `lar:session` messages the gate sends on the verified socket. Returns the unsubscribe. */
  onSession(listener: (msg: LarSessionMsg) => void): () => void {
    this.#sessionListeners.add(listener);
    return () => { this.#sessionListeners.delete(listener); };
  }

  /** Send one session message on the verified socket. False — nothing sent — while no session stands. */
  sendSession(kind: string, body: unknown): boolean {
    const socket = this.#verifiedSocket;
    if (!this.#session || !socket || socket !== this.socket || socket.readyState !== WebSocket.OPEN) return false;
    try { socket.send(JSON.stringify(mkLarSessionMsg(kind, body))); return true; } catch { return false; }
  }

  /** The key `peerId` PROVED on this transport — the pinned gate key, signed over this leaf's own nonce — or
   *  null for a peer this transport proved nothing about. */
  provenKeyOf(peerId: PeerId): string | null {
    return this.#provenPeers.get(peerId) ?? null;
  }

  /** The gate's refusal if this leaf has anergized, else null. A caller MAY read it to offer a vouch. */
  get anergized(): string | null { return this.#anergized; }

  /** The identity the next handshake presents. */
  get identity(): LeafIdentity { return this.#identity; }

  /**
   * RE-PRESENT under a new identity — the caller's answer to a change in what it holds (a presentable admit
   * appeared or moved on the dialed island's board, or an admit bundle was taken), never to a timer.
   *
   * The handshake runs once per socket, so a new presentation needs a new socket. An open socket CLOSES,
   * and the parent's own close-and-reconnect path re-dials through `connect`, which presents the new
   * identity. An ANERGIZED leaf refuses at its own door (`connect`) and holds no socket; the new identity is
   * the changed thing anergy waits for, so the refusal clears and this dials at the door. Anergy never stood
   * the parent's reconnect loop down, so every later close of that socket re-dials on the parent's path
   * exactly as before the refusal. A transport the caller stopped (`disconnect`) stays stopped.
   */
  represent(identity: LeafIdentity): void {
    this.#identity = identity;
    if (!this.peerId || this.#stopped) return;      // never dialed (the first connect presents it), or stopped
    if (this.#anergized) {
      this.#anergized = null;
      this.connect(this.peerId, this.peerMetadata);
      return;
    }
    try { this.socket?.close(1000, "re-presenting"); } catch { /* already closed — the reconnect path runs */ }
  }

  override disconnect(): void {
    this.#stopped = true;
    super.disconnect();
  }

  override connect(peerId: PeerId, peerMetadata?: PeerMetadata): void {
    // An anergized leaf does not dial. The parent's reconnect path routes back through here, so the
    // state refuses at the DOOR: the one reconnect the refused socket's close schedules lands here and
    // opens nothing, and with no socket open no further close schedules another.
    if (this.#anergized) return;
    // ONE SOCKET AT A TIME. A reconnect the parent scheduled before a re-presentation dialed finds that
    // dial's socket CONNECTING or OPEN, and opens no second one beside it.
    const current = this.socket;
    if (current && (current.readyState === WebSocket.CONNECTING || current.readyState === WebSocket.OPEN)) return;
    this.#stopped = false;

    this.peerId       = peerId;
    this.peerMetadata = peerMetadata ?? {};

    try { console.log(`[lar-leaf] dialing ${this.url} (aud=${this.#aud})`); } catch { /* */ }
    const socket = new WebSocket(this.url);
    socket.binaryType = "arraybuffer";
    this.socket = socket;

    // On open, run the auth handshake FIRST; only on a passing verdict hand the socket to the
    // parent's Automerge flow (binary onMessage + join).
    socket.addEventListener("open", () => { void this.#runHandshake(socket); });
    socket.addEventListener("close", () => {
      if (this.#verifiedSocket === socket) { this.#verifiedSocket = null; this.#session = null; }
    });
    socket.addEventListener("close", this.onClose);
    socket.addEventListener("error", this.onError);
  }

  async #runHandshake(socket: WebSocket): Promise<void> {
    // Temporary JSON text pump — drains gate handshake frames in arrival order.
    const queue:   unknown[] = [];
    const waiters: Array<(v: unknown) => void> = [];
    let ended = false;
    const onText = (event: { data: unknown }): void => {
      if (typeof event.data !== "string") return; // ignore any binary during handshake
      let msg: unknown;
      try { msg = JSON.parse(event.data); } catch { return; }
      const w = waiters.shift();
      if (w) w(msg); else queue.push(msg);
    };
    // A cut socket answers every pending and later read with nothing — the handshake ends, it never hangs.
    const onEnd = (): void => { ended = true; while (waiters.length) waiters.shift()!(undefined); };
    socket.addEventListener("message", onText);
    socket.addEventListener("close", onEnd);
    let challenged = false;

    const handshake: PeerHandshake = {
      recv:        () => {
        const next = queue.length ? Promise.resolve(queue.shift())
          : ended ? Promise.resolve(undefined)
          : new Promise<unknown>((r) => waiters.push(r));
        return next.then((m) => { if (m !== undefined) challenged = true; return m; });
      },
      send:        (m) => socket.send(JSON.stringify(m)),
      contactCard: this.#identity.contactCard,
      peerPubKey:  this.#identity.peerPubKey,
      gatePubKey:  this.#gatePubKey,
      aud:         this.#aud,
      sign:        this.#identity.sign,
      ...(this.#identity.edge ? { edge: this.#identity.edge } : {}),
      ...(this.#identity.presented ? { presented: this.#identity.presented } : {}),
      ...(this.#identity.leafSign ? { leafSign: this.#identity.leafSign } : {}),
    };

    let verdict: Awaited<ReturnType<typeof runPeerHandshake>>;
    try {
      verdict = await runPeerHandshake(handshake);
    } catch {
      socket.removeEventListener("message", onText);
      socket.removeEventListener("close", onEnd);
      try { socket.close(); } catch { /* closed */ }
      return;
    }

    socket.removeEventListener("message", onText);
    socket.removeEventListener("close", onEnd);
    // Cut before any challenge: the gate never spoke — a transport fault, and the parent's close path re-dials.
    if (!verdict.ok && !challenged) return;
    if (!verdict.ok) {
      // ANERGY, not a retry (lar:///ha.ka.ba/lares/api/pono/lararium-identity #the-siege-gate).
      //
      // A refusal is not a transport fault. Closing the socket and letting the parent's reconnect timer
      // dial again treats "you carry no vouch" as "the network hiccuped" — so an un-vouched leaf hammers
      // the gate forever, which is a Sybil flood wearing a client's face. The gate is BORN BESIEGED and
      // the doctrine names what a refused applicant does: it ANERGIZES — stays at the floor (anon),
      // HYPORESPONSIVE, free to re-present LATER with a vouch. Fail-closed reads stay-at-the-floor, never
      // destroy: the vessel keeps working locally, it simply stops presenting.
      //
      // Anergy is a STATE, never a longer timer. Nothing about re-dialing sooner or later supplies the
      // second signal, so the leaf stops dialing until something changes — a vouch, a delegation edge, a
      // gate key it did not have. The state refuses at `connect`, so the reconnect the close below
      // schedules opens nothing; the parent's loop stays armed for the socket a re-presentation opens.
      this.#anergized = verdict.reason;
      try {
        console.warn(
          `[lar-leaf] ANERGIZED: ${this.#anergized}\n` +
          "           This leaf stays at the floor (anon, local-first) and will not re-present. A capability " +
          "alone is signal-1; admission needs signal-2 — a VOUCH from an already-licensed member.",
        );
      } catch { /* a console is a courtesy, never a dependency */ }
      try { socket.close(); } catch { /* closed */ }
      return;
    }

    // Authenticated — hand the SAME socket to the parent's Automerge machinery.
    try { console.log("[lar-leaf] verdict OK — crossing open, syncing"); } catch { /* */ }
    this.#verifiedSocket = socket;
    this.#session = { nonce: verdict.nonce, gatePubKey: this.#gatePubKey.toLowerCase() };
    // Text frames are the session's; binary frames are Automerge's. Neither reaches the other's reader.
    socket.addEventListener("message", (event: MessageEvent) => {
      if (typeof event.data !== "string") { this.onMessage(event); return; }
      let msg: unknown;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (!isLarSessionMsg(msg)) return;
      for (const listener of this.#sessionListeners) {
        try { listener(msg); } catch { /* one listener's throw never silences another */ }
      }
    });
    this.join();
  }
}
