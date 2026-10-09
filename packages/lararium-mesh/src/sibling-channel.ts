/**
 * sibling-channel — leaves of one PersonaGroup sync through a herm, with no listening vessel among them.
 *
 * THE THRESHOLD AND ITS TWO FACES. A herm's relay stands between the leaves, and each side of it keeps its own
 * face (`api/pono/system-pattern-integrities#/threshold-pattern-integrities`):
 *   · OUTWARD — the herm's face: CARRIAGE of sealed frames. A leaf dials the herm's relay through the knock its
 *     pinned gate key derives, proves its device key there (the one gate, the one wire), and joins the channels
 *     its PersonaGroup secrets key at THAT herm (`siblingChannelTag`). The herm routes frames between the keys it
 *     proved on a shared channel and reads none of them: proof frames carry sealed boxes, session frames carry
 *     ciphertext. A non-member — one holding the group's id and no secret — computes no tag and finds no channel.
 *   · INWARD — the siblings' face: the PROVEN SESSION. Two siblings run `leaf-peer-proof` end to end through the
 *     herm, and the proof binds a session (`LeafPeerSession`) that seals every later frame. Nothing the herm knows
 *     enters it: the herm's stamp of a sender key only has to AGREE with the proven edge, never stand in for it.
 * Nothing of the inward face rides the outward one: the herm holds no session key, no secret, no edge in the
 * clear — even when it acts, since a hello it forges draws no box — no PersonaGroup id, and no document byte.
 *
 * WHO STARTS AN EXCHANGE. A leaf that joins says `here` to its channels. A leaf that hears `here` from a key it
 * holds no standing session with re-proves: the lower device key initiates, the higher answers `here` back to
 * it, so each pair runs one exchange. A sibling a rotation left behind meets a sibling ahead of it on the older
 * channel both still join, and the proof hands it the KEL suffix it lacks (`leaf-peer-proof`'s catch-up); the
 * stale leaf extends its KEL (`onKelSuffix`), opens the secret the rotation sealed to it and proves again. The
 * fleet never wedges on a rotation, and a leaf the rotation left out stands revoked and says so.
 *
 * AUTOMERGE RIDES ONLY THE SESSION. `SiblingNetworkAdapter` takes the automerge-repo `NetworkAdapter` shape. A
 * sibling becomes a peer (`peer-candidate`) only once its proof passed AND it named, inside the sealed session, the
 * repo peer id its proven device key derives (`siblingPeerIdOf`); any other id refuses. Its messages ride under that
 * derived id both ways, so a sibling never stands under an id another adapter carries and never inherits that
 * peer's verdict, and one id never names two carriers (`bindRepo`: a collision either way surfaces as `route`).
 * Every sync message is CBOR sealed under the session. `provenKeyOf(peerId)` names the device key a peer proved —
 * the sibling source a PersonaGroup ring reads. A proven sibling holds STANDING, never the vessel: the ring admits
 * it to its face's own planes and the public boards, and to nothing else.
 *
 * DIVERGENCE SURFACES, AND NAMES ITS SUSPECT. Every refusal reaches `onRefusal` (and every `onRefused` listener):
 *   · `peer` — the sibling's own proof failed: an impostor's edge, an edge the KEL head rolled past or the lease
 *     lapsed, a signature that does not hold, a sibling holding no secret in common;
 *   · `relay` — the herm's carriage disturbed a session: a frame that fails the session's key or chain, a `here`
 *     or hello arriving for a standing session, a frame stamped with this leaf's own key, a proof frame for no
 *     exchange. It names the session the relay disturbed, never the sibling as its author, and the leaf tells that
 *     sibling to re-prove, so both halves close and none stands half-open;
 *   · `self` — this leaf's own standing, by cause: `revoked` (the KEL verifies and its head's rotation carries no
 *     sealed enrolment for this device), `unreadable` (the KEL as handed does not verify, so it revokes nothing and
 *     the leaf keeps the standing it last read), `unsealed` (the leaf holds no secret at all). A revoked leaf says
 *     goodbye inside every session it held, so no sibling syncs on into a leaf that proves to no one;
 *   · `route` — the repo routes a sibling's derived peer id through another adapter, so the sibling gets no route.
 * A lawful KEL move closes a session too, without blame: a sibling whose edge the head rolled past hears why inside
 * the session and the pair proves again under the head.
 *
 * NO CLOCK in any decision: freshness is a nonce, licensing is KEL event order and the held lease epoch, frame
 * order is a hash chain. The transport's re-dial delay paces a socket and decides nothing.
 *
 * Platform-blind: the dial uses the global `WebSocket` (every browser, Node 22+).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/identity-slot-policy#/the-leaf-taxonomy
 */

