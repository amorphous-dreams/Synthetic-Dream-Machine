/**
 * LarWSClientAdapter — the sealed-gate peer transport for a sovereign LEAF actor (platform-blind).
 *
 * The stock `WebSocketClientAdapter` opens its socket and immediately speaks Automerge — no shore for a pre-sync
 * exchange. This subclass dials the pinned gate through `dialFaceGate` (a Noise IK flight, a sealed presentation of the
 * face's chain, a signed finish and the gate's signed verdict), and on `verified` holds the dial's sealed transport as a
 * `dialedChannel`. Automerge's own frames then ride that channel as "sync" messages of the sealed carriage, and a
 * hearth's session messages (a hosting grant push, say) ride it as "session" messages; neither reaches the other's reader.
 * What automerge-repo's network adapter sees is unchanged: a socket-shaped object that opens, carries binary frames and closes.
 *
 * THE PIN. A dial reaches only the gate it pinned. The caller injects the pair index (`pins`, a `hearthPinIndex`) and the
 * hearth and Nexus the dial stands at; the adapter reads the sovereign sync pin at each connect and keeps no global.
 * A pin the index does not hold dials nothing: the leaf ANERGIZES as `pin-absent` until it is re-presented.
 *
 * WHAT A DIAL ANSWERS. `verified` opens the crossing. `silence` is a transport fault (a gate that refuses says nothing, so a
 * dial never learns why): the socket closes and the parent's close path re-dials at its own interval. A signed answer the
 * gate named (`unconfirmed`, `withdrawn`, `incomplete`, `forked`) and a refusal on this side (`refused`) ANERGIZE the leaf with
 * that name, and `answer` holds the gate's unread events for the caller to fold. Anergy is a state, never a longer timer:
 * the leaf stops dialing until `represent` hands it a new presentation.
 *
 * THE SESSION. A verified crossing names `handshakeHash` (hex, this exchange's own) and the pinned gate's signing key.
 *
 * READINESS. automerge's Repo lets a document settle unavailable only once every adapter reads ready, and the parent's
 * own fallback timer never runs here (this class dials its own way). So the leaf READIES when its first dial concludes
 * without a crossing (pin-absent, an index that cannot read, silence, any anergy) and when a crossing names its peer: an
 * idle or anergized leaf never holds a find open. A pin index that THROWS anergizes `pin-unreadable`: no crossing ever
 * stands in CONNECTING with no dial behind it.
 *
 * Stands specified in code until the socket cutover wires its callers (slices D and F); out of the package barrel till then.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/lar-ws-client-adapter
 */

import { WebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import type { PeerId, PeerMetadata } from "@automerge/automerge-repo";
import { SOVEREIGN_SYNC_ROUTE, type DialPinKey } from "./admit-gate-pin.js";
import { isLarSessionMsg, mkLarSessionMsg, type LarSessionMsg } from "./auth-wire.js";
import { HEARTH_FLOOR_PINS_SESSION_KIND, readHearthFloorPinsBody } from "./hearth-floor-pins.js";
import { hex, utf8Bytes } from "./crypto.js";
import type { WithdrawalMemory } from "./face-authority.js";
import { dialFaceGate, type DialSocket, type FaceDialOutcome } from "./face-dial.js";
import type { FaceWithdrawal, VesselFaceCertificate } from "./face-proof-subjects.js";
import type { PresentationArm } from "./gate-exchange.js";
import type { GateBundlePin, GateTier } from "./gate-bundle.js";
import { dialedChannel, type GateSessionChannel } from "./gate-session-channel.js";
import type { SessionSigner } from "./session-signer.js";
import { wsDialSocket } from "./ws-dial-socket.js";

/** The authenticated session a verified crossing holds: this exchange's handshake hash and the pinned gate's signing key. */
export interface LarLeafSession {
  readonly handshakeHash: string;
  readonly gatePubKey:    string;
}

/** What the leaf presents at a dial: its chain's certificate, its session's signer, at most one arm, and its withdrawal history. */
export interface FacePresentation {
  readonly certificate: VesselFaceCertificate;
  readonly signer:      SessionSigner;
  readonly arm:         PresentationArm | null;
  readonly history:     WithdrawalMemory;
  readonly carry?:      readonly FaceWithdrawal[];
}

export interface LarWSClientOptions {
  /** ws:// or wss:// URL of the gate's route (`…/ws`). The knock the pin derives is appended as the last path segment. */
  url:        string;
  /**
   * The pair index, injected: the dial reads the pin for (hearth, nexus, route, tier) from it at each connect. Where it
   * takes `put`, the hearth's floor pin set that arrives over the verified crossing files into it (`hearth/floor-pins`).
   */
  pins:       { get(key: DialPinKey): GateBundlePin | null; put?(hearth: string, pin: unknown): boolean };
  /** The hearth the dial reaches, by its true name (the index's first key part). */
  hearth:     string;
  /** The Nexus the dial stands at, as the pin carries it (hex of the AID's bytes). */
  nexus:      string;
  /** The route and tier; the sovereign sync route and tier where none is named. */
  route?:     string;
  tier?:      GateTier;
  /** What the leaf presents. */
  presentation: FacePresentation;
  /** The target the dial names (the presentation's audience). */
  audience:   string;
  /** The dial's own deadline source; the caller owns the clock. */
  deadlines:  { draw(lapse: () => void): { cancel(): void } };
  /** A fresh dial socket per connect. A WebSocket to `url` with the knock and flight in its upgrade where none is named. */
  dialSocket?: () => DialSocket;
  /** The parent's reconnect delay (ms) after a socket closes. Defaults to the parent's own. */
  retryInterval?: number;
  /**
   * Hears the leaf's anergy at the moment it ANERGIZES, after the state stands (`anergized` already reads the same
   * reason). Each anergy says it once. A hearer that throws changes nothing of the leaf.
   */
  onAnergy?: (reason: string) => void;
}

type Listener = (event: { data?: unknown }) => void;

/** The socket-shaped object automerge's adapter holds: it opens once the dial verified, carries sealed "sync" messages, and closes. */
class CrossingSocket {
  static readonly CONNECTING = 0; static readonly OPEN = 1; static readonly CLOSING = 2; static readonly CLOSED = 3;
  binaryType = "arraybuffer";
  readyState = 0;
  readonly #listeners = new Map<string, Set<Listener>>();
  #channel: GateSessionChannel | null = null;
  addEventListener(type: string, listener: Listener): void {
    let set = this.#listeners.get(type);
    if (!set) { set = new Set(); this.#listeners.set(type, set); }
    set.add(listener);
  }
  removeEventListener(type: string, listener: Listener): void { this.#listeners.get(type)?.delete(listener); }
  emit(type: string, event: { data?: unknown } = {}): void {
    for (const listener of [...(this.#listeners.get(type) ?? [])]) { try { listener(event); } catch { /* one listener never silences another */ } }
  }
  attach(channel: GateSessionChannel): void { this.#channel = channel; this.readyState = 1; }
  get channel(): GateSessionChannel | null { return this.#channel; }
  send(data: ArrayBuffer | Uint8Array): void {
    const channel = this.#channel;
    if (this.readyState !== 1 || channel === null) throw new Error("lar-ws-client-adapter: the crossing is not open");
    channel.send("sync", data instanceof Uint8Array ? data : new Uint8Array(data));
  }
  close(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.#channel?.close();
    this.emit("close");
  }
  /** The channel ended (or the dial never verified): close once, tell the listeners. */
  end(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit("close");
  }
}

export class LarWSClientAdapter extends WebSocketClientAdapter {
  #presentation:        FacePresentation;
  readonly #opts:       LarWSClientOptions;
  #anergized: string | null = null;
  #answer: Extract<FaceDialOutcome, { state: "unconfirmed" | "withdrawn" | "incomplete" | "forked" }> | null = null;
  readonly #onAnergy: ((reason: string) => void) | undefined;
  #stopped = false;
  #verified: CrossingSocket | null = null;
  readonly #provenPeers = new Map<PeerId, string>();
  #session: LarLeafSession | null = null;
  #gateKey: string | null = null;
  readonly #sessionListeners = new Set<(msg: LarSessionMsg) => void>();
  #ready = false;
  #readyResolve: (() => void) | null = null;
  readonly #readyPromise = new Promise<void>((resolve) => { this.#readyResolve = resolve; });

  constructor(opts: LarWSClientOptions) {
    super(opts.url, opts.retryInterval);
    this.#opts = opts;
    this.#presentation = opts.presentation;
    this.#onAnergy = opts.onAnergy;
    this.on("peer-candidate", ({ peerId }: { peerId: PeerId }) => {
      this.#settleReady();
      if (this.#verified !== null && (this.#verified as unknown) === (this.socket as unknown) && this.#gateKey !== null) {
        this.#provenPeers.set(peerId, this.#gateKey);
      }
    });
    this.on("peer-disconnected", ({ peerId }: { peerId: PeerId }) => { this.#provenPeers.delete(peerId); });
  }

  override isReady(): boolean { return this.#ready; }
  override whenReady(): Promise<void> { return this.#readyPromise; }
  #settleReady(): void {
    if (this.#ready) return;
    this.#ready = true;
    this.#readyResolve?.();
  }

  /** The authenticated session the open crossing holds, or null while no dial has verified. */
  get session(): LarLeafSession | null { return this.#session; }

  /** Hear session messages the gate sends on the verified crossing. Returns the unsubscribe. */
  onSession(listener: (msg: LarSessionMsg) => void): () => void {
    this.#sessionListeners.add(listener);
    return () => { this.#sessionListeners.delete(listener); };
  }

  /** Send one session message on the verified crossing. False — nothing sent — while no session stands. */
  sendSession(kind: string, body: unknown): boolean {
    const crossing = this.#verified;
    const channel = crossing?.channel;
    if (!this.#session || !crossing || !channel || (crossing as unknown) !== (this.socket as unknown) || crossing.readyState !== 1) return false;
    try { channel.send("session", utf8Bytes(JSON.stringify(mkLarSessionMsg(kind, body)))); return true; } catch { return false; }
  }

  /** The gate key `peerId` PROVED on this transport — the pinned gate's signing key, over this exchange — or null. */
  provenKeyOf(peerId: PeerId): string | null { return this.#provenPeers.get(peerId) ?? null; }

  /** The leaf's anergy if it has anergized, else null. */
  get anergized(): string | null { return this.#anergized; }

  /** What the gate named, unread, when the leaf anergized on a signed answer; the caller folds each event before it believes one. */
  get answer(): LarWSClientAnswer { return this.#answer; }

  /** The presentation the next dial makes. */
  get presentation(): FacePresentation { return this.#presentation; }

  /**
   * RE-PRESENT under a new presentation — the caller's answer to a change in what it holds (a presentable admit moved, a
   * pin landed in the index), never to a timer. An open crossing CLOSES and the parent's close path re-dials; an anergized
   * leaf clears and dials at once. A transport the caller stopped stays stopped.
   */
  represent(presentation: FacePresentation): void {
    this.#presentation = presentation;
    if (!this.peerId || this.#stopped) return;
    if (this.#anergized) {
      this.#anergized = null;
      this.#answer = null;
      this.connect(this.peerId, this.peerMetadata);
      return;
    }
    try { (this.socket as unknown as CrossingSocket | undefined)?.close(); } catch { /* the reconnect path runs */ }
  }

  override disconnect(): void {
    this.#stopped = true;
    super.disconnect();
  }

  override connect(peerId: PeerId, peerMetadata?: PeerMetadata): void {
    if (this.#anergized) return;
    const current = this.socket as unknown as CrossingSocket | undefined;
    if (current && (current.readyState === 0 || current.readyState === 1)) return;
    this.#stopped = false;
    this.peerId = peerId;
    this.peerMetadata = peerMetadata ?? {};

    const crossing = new CrossingSocket();
    this.socket = crossing as unknown as WebSocket;
    crossing.addEventListener("close", () => {
      if (this.#verified === crossing) { this.#verified = null; this.#session = null; this.#gateKey = null; }
    });
    crossing.addEventListener("close", this.onClose);
    crossing.addEventListener("error", this.onError);
    void this.#dial(crossing).catch(() => {
      // A dial that threw past its own guards ends as silence: the crossing closes and the parent's close path re-dials.
      crossing.end();
      this.#settleReady();
    });
  }

  #anergize(crossing: CrossingSocket, reason: string): void {
    this.#anergized = reason;
    try { console.warn(`[lar-leaf] ANERGIZED: ${reason} — this leaf stays at the floor and will not re-present until something changes.`); } catch { /* a console is a courtesy */ }
    try { this.#onAnergy?.(reason); } catch { /* a hearer never moves the leaf */ }
    crossing.end();
    this.#settleReady();
  }

  async #dial(crossing: CrossingSocket): Promise<void> {
    const { pins, hearth, nexus } = this.#opts;
    const tier = this.#opts.tier ?? "sovereign";
    const route = this.#opts.route ?? SOVEREIGN_SYNC_ROUTE;
    let pin: GateBundlePin | null;
    try { pin = pins.get({ hearth, nexus, route, tier }); }
    catch { return this.#anergize(crossing, "pin-unreadable"); }
    if (pin === null) return this.#anergize(crossing, "pin-absent");
    const presentation = this.#presentation;
    const dialSocket = this.#opts.dialSocket ? this.#opts.dialSocket() : wsDialSocket(this.#opts.url);
    let outcome: FaceDialOutcome;
    try {
      outcome = await dialFaceGate({
        pin, tier, socket: dialSocket, audience: this.#opts.audience, certificate: presentation.certificate, signer: presentation.signer,
        arm: presentation.arm, history: presentation.history, deadlines: this.#opts.deadlines,
        ...(presentation.carry ? { carry: presentation.carry } : {}),
      });
    } catch { outcome = { state: "silence" }; }
    if (crossing.readyState === 3) { try { dialSocket.close(); } catch { /* gone */ } return; }

    switch (outcome.state) {
      case "silence": try { dialSocket.close(); } catch { /* gone */ } crossing.end(); return this.#settleReady();
      case "refused": return this.#anergize(crossing, `refused:${outcome.refusal}`);
      case "unconfirmed": case "withdrawn": case "incomplete": case "forked":
        this.#answer = outcome;
        return this.#anergize(crossing, outcome.state);
      case "verified": break;
    }

    // A throw from here on (the verdict already crossed) must not leave the drawn socket open: close it, then let the
    // launcher's catch end the crossing as silence.
    let channel: GateSessionChannel;
    try {
      channel = dialedChannel({
        transport: outcome.transport,
        socket: { send: (f) => dialSocket.send(f), recv: () => dialSocket.recv(), cut: () => dialSocket.close() },
      });
      const gateKey = pin.signingKey.toLowerCase();
      const session = { handshakeHash: hex(outcome.transport.handshakeHash), gatePubKey: gateKey };
      crossing.attach(channel);
      this.#verified = crossing;
      this.#gateKey = gateKey;
      this.#session = session;
    } catch (error) {
      try { dialSocket.close(); } catch { /* gone */ }
      throw error;
    }
    try { console.log("[lar-leaf] verdict OK — crossing open, syncing"); } catch { /* */ }
    void this.#pump(crossing, channel);
    this.join();
  }

  /**
   * THE FLOOR PIN SET (house ruling "Floor pins", carrier (a)): the verified sovereign crossing is the authenticated
   * relation, so a set at the dialed Nexus files under the dialed hearth, at floor tier, one per route. A set that reads
   * as none files nothing; an index that takes no `put` files nothing.
   */
  #fileFloorPins(body: unknown): void {
    const { pins, hearth, nexus } = this.#opts;
    if ((this.#opts.tier ?? "sovereign") !== "sovereign" || typeof pins.put !== "function") return;
    const set = readHearthFloorPinsBody(body, nexus);
    if (set === null) return;
    for (const pin of set) { try { pins.put(hearth, pin); } catch { /* an index that refuses keeps what it held */ } }
  }

  async #pump(crossing: CrossingSocket, channel: GateSessionChannel): Promise<void> {
    for (;;) {
      const message = await channel.recv();
      if (message === null) break;
      // A crossing the leaf has left (disconnect, a re-presentation, a close) delivers nothing more: a frame the channel
      // handed over before the close lands after it, and the parent's reader asserts a socket that is gone.
      if (this.#verified !== crossing || (this.socket as unknown) !== (crossing as unknown)) break;
      if (message.kind === "sync") {
        const ab = message.bytes.buffer.slice(message.bytes.byteOffset, message.bytes.byteOffset + message.bytes.byteLength) as ArrayBuffer;
        this.onMessage({ data: ab } as MessageEvent);
      } else if (message.kind === "session") {
        let msg: unknown;
        try { msg = JSON.parse(new TextDecoder().decode(message.bytes)); } catch { continue; }
        if (!isLarSessionMsg(msg)) continue;
        if (msg.kind === HEARTH_FLOOR_PINS_SESSION_KIND) this.#fileFloorPins(msg.body);
        for (const listener of this.#sessionListeners) { try { listener(msg); } catch { /* one listener never silences another */ } }
      }
    }
    crossing.end();
  }
}

/** What the gate named, unread. */
export type LarWSClientAnswer = Extract<FaceDialOutcome, { state: "unconfirmed" | "withdrawn" | "incomplete" | "forked" }> | null;