import { NetworkAdapter, cbor, type Message, type PeerId, type PeerMetadata, type Repo } from "@automerge/automerge-repo";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJsonBytes, hex } from "./crypto.js";
import { MEMBERSHIP_RELAY_DOMAIN, SIBLING_CHANNEL_INFO, SIBLING_PEER_ID_INFO } from "./domains.js";
import { runPeerHandshake, isLarSessionMsg, mkLarSessionMsg } from "./auth-wire.js";
import { knockedUrl, pinnedRelayAddress } from "./gate-knock.js";
import {
  startLeafPeerProof, answerLeafPeerProof, finishLeafPeerProof, acceptLeafPeerProof, openLeafCatchUp, isLeafSessionFrame,
  type LeafPeerSelf, type LeafPeerState, type LeafPeerFrame, type LeafPeerSession, type LeafSessionFrame,
} from "./leaf-peer-proof.js";
import { headOpKey, verifyPersonaKelFull, type PersonaKelEvent } from "./persona-kel.js";
import { personaKelChainForPrefix, writePersonaKelEvent } from "./persona-kel-board.js";
import { materializeSharedLarDoc, personaKelBoardDocUrl } from "./deterministic-doc.js";
import { leafStandingUnder, type GroupSecretOpener, type PersonaGroupEnrolment } from "./persona-group-secret.js";

const KEY_RE = /^[0-9a-f]{64}$/;

/** The session kind a leaf joins its channels under. Body: `{ channels }` — a later join adds to the set. */
export const SIBLING_JOIN_KIND = "sibling/join";
/** The session kind a sibling frame rides. Leaf → herm: `{ to, frame }` (`to` null for every channel it joined).
 *  Herm → leaf: `{ from, frame }`, `from` STAMPED with the key the herm proved for the sender. */
export const SIBLING_FRAME_KIND = "sibling/frame";

/**
 * The channel one PersonaGroup secret keys at one herm: HMAC-SHA256 under the secret over `SIBLING_CHANNEL_INFO`
 * and the herm's gate key. Only a member computes it; two herms see two tags; the herm reads no group out of it.
 */
export function siblingChannelTag(secret: Uint8Array, gatePubKey: string): string {
  return hex(hmac(sha256, secret, canonicalJsonBytes({ domain: SIBLING_CHANNEL_INFO, gate: gatePubKey.toLowerCase() })));
}

/** What a sibling frame carries, inside the herm's `{ frame }`. Only `here` and the proof's outer fields read
 *  in the clear; everything a sibling says after the proof rides `seal`. */
export type SiblingWireFrame =
  | { readonly t: "here" }
  | { readonly t: "proof"; readonly p: LeafPeerFrame }
  | { readonly t: "seal";  readonly s: LeafSessionFrame };

/** The herm-facing half: channel joins, frames out to a proven key (or every joined channel), frames in stamped
 *  with the sender's proven key. The herm's relay stands behind it; a test may stand any relay it likes. */
export interface SiblingTransport {
  /** Join the channel each secret keys at this herm. A later call adds channels; it never leaves one. */
  join(secrets: readonly Uint8Array[]): void;
  send(to: string | null, frame: SiblingWireFrame): void;
  onFrame(listener: (from: string, frame: unknown) => void): () => void;
  /** Fires once when the transport drops. */
  onClose(listener: () => void): () => void;
  close(): void;
}

/** Why a leaf stands with no standing of its own to prove under. */
export type SiblingSelfCause =
  /** The KEL verifies, and the rotation that seated its head carries no sealed enrolment for this device. */
  | "revoked"
  /** The KEL as the board holds it does not verify — a torn, padded, stripped or unattested event. The leaf keeps
   *  the standing it last read off a KEL that verified, and revokes nothing on the board's word. */
  | "unreadable"
  /** The leaf holds no PersonaGroup secret sealed to it under any op-key the KEL seats: its seal is missing. */
  | "unsealed";

/** A refusal the adapter surfaces, and whom it suspects. */
export type SiblingRefusal =
  /** The sibling's own proof failed, or it closed its session and said why. */
  | { readonly suspect: "peer";  readonly peerKey: string; readonly reason: string }
  /** The herm's carriage disturbed the session held with `session` (null when it named none). Never an accusation
   *  of that sibling. */
  | { readonly suspect: "relay"; readonly session: string | null; readonly reason: string }
  /** This leaf's own standing under the KEL it carries: revoked, unreadable or unsealed (`cause`). */
  | { readonly suspect: "self";  readonly cause: SiblingSelfCause; readonly reason: string }
  /** The repo already routes this sibling's derived peer id through ANOTHER adapter, so the sibling gets no route
   *  here: a peer id never names two carriers at once. */
  | { readonly suspect: "route"; readonly peerKey: string; readonly peerId: string; readonly reason: string };

/** A refusal's suspect, as one short label a vessel's log line reads: the cause or the key it names, abbreviated. */
export function siblingRefusalLabel(r: SiblingRefusal): string {
  switch (r.suspect) {
    case "peer":  return `peer ${r.peerKey.slice(0, 8)}…`;
    case "route": return `route ${r.peerKey.slice(0, 8)}…`;
    case "self":  return `self: ${r.cause}`;
    case "relay": return "relay";
  }
}

/**
 * The repo peer id a sibling stands under: a hash, under `SIBLING_PEER_ID_INFO`, of the device key it proved over
 * the session. A sibling NAMES this id inside the session and the leaf refuses any other, so a sibling never
 * stands under an id another adapter carries (the operator's own node, a relay peer, an island worker) and never
 * inherits that peer's share verdict. The id is derived on both sides alone; nothing a sibling chooses enters it.
 */
export function siblingPeerIdOf(deviceKey: string): PeerId {
  return `sibling-${hex(sha256(canonicalJsonBytes({ domain: SIBLING_PEER_ID_INFO, key: deviceKey.toLowerCase() })))}` as PeerId;
}

/**
 * Dial a herm's relay as a leaf: open the knock the pinned gate key derives, prove this leaf's device key through
 * the one handshake (`runPeerHandshake` against the relay's audience, the verdict read only under the pin).
 * Resolves the transport, or rejects with the reason the handshake gave — a herm that meets a leaf with silence
 * rejects "no answer". The transport's `join` keys each channel tag with the pinned gate key.
 *
 * @param address the herm's pinned relay address, `ws://host:port#<gate key hex>`.
 */
export function dialSiblingHerm(opts: {
  readonly address: string;
  readonly deviceKey: string;
  readonly sign: (bytes: Uint8Array) => Promise<string> | string;
}): Promise<SiblingTransport> {
  return new Promise((resolve, reject) => {
    let pinned: { url: string; gatePubKey: string };
    try { pinned = pinnedRelayAddress(opts.address); } catch (err) { reject(err); return; }
    const ws = new WebSocket(knockedUrl(pinned.url, pinned.gatePubKey));
    const frameListeners = new Set<(from: string, frame: unknown) => void>();
    const closeListeners = new Set<() => void>();
    const pending: unknown[] = [];
    const waiters: Array<(v: unknown) => void> = [];
    let verified = false;
    let settled = false;
    const settleReject = (err: Error): void => { if (!settled) { settled = true; reject(err); } };
    ws.addEventListener("error", () => settleReject(new Error("the herm's socket faulted before a verdict")));
    ws.addEventListener("close", () => {
      while (waiters.length) waiters.shift()!(undefined);
      settleReject(new Error("the herm's socket closed before a verdict"));
      if (verified) for (const l of closeListeners) { try { l(); } catch { /* one listener never silences another */ } }
    });
    ws.addEventListener("message", (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      let msg: unknown;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (!verified) { const w = waiters.shift(); if (w) w(msg); else pending.push(msg); return; }
      if (!isLarSessionMsg(msg) || msg.kind !== SIBLING_FRAME_KIND) return;
      const body = msg.body as { from?: unknown; frame?: unknown } | null;
      if (!body || typeof body.from !== "string" || !KEY_RE.test(body.from)) return;
      for (const l of frameListeners) { try { l(body.from, body.frame); } catch { /* isolated */ } }
    });
    const sendSession = (kind: string, body: unknown): void => {
      if (ws.readyState !== WebSocket.OPEN) return;
      try { ws.send(JSON.stringify(mkLarSessionMsg(kind, body))); } catch { /* closed */ }
    };
    ws.addEventListener("open", () => {
      void (async () => {
        const deviceKey = opts.deviceKey.toLowerCase();
        const verdict = await runPeerHandshake({
          recv: () => pending.length ? Promise.resolve(pending.shift()) : new Promise((r) => waiters.push(r)),
          send: (m) => { try { ws.send(JSON.stringify(m)); } catch { /* closed */ } },
          contactCard: deviceKey, peerPubKey: deviceKey, gatePubKey: pinned.gatePubKey, aud: MEMBERSHIP_RELAY_DOMAIN,
          sign: opts.sign,
        });
        if (settled) return;
        if (!verdict.ok) { settled = true; try { ws.close(); } catch { /* closed */ } reject(new Error(verdict.reason)); return; }
        verified = true;
        settled = true;
        resolve({
          join: (secrets) => sendSession(SIBLING_JOIN_KIND, { channels: secrets.map((s) => siblingChannelTag(s, pinned.gatePubKey)) }),
          send: (to, frame) => sendSession(SIBLING_FRAME_KIND, { to, frame }),
          onFrame: (l) => { frameListeners.add(l); return () => { frameListeners.delete(l); }; },
          onClose: (l) => { closeListeners.add(l); return () => { closeListeners.delete(l); }; },
          close: () => { try { ws.close(); } catch { /* closed */ } },
        });
      })();
    });
  });
}

/** One sibling, as this leaf holds it. */
interface SiblingSlot {
  /** The exchange in flight with it, and this leaf's role in it. */
  proving?: { readonly role: "initiator" | "responder"; readonly state: LeafPeerState };
  /** The session its proof admitted. */
  session?: LeafPeerSession;
  /** The repo peer id it named inside the session — always `siblingPeerIdOf` its proven key. */
  peerId?: PeerId;
}

export interface SiblingNetworkAdapterOptions {
  /** Stand the herm-facing transport. Called on connect and again after a drop. */
  readonly transport: () => Promise<SiblingTransport>;
  /** This leaf under a KEL: its device key and signer, its newest edge, its secrets, the lease epoch it holds.
   *  Read again whenever the KEL moves (`leafStandingUnder` composes it). */
  readonly leaf: (kel: readonly PersonaKelEvent[]) => Promise<LeafPeerSelf>;
  /** The PersonaGroup's persona-KEL as this leaf carries it at the start. */
  readonly kel: readonly PersonaKelEvent[];
  /** Hears the events a catch-up extended this leaf's KEL by — the caller lands them on its own board. */
  readonly onKelSuffix?: (events: readonly PersonaKelEvent[]) => void;
  /** Hears every refusal, as `onRefused` listeners do. */
  readonly onRefusal?: (refusal: SiblingRefusal) => void;
  /** Delay before re-dialing a dropped herm. Paces a socket; decides nothing. */
  readonly retryInterval?: number;
}

/** Why a leaf closes a session it holds, said inside that session so only the sibling reads it. */
type CloseWhy =
  /** The KEL head moved past the edge the sibling proved with: the pair proves again under the head. */
  | "rolled"
  /** This leaf's own KEL revoked it: it leaves every session and proves to no one. */
  | "revoked"
  /** The sibling's repo already routes this leaf's peer id through another adapter. */
  | "route";

type SealedBody =
  | { readonly t: "peer";  readonly peerId: string; readonly peerMetadata?: PeerMetadata }
  | { readonly t: "msg";   readonly m: Message }
  | { readonly t: "close"; readonly why: CloseWhy };

/** The repo surface a sibling channel reads to keep one peer id on one carrier. */
export interface SiblingRepoRoutes {
  /** Every peer the repo holds, through any adapter. */
  readonly peers: readonly PeerId[];
  readonly networkSubsystem: { on(event: "peer", listener: (p: { peerId: PeerId }) => void): unknown };
}

/**
 * The automerge-repo network adapter over a PersonaGroup's sibling channel. Sync messages ride only sessions a
 * leaf-peer proof admitted; see the module header for the threshold it keeps.
 */
export class SiblingNetworkAdapter extends NetworkAdapter {
  readonly #opts: SiblingNetworkAdapterOptions;
  #kel: readonly PersonaKelEvent[];
  #self: LeafPeerSelf | null = null;
  /** True while the KEL this leaf carries leaves it no secret under the head: it proves to no one. */
  #revoked = false;
  /** The last KEL this leaf read as unreadable, by its event cids — one board state surfaces once. */
  #unreadableSeen: string | null = null;
  #transport: SiblingTransport | null = null;
  #unsubs: Array<() => void> = [];
  readonly #siblings = new Map<string, SiblingSlot>();
  readonly #keyOfPeer = new Map<PeerId, string>();
  /** Sessions this leaf closed itself, kept only to read the sibling's frames still in flight on them. */
  readonly #closing = new Map<string, LeafPeerSession>();
  #routes: SiblingRepoRoutes | null = null;
  /** The peer id this adapter is announcing, while the repo's own `peer` event for it fires. */
  #announcing: PeerId | null = null;
  #ready = false;
  #stopped = false;
  #readyResolvers: Array<() => void> = [];
  #retry: ReturnType<typeof setTimeout> | null = null;
  readonly #refusalListeners = new Set<(refusal: SiblingRefusal) => void>();
  /** Frames judge one at a time, in arrival order: a proof's verdict lands before the next frame reads it. */
  #inbound: Promise<void> = Promise.resolve();

  constructor(opts: SiblingNetworkAdapterOptions) {
    super();
    this.#opts = opts;
    this.#kel = opts.kel;
  }

  isReady(): boolean { return this.#ready; }

  whenReady(): Promise<void> {
    return this.#ready ? Promise.resolve() : new Promise((r) => this.#readyResolvers.push(r));
  }

  /** Hear every refusal this channel surfaces. Returns the unsubscribe. */
  onRefused(listener: (refusal: SiblingRefusal) => void): () => void {
    this.#refusalListeners.add(listener);
    return () => { this.#refusalListeners.delete(listener); };
  }

  /** The device key `peerId` PROVED over this channel, or null for a peer it proved nothing about. */
  provenKeyOf(peerId: PeerId): string | null {
    return this.#keyOfPeer.get(peerId) ?? null;
  }

  /** The KEL this leaf carries, as its last catch-up or board move left it. */
  get kel(): readonly PersonaKelEvent[] { return this.#kel; }

  /**
   * Bind this channel to the repo that carries it, so one peer id never names two carriers. A sibling whose
   * derived id the repo already holds through another adapter gets no route here; an adapter that announces a
   * sibling's id after it stood takes the route, and the sibling leaves. Both surface as `route`.
   */
  bindRepo(repo: SiblingRepoRoutes): void {
    this.#routes = repo;
    repo.networkSubsystem.on("peer", ({ peerId }) => this.#observeRoute(peerId));
  }

  connect(peerId: PeerId, peerMetadata?: PeerMetadata): void {
    this.peerId = peerId;
    this.peerMetadata = peerMetadata ?? {};
    this.#stopped = false;
    void this.#dial();
  }

  disconnect(): void {
    this.#stopped = true;
    if (this.#retry) { clearTimeout(this.#retry); this.#retry = null; }
    const t = this.#transport;
    this.#dropAll();
    t?.close();
    this.emit("close");
  }

  /**
   * Carry one repo message to the sibling it targets. A sibling vouches only for this repo's own words: a message
   * another peer authored (a relayed ephemeral) never crosses, and this repo's own speak under the peer id the
   * sibling derives for this leaf's proven key.
   */
  send(message: Message): void {
    const key = this.#keyOfPeer.get(message.targetId);
    const session = key ? this.#siblings.get(key)?.session : undefined;
    const self = this.#self;
    if (!key || !session || session.refusal !== null || !self) return;
    if (message.senderId !== this.peerId) return;
    this.#sendSealed(key, session, { t: "msg", m: { ...message, senderId: siblingPeerIdOf(self.deviceKey) } as Message });
  }

  /**
   * Stand this leaf again under a KEL it now carries: re-read its secrets and newest edge, join any channel a new
   * secret keys, and re-judge every standing session. A session whose sibling proved with an edge the moved head
   * rolled past closes, the sibling hears why inside it, and the pair proves again under the head — where the
   * head re-enrolled that sibling the fresh proof stands, and where it revoked it the sibling says so itself.
   */
  async relicense(kel: readonly PersonaKelEvent[]): Promise<void> {
    if (!(await this.#stand(kel))) return;
    const self = this.#self;
    if (!self || this.#revoked) return;
    for (const [key, slot] of [...this.#siblings]) {
      const session = slot.session;
      if (!session) continue;
      const verdict = await session.relicense(this.#kel, self.expectedEpoch);
      if (verdict.ok || this.#siblings.get(key)?.session !== session) continue;
      this.#close(key, session, "rolled");
      if (self.deviceKey.toLowerCase() < key) this.#hello(key);
    }
  }

  /**
   * Read this leaf's standing under `kel`. Returns false when the leaf stands as it stood: the KEL did not verify
   * and a standing read off one that did holds. A KEL that does not verify revokes nothing: the leaf surfaces it as
   * `unreadable` once per board state and keeps its standing, or — holding none yet — stands under the longest
   * prefix that verifies. A KEL that verifies and leaves the leaf no secret under its head surfaces as `revoked`
   * (or `unsealed`, when the leaf holds no secret at all); the leaf says goodbye inside every session it holds.
   */
  async #stand(offered: readonly PersonaKelEvent[]): Promise<boolean> {
    let kel = offered;
    const verified = await verifyPersonaKelFull(kel);
    if (!verified.ok) {
      const seen = kel.map((e) => e.eventCid).join(",");
      if (this.#unreadableSeen !== seen) {
        this.#unreadableSeen = seen;
        this.#surface({ suspect: "self", cause: "unreadable", reason: `the KEL this leaf was handed does not verify: ${verified.reason ?? "refused"} — the leaf keeps the standing it last read` });
      }
      if (this.#self) return false;
      kel = await longestVerifiedPrefix(kel);
    }
    this.#kel = kel;
    const self = await this.#opts.leaf(kel);
    this.#self = self;
    const head = await headOpKey(kel, { verifyQuorums: true });
    const newest = self.secrets[self.secrets.length - 1];
    const standing = head !== null && newest !== undefined && newest.opKeyDid.toLowerCase() === head.toLowerCase();
    if (!standing && !this.#revoked) {
      this.#revoked = true;
      this.#surface(self.secrets.length === 0
        ? { suspect: "self", cause: "unsealed", reason: "this leaf holds no PersonaGroup secret sealed to it under any op-key its KEL seats — its enrolment seal is missing" }
        : { suspect: "self", cause: "revoked", reason: "this leaf holds no PersonaGroup secret under its KEL head — the rotation that seated the head left this device out" });
      // GOODBYE: every sibling hears it inside its session, so none syncs on into a leaf that proves to no one.
      for (const [key, slot] of [...this.#siblings]) {
        if (slot.session) this.#close(key, slot.session, "revoked");
        else this.#leave(key);
      }
    }
    if (!standing) return true;
    this.#transport?.join(self.secrets.map((s) => s.secret));
    // A later rotation that re-enrols this device stands it again: it says `here` to its channels once more.
    if (this.#revoked) { this.#revoked = false; this.#transport?.send(null, { t: "here" }); }
    return true;
  }

  async #dial(): Promise<void> {
    if (this.#stopped || this.#transport) return;
    if (!this.#self) await this.#stand(this.#kel);
    let transport: SiblingTransport;
    try {
      transport = await this.#opts.transport();
    } catch {
      // A herm that cannot be reached still settles readiness: the repo's documents must not wait on a dial.
      this.#markReady();
      this.#scheduleRedial();
      return;
    }
    if (this.#stopped) { transport.close(); return; }
    this.#transport = transport;
    this.#unsubs = [
      transport.onFrame((from, frame) => {
        this.#inbound = this.#inbound.then(() => this.#onFrame(from.toLowerCase(), frame)).catch(() => { /* judged */ });
      }),
      transport.onClose(() => {
        this.#transport = null;
        this.#dropAll();
        this.#scheduleRedial();
      }),
    ];
    this.#markReady();
    if (this.#revoked || !this.#self) return;
    transport.join(this.#self.secrets.map((s) => s.secret));
    transport.send(null, { t: "here" });
  }

  #markReady(): void {
    if (this.#ready) return;
    this.#ready = true;
    for (const r of this.#readyResolvers.splice(0)) r();
  }

  #scheduleRedial(): void {
    if (this.#stopped || this.#retry) return;
    this.#retry = setTimeout(() => { this.#retry = null; void this.#dial(); }, this.#opts.retryInterval ?? 5000);
  }

  #dropAll(): void {
    for (const u of this.#unsubs.splice(0)) u();
    for (const key of [...this.#siblings.keys()]) this.#leave(key);
    this.#closing.clear();
  }

  /** The sibling's peer leaves this repo; its slot clears. */
  #leave(key: string): void {
    const slot = this.#siblings.get(key);
    this.#siblings.delete(key);
    if (slot?.peerId) {
      this.#keyOfPeer.delete(slot.peerId);
      this.emit("peer-disconnected", { peerId: slot.peerId });
    }
  }

  /**
   * Close a session this leaf holds and tell the sibling why, inside the session, so its half closes too and it
   * syncs nothing on into a session that no longer stands. The session stays readable only for the sibling's
   * frames already in flight.
   */
  #close(key: string, session: LeafPeerSession, why: CloseWhy): void {
    if (session.refusal === null) this.#sendSealed(key, session, { t: "close", why });
    this.#closing.set(key, session);
    this.#leave(key);
  }

  #surface(refusal: SiblingRefusal): void {
    for (const l of [this.#opts.onRefusal, ...this.#refusalListeners]) {
      try { l?.(refusal); } catch { /* a listener's throw never hides the refusal from another */ }
    }
  }

  /**
   * The sibling's own proof failed. When a session stood with it, the sibling hears `here` so its own half
   * closes too and the pair proves again — where that sibling's edge still fails, it fails again, said again.
   */
  #refusePeer(key: string, reason: string, hadSession = false): void {
    this.#leave(key);
    if (hadSession) this.#transport?.send(key, { t: "here" });
    this.#surface({ suspect: "peer", peerKey: key, reason });
  }

  /**
   * The herm's carriage disturbed the session held with `key`. The session closes on this side, the sibling hears
   * `here` so its half closes as well (no half-open pair, no stale peer left proven), and the refusal names the
   * relay path — never the sibling as the frame's author.
   */
  #refuseRelay(key: string | null, reason: string, tellSibling: boolean): void {
    if (key !== null) {
      const hadSession = Boolean(this.#siblings.get(key)?.session);
      this.#leave(key);
      if (tellSibling && hadSession) this.#transport?.send(key, { t: "here" });
    }
    this.#surface({ suspect: "relay", session: key, reason });
  }

  /** Another carrier holds the sibling's peer id: the sibling gets no route here, hears why and stays closed. */
  #refuseRoute(key: string, peerId: PeerId, reason: string): void {
    const session = this.#siblings.get(key)?.session;
    if (session) this.#close(key, session, "route");
    else this.#leave(key);
    this.#surface({ suspect: "route", peerKey: key, peerId, reason });
  }

  /** The repo announced `peerId` through some adapter. When another adapter took a sibling's id, the route moved. */
  #observeRoute(peerId: PeerId): void {
    if (peerId === this.#announcing) return;
    const key = this.#keyOfPeer.get(peerId);
    if (key) this.#refuseRoute(key, peerId, "another adapter announced this sibling's peer id after it stood — the repo routes the id there, so the sibling leaves");
  }

  #sendSealed(key: string, session: LeafPeerSession, body: SealedBody): void {
    const frame = session.seal(cbor.encode(body));
    this.#transport?.send(key, { t: "seal", s: frame });
  }

  /** Open an exchange with `key` as its initiator, under this leaf's newest secret. */
  #hello(key: string): void {
    const self = this.#self;
    if (!self || this.#revoked) return;
    const { frame: hello, state } = startLeafPeerProof(self);
    this.#siblings.set(key, { proving: { role: "initiator", state } });
    this.#transport?.send(key, { t: "proof", p: hello });
  }

  async #onFrame(from: string, raw: unknown): Promise<void> {
    const self = this.#self;
    const transport = this.#transport;
    if (!self || !transport) return;
    if (from === self.deviceKey.toLowerCase()) {
      this.#refuseRelay(null, "the herm carried a frame stamped with this leaf's own key back to it", false);
      return;
    }
    const frame = raw as Partial<{ t: string; p: LeafPeerFrame; s: unknown }> | null;
    if (!frame || typeof frame.t !== "string") return;
    // A frame sealed under a session this leaf closed itself is the sibling's, still in flight: it opens there, or
    // the herm carried it, and the refusal says so.
    if (frame.t === "seal" && !this.#siblings.get(from)?.session && this.#closing.has(from)) {
      const opened = isLeafSessionFrame(frame.s) ? this.#closing.get(from)!.open(frame.s) : null;
      if (!opened?.ok) { this.#closing.delete(from); this.#refuseRelay(from, "a sealed frame arrived under a session this leaf closed, and it never sealed there", false); }
      return;
    }
    if (this.#revoked) return;
    const slot = this.#siblings.get(from);

    if (frame.t === "here") {
      // A sibling (re)joined — or the herm says so. A session that stood with it closes, and that surfaces: either
      // the sibling dropped and came back, or the herm forged the word. The pair re-proves: the lower key
      // initiates, the higher says `here` back so the lower one does. An exchange already in flight answers it.
      if (slot?.session) this.#refuseRelay(from, "a here arrived for a standing session — the sibling rejoined or the herm forged it; the pair proves again", false);
      else if (slot?.proving?.role === "initiator") return;
      if (self.deviceKey.toLowerCase() < from) this.#hello(from);
      else transport.send(from, { t: "here" });
      return;
    }

    if (frame.t === "proof" && frame.p && typeof frame.p === "object") {
      const p = frame.p;
      if (p.step === "hello") {
        if (slot?.session) this.#refuseRelay(from, "a hello arrived for a standing session — the sibling rejoined or the herm forged it; the pair proves again", false);
        const answered = await answerLeafPeerProof(self, p);
        if (answered.kind === "malformed") { this.#refuseRelay(from, `a malformed hello: ${answered.reason}`, false); return; }
        if (answered.kind === "unmatched") {
          // No secret this leaf holds keyed that hint. A sibling AHEAD of this leaf holds newer secrets only it
          // knows, so this leaf says hello under its own and lets the sibling hand it the catch-up. When this
          // leaf's own hello already drew an unmatched hello back, the two hold no secret in common.
          if (slot?.proving?.role === "initiator") { this.#refusePeer(from, "the sibling holds no PersonaGroup secret this leaf holds, nor this leaf one it holds"); return; }
          this.#hello(from);
          return;
        }
        if (answered.kind === "catch-up") {
          this.#siblings.delete(from);
          transport.send(from, { t: "proof", p: answered.frame });
          return;
        }
        this.#siblings.set(from, { proving: { role: "responder", state: answered.state } });
        transport.send(from, { t: "proof", p: answered.frame });
        return;
      }
      if (!slot?.proving) { this.#refuseRelay(from, `a ${String(p.step)} arrived for no exchange this leaf opened`, false); return; }
      if (p.step === "catch-up" && slot.proving.role === "initiator") {
        const caught = await openLeafCatchUp(self, slot.proving.state, p);
        if (!caught.ok) {
          if (caught.reason.includes("does not open")) this.#refuseRelay(from, caught.reason, false);
          else this.#refusePeer(from, caught.reason);
          return;
        }
        const before = new Set(this.#kel.map((e) => e.eventCid));
        const fresh = caught.kel.filter((e) => !before.has(e.eventCid));
        try { this.#opts.onKelSuffix?.(fresh); } catch { /* the board's write never blocks the catch-up */ }
        await this.relicense(caught.kel);
        if (!this.#revoked) this.#hello(from);
        return;
      }
      if (p.step === "answer" && slot.proving.role === "initiator") {
        const { verdict, frame: finish } = await finishLeafPeerProof(self, slot.proving.state, p, from);
        if (!verdict.ok) { this.#refusePeer(from, verdict.reason); return; }
        if (finish) transport.send(from, { t: "proof", p: finish });
        this.#open(from, verdict.session);
        return;
      }
      if (p.step === "finish" && slot.proving.role === "responder") {
        const verdict = await acceptLeafPeerProof(self, slot.proving.state, p, from);
        if (!verdict.ok) { this.#refusePeer(from, verdict.reason); return; }
        this.#open(from, verdict.session);
        return;
      }
      this.#refuseRelay(from, `a ${String(p.step)} arrived out of its exchange's order`, false);
      return;
    }

    if (frame.t === "seal") {
      const session = slot?.session;
      if (!session || !isLeafSessionFrame(frame.s)) { this.#refuseRelay(from, "a sealed frame arrived under a key that holds no proven session", false); return; }
      const opened = session.open(frame.s);
      if (!opened.ok) { this.#refuseRelay(from, `the herm carried a frame this session never sealed: ${opened.reason}`, true); return; }
      let body: SealedBody;
      try { body = cbor.decode(opened.plaintext) as SealedBody; } catch { this.#refusePeer(from, "a sealed frame opened torn", true); return; }
      if (body?.t === "close") {
        // The sibling closed its half and said why, inside the session the herm cannot speak in.
        this.#leave(from);
        this.#closing.set(from, session);
        if (body.why === "rolled") { if (self.deviceKey.toLowerCase() < from) this.#hello(from); return; }
        this.#surface({ suspect: "peer", peerKey: from, reason: body.why === "revoked"
          ? "the sibling closed its session: its own KEL revoked it"
          : "the sibling closed its session: its repo routes this leaf's peer id through another adapter" });
        return;
      }
      if (body?.t === "peer") {
        if (typeof body.peerId !== "string" || slot!.peerId) { this.#refusePeer(from, "a sibling named its peer id twice", true); return; }
        const peerId = siblingPeerIdOf(from);
        if (body.peerId !== peerId) { this.#refusePeer(from, "a sibling named a repo peer id its proven device key does not derive", true); return; }
        if (this.#routes?.peers.includes(peerId)) {
          this.#refuseRoute(from, peerId, "the repo already holds this sibling's peer id through another adapter — one id names one carrier");
          return;
        }
        slot!.peerId = peerId;
        this.#keyOfPeer.set(peerId, from);
        this.#closing.delete(from);
        this.#announcing = peerId;
        try { this.emit("peer-candidate", { peerId, peerMetadata: body.peerMetadata ?? {} }); }
        finally { this.#announcing = null; }
        return;
      }
      if (body?.t === "msg" && body.m && typeof body.m === "object") {
        if (!slot!.peerId || body.m.senderId !== slot!.peerId) { this.#refusePeer(from, "a sibling spoke under a peer id it never named", true); return; }
        this.emit("message", { ...body.m, targetId: this.peerId } as Message);
        return;
      }
      this.#refusePeer(from, "a sealed frame carried nothing this channel speaks", true);
    }
  }

  /** A proof passed: the session stands, and the first thing it carries is the peer id this leaf's key derives. */
  #open(key: string, session: LeafPeerSession): void {
    const slot: SiblingSlot = { session };
    this.#siblings.set(key, slot);
    const self = this.#self;
    if (!self) return;
    this.#sendSealed(key, session, { t: "peer", peerId: siblingPeerIdOf(self.deviceKey), ...(this.peerMetadata ? { peerMetadata: this.peerMetadata } : {}) });
  }
}

/** The longest prefix of `kel` that verifies in full, or the empty chain. */
async function longestVerifiedPrefix(kel: readonly PersonaKelEvent[]): Promise<readonly PersonaKelEvent[]> {
  for (let n = kel.length - 1; n > 0; n--) {
    const prefix = kel.slice(0, n);
    if ((await verifyPersonaKelFull(prefix)).ok) return prefix;
  }
  return [];
}

/**
 * STAND THE SIBLING CHANNEL on a vessel — the ONE composition both vessel shores call (isomorphism by
 * composition: only the seed custody differs, and it rides in as `sign` and `open`).
 *
 * It reads the face's persona-KEL off the vessel's own per-Nexus board, stands this leaf under it — the enrolment
 * it was handed, every re-enrolment the KEL's rotations carry, the lease epoch the vessel holds — and adds the
 * adapter over a dial to the pinned herm to the repo. A catch-up's suffix lands on the same board, and the board's
 * every change stands the leaf again, so a sibling whose edge the moved head rolled past leaves the repo with its
 * refusal said. A malformed herm address throws here, at boot: a vessel told to meet its siblings through a herm
 * it cannot pin has been told nothing it can do.
 *
 * A peer this channel yields is a device of THIS vessel's own PersonaGroup, proven over the session. It holds
 * STANDING and nothing more: the vessel's share policy hands it to the PersonaGroup ring, which admits it to its
 * face's own planes and the public boards — never the vessel's @daemon, never another face's planes.
 */
export async function standSiblingChannel(opts: {
  readonly repo: Repo;
  /** The herm's pinned relay address, `ws://host:port#<gate key hex>`. */
  readonly hermAddress: string;
  /** The island whose persona-KEL board this vessel reads. */
  readonly nexusPubkey: string;
  readonly personaKelPrefix: string;
  /** This vessel's device key and its signer. */
  readonly deviceKey: string;
  readonly sign: (bytes: Uint8Array) => Promise<string> | string;
  /** The enrolment the PersonaGroup's root handed this device: its edge and its sealed secret. */
  readonly enrolment: PersonaGroupEnrolment;
  /** Opens a secret sealed to this device — its own seed's custody, carried as a function. */
  readonly open: GroupSecretOpener;
  /** The lease epoch this vessel holds for the PersonaGroup; a sibling's edge bound below it reads as lapsed. */
  readonly expectedEpoch: number;
  readonly onRefusal?: (refusal: SiblingRefusal) => void;
}): Promise<SiblingNetworkAdapter> {
  pinnedRelayAddress(opts.hermAddress);
  const board = await materializeSharedLarDoc(opts.repo, personaKelBoardDocUrl(opts.nexusPubkey), "board:persona-kel");
  const chainNow = (): readonly PersonaKelEvent[] => personaKelChainForPrefix(board.doc(), opts.personaKelPrefix) ?? [];
  const deviceKey = opts.deviceKey.toLowerCase();
  const adapter = new SiblingNetworkAdapter({
    kel: chainNow(),
    leaf: async (kel) => {
      const standing = await leafStandingUnder({ kel, deviceKey, enrolment: opts.enrolment, open: opts.open });
      return { deviceKey, sign: opts.sign, edge: standing.edge, kel, secrets: standing.secrets, expectedEpoch: opts.expectedEpoch };
    },
    transport: () => dialSiblingHerm({ address: opts.hermAddress, deviceKey, sign: opts.sign }),
    onKelSuffix: (events) => { board.change((draft) => { for (const e of events) writePersonaKelEvent(draft, e); }); },
    ...(opts.onRefusal ? { onRefusal: opts.onRefusal } : {}),
  });
  board.on("change", () => { void adapter.relicense(chainNow()); });
  opts.repo.networkSubsystem.addNetworkAdapter(adapter);
  adapter.bindRepo(opts.repo);
  return adapter;
}
