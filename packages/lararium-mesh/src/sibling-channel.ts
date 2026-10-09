/**
 * sibling-channel — leaves of one PersonaGroup sync through a herm, with no listening vessel among them.
 *
 * THE THRESHOLD AND ITS TWO FACES. A herm's relay stands between the leaves, and each side of it keeps its own
 * face (`api/pono/system-pattern-integrities#/threshold-pattern-integrities`):
 *   · OUTWARD — the herm's face: CARRIAGE of sealed frames. A leaf dials EVERY herm it pins, each through the
 *     knock that herm's pinned gate key derives, proves its device key there (the one gate, the one wire), and
 *     joins the ONE channel its KEL head's secret keys at THAT herm (`siblingChannelTag`); a later join replaces
 *     it. The herm routes
 *     frames between the keys it proved on a shared channel and reads none of them: proof frames carry sealed
 *     boxes, session frames carry ciphertext. A non-member — one holding the group's id and no secret — computes
 *     no tag and finds no channel, and a leaf the head revoked holds an older secret only, so its channel holds no
 *     sibling that stands under the head.
 *   · INWARD — the siblings' face: the PROVEN SESSION. Two siblings run `leaf-peer-proof` end to end through the
 *     herm, and the proof binds a session (`LeafPeerSession`) that seals every later frame. Nothing the herm knows
 *     enters it: the herm's stamp of a sender key only has to AGREE with the proven edge, never stand in for it.
 * Nothing of the inward face rides the outward one: the herm holds no session key, no secret, no edge in the
 * clear — even when it acts, since a hello it forges draws no box — no PersonaGroup id, and no document byte.
 *
 * WHO STARTS AN EXCHANGE. A leaf that joins says `here` to its channel at a herm. A leaf that hears `here` from
 * a key it holds no standing session with over that herm re-proves: the lower device key initiates, the higher
 * answers `here` back to it, so each pair runs one exchange per herm. A hello whose hint names no secret this leaf
 * stands under draws no box and surfaces as a refusal.
 *
 * ONE PEER, MANY PATHS. Each herm carries its own exchange and its own session, so a herm that drops or hangs
 * closes only the sessions it carried. A sibling stands as ONE repo peer while any of its sessions stands, and a
 * message to it rides one standing session — the one over the lowest-indexed herm.
 *
 * CATCH-UP RIDES THE DROPS, NEVER A SIBLING (`persona-kel-drop`). Siblings meet only under one head, so no
 * sibling ever hands another a KEL. Every leaf pulls the successors of its head from its pinned herms before it
 * joins, on every dial and whenever a sibling closes a session because the head rolled, and re-deposits its own
 * head chain on every dial. A leaf whose KEL moves deposits the new chain BEFORE it closes a session, so the
 * sibling that hears the close finds the rotation waiting. Every pull and deposit asks every herm at once under a
 * deadline, so a herm that hangs costs a dial or a move its deadline and no more, and is said. The pull lands on the
 * leaf's own board; a stale leaf opens the enrolment the rotation sealed to it and joins the new channel, and a
 * leaf the rotation left out stands revoked, says so, leaves its channel and keeps pulling.
 *
 * ONE READER. The leaf reads its KEL through `foldPersonaContests` over every event it holds and every event it is
 * handed: an event that does not verify moves nothing, and a handed chain never rolls the leaf back.
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
 *     lapsed, a signature that does not hold, a hello under a secret this leaf does not stand under;
 *   · `relay` — the herm's carriage disturbed a session: a frame that fails the session's key or chain, a `here`
 *     or hello arriving for a standing session, a frame stamped with this leaf's own key, a proof frame for no
 *     exchange; or a herm's drop served a successor that does not verify, or a herm answered no drop request within
 *     its deadline (`session` null). It names the session the relay disturbed, never the sibling as its author,
 *     and the leaf tells that sibling to re-prove, so both halves close and none stands half-open;
 *   · `self` — this leaf's own standing, by cause: `revoked` (the KEL verifies and the leaf holds no enrolment its
 *     head op-key sealed), `unreadable` (the KEL as handed holds events that do not verify; they move nothing and
 *     revoke nothing), `unsealed` (the leaf holds no secret at all), `fork` (two events that verify compete for one
 *     seat; the leaf keeps the standing it last read and lets no order settle it). A leaf stands while it holds
 *     the secret its head op-key sealed, whatever newer provisional rotation it also holds, so a withheld veto never
 *     reads as a revocation. A revoked leaf says goodbye inside every session it held, so no sibling syncs on into
 *     a leaf that proves to no one;
 *   · `route` — the repo routes a sibling's derived peer id through another adapter, so the sibling gets no route;
 *   · `pins` — the herms this leaf pins cannot carry its channel (fewer than two, or one pinning no gate key), so
 *     the channel refuses to stand and says so on every dial; the vessel around it stands.
 * A lawful KEL move closes a session too, without blame: a sibling whose edge the head rolled past hears why inside
 * the session and the pair proves again under the head.
 *
 * NO CLOCK in any decision: freshness is a nonce, licensing is KEL event order and the held lease epoch, frame
 * order is a hash chain. The transport's re-dial delay and a drop request's deadline pace a socket and decide
 * nothing about the KEL.
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
  startLeafPeerProof, answerLeafPeerProof, finishLeafPeerProof, acceptLeafPeerProof, isLeafSessionFrame,
  type LeafPeerSelf, type LeafPeerState, type LeafPeerFrame, type LeafPeerSession, type LeafSessionFrame,
} from "./leaf-peer-proof.js";
import { foldPersonaContests, personaKelFoldSaid, type PersonaKelEvent, type PersonaKelFork } from "./persona-kel.js";
import { personaKelEventsFromBoard, writePersonaKelEvent } from "./persona-kel-board.js";
import { materializeSharedLarDoc, personaKelBoardDocUrl } from "./deterministic-doc.js";
import {
  enrolmentUnderHead, leafStandingUnder, type GroupSecretOpener, type LeafStanding, type PersonaGroupEnrolment,
} from "./persona-group-secret.js";
import {
  depositPersonaKelChain, httpPersonaKelDropHerm, pullPersonaKelSuccessors, type PersonaKelDropHerm, type PersonaKelPull,
} from "./persona-kel-drop.js";

const KEY_RE = /^[0-9a-f]{64}$/;

/** The session kind a leaf joins its channel under. Body: `{ channels }` — a later join REPLACES the set. */
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
  /** Join the channel each secret keys at this herm, leaving every channel joined before: the set REPLACES. An
   *  empty list leaves them all. */
  join(secrets: readonly Uint8Array[]): void;
  send(to: string | null, frame: SiblingWireFrame): void;
  onFrame(listener: (from: string, frame: unknown) => void): () => void;
  /** Fires once when the transport drops. */
  onClose(listener: () => void): () => void;
  close(): void;
}

/** Why a leaf stands with no standing of its own to prove under. */
export type SiblingSelfCause =
  /** The KEL verifies, and this device holds no enrolment its head op-key sealed. */
  | "revoked"
  /** The KEL as the board holds it does not verify — a torn, padded, stripped or unattested event. The leaf keeps
   *  the standing it last read off a KEL that verified, and revokes nothing on the board's word. */
  | "unreadable"
  /** The leaf holds no PersonaGroup secret sealed to it under any op-key the KEL seats: its seal is missing. */
  | "unsealed"
  /** Two events that each verify compete for one seat of the KEL — a quorum that signed twice, or two recoveries
   *  that raced. The leaf settles no fork by order: it keeps the standing it last read, or stands under the lineage
   *  before the fork. */
  | "fork";

/** A refusal the adapter surfaces, and whom it suspects. */
export type SiblingRefusal =
  /** The sibling's own proof failed, or it closed its session and said why. */
  | { readonly suspect: "peer";  readonly peerKey: string; readonly reason: string }
  /** The herm's carriage disturbed the session held with `session` (null when it named none). Never an accusation
   *  of that sibling. */
  | { readonly suspect: "relay"; readonly session: string | null; readonly reason: string }
  /** This leaf's own standing under the KEL it carries: revoked, unreadable, unsealed or forked (`cause`). */
  | { readonly suspect: "self";  readonly cause: SiblingSelfCause; readonly reason: string }
  /** The herms this leaf pins cannot carry its channel — fewer than two under distinct gate keys, or an address
   *  that pins no gate key — so the channel refuses to stand, and says so on every dial. */
  | { readonly suspect: "pins";  readonly reason: string }
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
    case "pins":  return "pins";
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
  /** The pinned herm (its index) the exchange runs over: every frame to this sibling rides it. */
  readonly via: number;
}

/** What the adapter reads a leaf off a KEL: its device key and signer, every enrolment it holds under that KEL, and
 *  the lease epoch it holds. The adapter stands it under the enrolment the KEL's head op-key sealed. */
export interface SiblingLeaf {
  readonly deviceKey: string;
  readonly sign: (bytes: Uint8Array) => Promise<string> | string;
  readonly kel: readonly PersonaKelEvent[];
  readonly standing: LeafStanding;
  readonly expectedEpoch?: number;
}

/** A leaf's pinned herms' successor drops, as the adapter reaches them. */
export interface SiblingKelDrops {
  /** Pull the successors of `kel` off every pinned herm at once: the KEL to stand under, every value refused, every
   *  herm that answered nothing within its deadline, and the fork the fold stopped at. */
  pull(kel: readonly PersonaKelEvent[]): Promise<PersonaKelPull>;
  /** Deposit `kel`'s chain at every pinned herm at once. A herm may refuse; nothing waits on one past its deadline,
   *  and every herm that answered nothing is named. */
  deposit(kel: readonly PersonaKelEvent[]): Promise<{ readonly unanswered: readonly string[] }>;
}

/**
 * The drops of a leaf's pinned herms. `land` hears the events a pull added beyond `kel`, a fork's events included —
 * the caller writes them to its own board, the same board every other KEL move lands on, so every reader of that
 * board meets the same fork.
 */
export function siblingKelDropsOf(herms: readonly PersonaKelDropHerm[], land?: (events: readonly PersonaKelEvent[]) => void): SiblingKelDrops {
  return {
    pull: async (kel) => {
      const pulled = await pullPersonaKelSuccessors(kel, herms);
      const held = new Set(kel.map((e) => e.eventCid));
      const fresh = [...pulled.kel, ...(pulled.fork?.events ?? [])].filter((e) => !held.has(e.eventCid));
      if (fresh.length > 0) { try { land?.(fresh); } catch { /* a board's write never blocks the pull */ } }
      return pulled;
    },
    deposit: (kel) => depositPersonaKelChain(kel, herms),
  };
}

export interface SiblingNetworkAdapterOptions {
  /** Stand the herm-facing transport to each pinned herm, one dialer per herm. Each is called on connect and again
   *  after its transport drops; the channel carries over every herm that stands. */
  readonly transports: readonly (() => Promise<SiblingTransport>)[];
  /** Why the channel refuses to stand at all: it dials nothing, and says so as `pins` on every dial. */
  readonly refusal?: string;
  /** This leaf under a KEL: its device key and signer, its enrolments, the lease epoch it holds. Read again
   *  whenever the KEL moves (`leafStandingUnder` composes it). */
  readonly leaf: (kel: readonly PersonaKelEvent[]) => Promise<SiblingLeaf>;
  /** The PersonaGroup's persona-KEL as this leaf carries it at the start. */
  readonly kel: readonly PersonaKelEvent[];
  /** The successor drops of this leaf's pinned herms. Absent, the leaf catches up only off what its caller hands
   *  `relicense`. */
  readonly drops?: SiblingKelDrops;
  /** Hears every refusal, as `onRefused` listeners do. */
  readonly onRefusal?: (refusal: SiblingRefusal) => void;
  /** Delay before re-dialing a dropped herm. Paces a socket; decides nothing. */
  readonly retryInterval?: number;
}

/** What a sibling channel stands as, read whole: a vessel's status shows it. */
export interface SiblingChannelStatus {
  /** Why the channel refuses to stand, or null when it stands. */
  readonly refusal: string | null;
  /** How many herms the channel pins, and over how many a transport stands. */
  readonly herms: number;
  readonly carried: number;
  /** This leaf's own standing cause when it stands under none, or a fork it met; null while it stands. */
  readonly self: SiblingSelfCause | null;
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

/** A slot's key: the herm it runs over and the sibling's device key. */
function slotOf(via: number, key: string): string { return `${via}|${key}`; }
function keyOfSlot(slotKey: string): string { return slotKey.slice(slotKey.indexOf("|") + 1); }

/**
 * The automerge-repo network adapter over a PersonaGroup's sibling channel. Sync messages ride only sessions a
 * leaf-peer proof admitted; see the module header for the threshold it keeps.
 */
export class SiblingNetworkAdapter extends NetworkAdapter {
  readonly #opts: SiblingNetworkAdapterOptions;
  #kel: readonly PersonaKelEvent[];
  /** The leaf as its KEL last read it: its key, signer and enrolments. */
  #leaf: SiblingLeaf | null = null;
  /** The leaf as it proves: the edge and secret its KEL head sealed to it. Null while it stands under none. */
  #self: LeafPeerSelf | null = null;
  /** True while the KEL this leaf carries leaves it no enrolment under the head: it proves to no one. */
  #revoked = false;
  /** Why this leaf stands under no standing of its own, or the fork it met; null while it stands. */
  #selfCause: SiblingSelfCause | null = null;
  /** The last set-aside events and fork this leaf surfaced, by their cids — one board state surfaces once. */
  #unreadableSeen: string | null = null;
  #forkSeen: string | null = null;
  /** Every drop refusal already said — one refused value surfaces once. */
  readonly #dropRefusalsSeen = new Set<string>();
  /** The live transport to each pinned herm, by the herm's index. */
  readonly #transports = new Map<number, SiblingTransport>();
  readonly #unsubs = new Map<number, Array<() => void>>();
  /** The herms a dial is standing a transport to right now. */
  readonly #standing = new Set<number>();
  /** Every sibling as this leaf holds it over one herm, keyed by the herm's index and the sibling's key
   *  (`slotOf`): each herm carries its own exchange and session, and a sibling stands as one peer while any of its
   *  sessions stands. */
  readonly #siblings = new Map<string, SiblingSlot>();
  readonly #keyOfPeer = new Map<PeerId, string>();
  /** Sessions this leaf closed itself, by slot, kept only to read the sibling's frames still in flight on them. */
  readonly #closing = new Map<string, LeafPeerSession>();
  #routes: SiblingRepoRoutes | null = null;
  /** The peer id this adapter is announcing, while the repo's own `peer` event for it fires. */
  #announcing: PeerId | null = null;
  #ready = false;
  #stopped = false;
  #readyResolvers: Array<() => void> = [];
  readonly #retries = new Map<number, ReturnType<typeof setTimeout>>();
  readonly #refusalListeners = new Set<(refusal: SiblingRefusal) => void>();
  /** Frames judge one at a time, in arrival order: a proof's verdict lands before the next frame reads it. */
  #inbound: Promise<void> = Promise.resolve();
  /** KEL moves judge one at a time, in arrival order: a standing read lands before the next one reads it. */
  #licensing: Promise<void> = Promise.resolve();

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

  /** The KEL this leaf carries, as its last pull or board move left it. */
  get kel(): readonly PersonaKelEvent[] { return this.#kel; }

  /** What the channel stands as, read whole. */
  status(): SiblingChannelStatus {
    return {
      refusal: this.#opts.refusal ?? null,
      herms: this.#opts.transports.length,
      carried: this.#transports.size,
      self: this.#selfCause,
    };
  }

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
    void this.#dial(this.#opts.transports.map((_, i) => i));
  }

  disconnect(): void {
    this.#stopped = true;
    for (const t of this.#retries.values()) clearTimeout(t);
    this.#retries.clear();
    for (const i of [...this.#transports.keys()]) {
      const t = this.#transports.get(i);
      this.#dropHerm(i);
      t?.close();
    }
    this.#closing.clear();
    this.emit("close");
  }

  /**
   * Carry one repo message to the sibling it targets. A sibling vouches only for this repo's own words: a message
   * another peer authored (a relayed ephemeral) never crosses, and this repo's own speak under the peer id the
   * sibling derives for this leaf's proven key.
   */
  send(message: Message): void {
    const key = this.#keyOfPeer.get(message.targetId);
    const self = this.#self;
    if (!key || !self || message.senderId !== this.peerId) return;
    // One standing session carries it — the one over the lowest-indexed herm that stands.
    for (const [slotKey, slot] of this.#slotsOf(key)) {
      if (!slot.session || slot.session.refusal !== null || !slot.peerId) continue;
      this.#sendSealed(slotKey, slot.session, { t: "msg", m: { ...message, senderId: siblingPeerIdOf(self.deviceKey) } as Message });
      return;
    }
  }

  /**
   * Stand this leaf again under a KEL it now carries. It deposits a KEL that moved at every pinned herm FIRST, so a
   * sibling that hears the close finds the move waiting — at most a herm's deadline, never longer. Then it judges
   * every standing session under the head: one whose sibling proved with an edge the head rolled past closes, the
   * sibling hears why inside it while both still share the old channel, and only then does this leaf join the head's
   * channel and say `here` — where the head re-enrolled that sibling it catches up and they prove again, and where it
   * revoked it the sibling says so itself. Moves judge one at a time, in arrival order.
   */
  relicense(kel: readonly PersonaKelEvent[]): Promise<void> {
    const next = this.#licensing.then(() => this.#relicense(kel));
    this.#licensing = next.catch(() => { /* a standing read that threw keeps the standing before it */ });
    return next;
  }

  async #relicense(offered: readonly PersonaKelEvent[]): Promise<void> {
    const kel = this.#readable(offered);
    if (!kel) return;
    const moved = this.#leaf !== null && chainKey(kel) !== chainKey(this.#kel);
    if (moved) await this.#deposit(kel);
    const leaf = await this.#opts.leaf(kel);
    const under = await enrolmentUnderHead(kel, leaf.standing);
    const before = this.#self?.secret.opKeyDid ?? null;
    const wasRevoked = this.#revoked;
    this.#kel = kel;
    this.#leaf = leaf;
    if (!under) {
      this.#self = null;
      if (!this.#revoked) {
        this.#revoked = true;
        const unsealed = leaf.standing.held.length === 0;
        this.#selfCause = unsealed ? "unsealed" : "revoked";
        this.#surface(unsealed
          ? { suspect: "self", cause: "unsealed", reason: "this leaf holds no PersonaGroup secret sealed to it under any op-key its KEL seats — its enrolment seal is missing" }
          : { suspect: "self", cause: "revoked", reason: "this leaf holds no enrolment its KEL head sealed — the rotation that seated the head left this device out" });
        // GOODBYE: every sibling hears it inside its session, so none syncs on into a leaf that proves to no one.
        for (const [slotKey, slot] of [...this.#siblings]) {
          if (slot.session) this.#close(slotKey, slot.session, "revoked");
          else this.#leave(slotKey);
        }
      }
      // A revoked leaf leaves every channel and keeps pulling: a later rotation may enrol it again.
      for (const t of this.#transports.values()) t.join([]);
      return;
    }
    const self: LeafPeerSelf = {
      deviceKey: leaf.deviceKey.toLowerCase(), sign: leaf.sign, edge: under.edge, kel,
      secret: { opKeyDid: under.opKeyDid, secret: under.secret },
      ...(leaf.expectedEpoch !== undefined ? { expectedEpoch: leaf.expectedEpoch } : {}),
    };
    this.#self = self;
    this.#revoked = false;
    if (this.#selfCause !== "fork") this.#selfCause = null;
    const rolled: Array<{ key: string; via: number }> = [];
    for (const [slotKey, slot] of [...this.#siblings]) {
      const session = slot.session;
      if (!session) continue;
      const verdict = await session.relicense(kel, self.expectedEpoch);
      if (verdict.ok || this.#siblings.get(slotKey)?.session !== session) continue;
      this.#close(slotKey, session, "rolled");
      rolled.push({ key: keyOfSlot(slotKey), via: slot.via });
    }
    if (wasRevoked || before === null || before.toLowerCase() !== under.opKeyDid.toLowerCase()) {
      // A new head's secret keys a new channel: join it alone at every herm and say `here` there.
      for (const t of this.#transports.values()) {
        t.join([under.secret]);
        t.send(null, { t: "here" });
      }
      return;
    }
    for (const { key, via } of rolled) if (self.deviceKey < key) this.#hello(key, via);
  }

  /**
   * The KEL this leaf may stand under, read through the one reader over every event it holds and every event it is
   * handed — so a handed chain never rolls the leaf back past what it already verified. An event that does not
   * verify moves nothing and revokes nothing: it surfaces as `unreadable` once per state. A fork surfaces as `fork`
   * once per state, and a leaf that already stands keeps its standing (null) rather than let order settle it.
   */
  #readable(offered: readonly PersonaKelEvent[]): readonly PersonaKelEvent[] | null {
    const fold = foldPersonaContests([...this.#kel, ...offered]);
    const said = personaKelFoldSaid(fold);
    const aside = fold.setAside.map((x) => x.event.eventCid).sort().join(",");
    if (said.unreadable && this.#unreadableSeen !== aside) {
      this.#unreadableSeen = aside;
      this.#surface({ suspect: "self", cause: "unreadable", reason: `the KEL this leaf was handed holds events that do not verify: ${said.unreadable} — they move nothing` });
    }
    if (fold.fork) {
      this.#sayFork(fold.fork);
      if (this.#leaf) return null;
    } else if (this.#selfCause === "fork") {
      this.#selfCause = null;
    }
    return fold.kel;
  }

  #sayFork(fork: PersonaKelFork): void {
    const key = fork.events.map((e) => e.eventCid).sort().join(",");
    this.#selfCause = "fork";
    if (this.#forkSeen === key) return;
    this.#forkSeen = key;
    const said = personaKelFoldSaid({ kel: [], setAside: [], fork }).fork!;
    this.#surface({ suspect: "self", cause: "fork", reason: `${said} — this leaf keeps the standing it last read` });
  }

  /** Every herm that answered nothing within its deadline surfaces as the relay path it is; the leaf goes on. */
  #sayUnanswered(gates: readonly string[], act: string): void {
    for (const gate of gates) {
      this.#surface({ suspect: "relay", session: null, reason: `the herm ${gate.slice(0, 8)}… answered no ${act} within its deadline — the leaf proceeds on what the other herms gave` });
    }
  }

  async #deposit(kel: readonly PersonaKelEvent[]): Promise<void> {
    const drops = this.#opts.drops;
    if (!drops) return;
    try { this.#sayUnanswered((await drops.deposit(kel)).unanswered, "deposit"); }
    catch { /* a herm may refuse: withholding */ }
  }

  /** Pull the successors of `kel`'s head off this leaf's pinned herms and say every value refused, every herm that
   *  answered nothing and any fork: the KEL the pull folds, or null when the leaf pins no drop or the pull failed. */
  async #pull(kel: readonly PersonaKelEvent[]): Promise<readonly PersonaKelEvent[] | null> {
    const drops = this.#opts.drops;
    if (!drops) return null;
    let pulled: PersonaKelPull;
    try { pulled = await drops.pull(kel); } catch { return null; }
    for (const reason of pulled.refused) {
      if (this.#dropRefusalsSeen.has(reason)) continue;
      this.#dropRefusalsSeen.add(reason);
      this.#surface({ suspect: "relay", session: null, reason: `a herm's drop refused: ${reason}` });
    }
    this.#sayUnanswered(pulled.unanswered, "drop pull");
    return pulled.fork ? [...pulled.kel, ...pulled.fork.events] : pulled.kel;
  }

  /** Pull the successors of this leaf's head, and stand under the KEL the pull folds when it moved. */
  async #catchUp(): Promise<void> {
    await this.#licensing;
    const kel = await this.#pull(this.#kel);
    if (kel && chainKey(kel) !== chainKey(this.#kel)) await this.relicense(kel);
  }

  /**
   * Dial the herms at `indices`. EVERY LEAF PULLS BEFORE IT JOINS, on every dial — a waking leaf before it first
   * reads its own standing — and re-deposits its own head chain; then it stands a transport to each herm at once.
   * A herm that hangs costs the dial its deadline and no more; one that cannot be reached redials alone.
   */
  async #dial(indices: readonly number[]): Promise<void> {
    if (this.#stopped) return;
    if (this.#opts.refusal !== undefined) {
      this.#surface({ suspect: "pins", reason: this.#opts.refusal });
      this.#markReady();
      return;
    }
    const due = indices.filter((i) => !this.#transports.has(i) && !this.#standing.has(i));
    if (due.length === 0) return;
    for (const i of due) this.#standing.add(i);
    try {
      if (!this.#leaf) {
        const base = this.#readable(this.#kel) ?? this.#kel;
        await this.relicense((await this.#pull(base)) ?? base);
      } else {
        await this.#catchUp();
      }
      await this.#deposit(this.#kel);
      await Promise.all(due.map((i) => this.#stand(i)));
    } finally {
      for (const i of due) this.#standing.delete(i);
    }
    this.#markReady();
  }

  async #stand(i: number): Promise<void> {
    let transport: SiblingTransport;
    try {
      transport = await this.#opts.transports[i]!();
    } catch {
      // A herm that cannot be reached still settles readiness: the repo's documents must not wait on a dial.
      this.#scheduleRedial(i);
      return;
    }
    if (this.#stopped) { transport.close(); return; }
    this.#transports.set(i, transport);
    this.#unsubs.set(i, [
      transport.onFrame((from, frame) => {
        this.#inbound = this.#inbound.then(() => this.#onFrame(i, from.toLowerCase(), frame)).catch(() => { /* judged */ });
      }),
      transport.onClose(() => {
        this.#dropHerm(i);
        this.#scheduleRedial(i);
      }),
    ]);
    if (this.#revoked || !this.#self) return;
    transport.join([this.#self.secret.secret]);
    transport.send(null, { t: "here" });
  }

  #markReady(): void {
    if (this.#ready) return;
    this.#ready = true;
    for (const r of this.#readyResolvers.splice(0)) r();
  }

  #scheduleRedial(i: number): void {
    if (this.#stopped || this.#retries.has(i)) return;
    this.#retries.set(i, setTimeout(() => { this.#retries.delete(i); void this.#dial([i]); }, this.#opts.retryInterval ?? 5000));
  }

  /** The herm at `i` dropped: its transport goes, and every sibling met over it leaves. */
  #dropHerm(i: number): void {
    for (const u of this.#unsubs.get(i) ?? []) u();
    this.#unsubs.delete(i);
    this.#transports.delete(i);
    for (const [slotKey, slot] of [...this.#siblings]) if (slot.via === i) this.#leave(slotKey);
    for (const slotKey of [...this.#closing.keys()]) if (slotKey.startsWith(`${i}|`)) this.#closing.delete(slotKey);
  }

  /** Every slot this leaf holds with the sibling `key`, over each herm, lowest herm first. */
  #slotsOf(key: string): Array<[string, SiblingSlot]> {
    return [...this.#siblings].filter(([slotKey]) => keyOfSlot(slotKey) === key).sort((a, b) => a[1].via - b[1].via);
  }

  /** Send one wire frame to `key` over the herm at `via`. */
  #sendVia(via: number, key: string | null, frame: SiblingWireFrame): void {
    this.#transports.get(via)?.send(key, frame);
  }

  /** One slot clears. The sibling's peer leaves this repo once no session of it names its peer id on any herm. */
  #leave(slotKey: string): void {
    const slot = this.#siblings.get(slotKey);
    this.#siblings.delete(slotKey);
    if (!slot?.peerId) return;
    if (this.#slotsOf(keyOfSlot(slotKey)).some(([, other]) => other.peerId === slot.peerId)) return;
    this.#keyOfPeer.delete(slot.peerId);
    this.emit("peer-disconnected", { peerId: slot.peerId });
  }

  /**
   * Close a session this leaf holds and tell the sibling why, inside the session, so its half closes too and it
   * syncs nothing on into a session that no longer stands. The session stays readable only for the sibling's
   * frames already in flight.
   */
  #close(slotKey: string, session: LeafPeerSession, why: CloseWhy): void {
    if (session.refusal === null) this.#sendSealed(slotKey, session, { t: "close", why });
    this.#closing.set(slotKey, session);
    this.#leave(slotKey);
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
  #refusePeer(key: string, via: number, reason: string, hadSession = false): void {
    this.#leave(slotOf(via, key));
    if (hadSession) this.#sendVia(via, key, { t: "here" });
    this.#surface({ suspect: "peer", peerKey: key, reason });
  }

  /**
   * The herm's carriage disturbed the session held with `key`. The session closes on this side, the sibling hears
   * `here` so its half closes as well (no half-open pair, no stale peer left proven), and the refusal names the
   * relay path — never the sibling as the frame's author.
   */
  #refuseRelay(key: string | null, via: number, reason: string, tellSibling: boolean): void {
    if (key !== null) {
      const hadSession = Boolean(this.#siblings.get(slotOf(via, key))?.session);
      this.#leave(slotOf(via, key));
      if (tellSibling && hadSession) this.#sendVia(via, key, { t: "here" });
    }
    this.#surface({ suspect: "relay", session: key, reason });
  }

  /** Another carrier holds the sibling's peer id: the sibling gets no route here, hears why and stays closed. */
  #refuseRoute(key: string, peerId: PeerId, reason: string): void {
    for (const [slotKey, slot] of this.#slotsOf(key)) {
      if (slot.session) this.#close(slotKey, slot.session, "route");
      else this.#leave(slotKey);
    }
    this.#surface({ suspect: "route", peerKey: key, peerId, reason });
  }

  /** The repo announced `peerId` through some adapter. When another adapter took a sibling's id, the route moved. */
  #observeRoute(peerId: PeerId): void {
    if (peerId === this.#announcing) return;
    const key = this.#keyOfPeer.get(peerId);
    if (key) this.#refuseRoute(key, peerId, "another adapter announced this sibling's peer id after it stood — the repo routes the id there, so the sibling leaves");
  }

  /** Seal `body` under the session a slot holds, and carry it over that slot's herm. */
  #sendSealed(slotKey: string, session: LeafPeerSession, body: SealedBody): void {
    const slot = this.#siblings.get(slotKey);
    if (!slot) return;
    this.#sendVia(slot.via, keyOfSlot(slotKey), { t: "seal", s: session.seal(cbor.encode(body)) });
  }

  /** Open an exchange with `key` as its initiator over the herm at `via`, under the secret this leaf's KEL head
   *  sealed to it. */
  #hello(key: string, via: number): void {
    const self = this.#self;
    if (!self || this.#revoked) return;
    const { frame: hello, state } = startLeafPeerProof(self);
    this.#siblings.set(slotOf(via, key), { proving: { role: "initiator", state }, via });
    this.#sendVia(via, key, { t: "proof", p: hello });
  }

  async #onFrame(via: number, from: string, raw: unknown): Promise<void> {
    const deviceKey = this.#leaf?.deviceKey.toLowerCase();
    if (!deviceKey || !this.#transports.has(via)) return;
    if (from === deviceKey) {
      this.#refuseRelay(null, via, "the herm carried a frame stamped with this leaf's own key back to it", false);
      return;
    }
    const frame = raw as Partial<{ t: string; p: LeafPeerFrame; s: unknown }> | null;
    if (!frame || typeof frame.t !== "string") return;
    // A frame sealed under a session this leaf closed itself is the sibling's, still in flight: it opens there, or
    // the herm carried it, and the refusal says so.
    const at = slotOf(via, from);
    if (frame.t === "seal" && !this.#siblings.get(at)?.session && this.#closing.has(at)) {
      const opened = isLeafSessionFrame(frame.s) ? this.#closing.get(at)!.open(frame.s) : null;
      if (!opened?.ok) { this.#closing.delete(at); this.#refuseRelay(from, via, "a sealed frame arrived under a session this leaf closed, and it never sealed there", false); }
      return;
    }
    const self = this.#self;
    if (this.#revoked || !self) return;
    const slot = this.#siblings.get(at);

    if (frame.t === "here") {
      // A sibling (re)joined this herm — or the herm says so. A session that stood with it over this herm closes,
      // and that surfaces: either the sibling dropped and came back, or the herm forged the word. The pair
      // re-proves: the lower key initiates, the higher says `here` back so the lower one does. An exchange already
      // in flight answers it.
      if (slot?.session) this.#refuseRelay(from, via, "a here arrived for a standing session — the sibling rejoined or the herm forged it; the pair proves again", false);
      else if (slot?.proving?.role === "initiator") return;
      if (self.deviceKey < from) this.#hello(from, via);
      else this.#sendVia(via, from, { t: "here" });
      return;
    }

    if (frame.t === "proof" && frame.p && typeof frame.p === "object") {
      const p = frame.p;
      if (p.step === "hello") {
        if (slot?.session) this.#refuseRelay(from, via, "a hello arrived for a standing session — the sibling rejoined or the herm forged it; the pair proves again", false);
        const answered = await answerLeafPeerProof(self, p);
        if (answered.kind === "malformed") { this.#refuseRelay(from, via, `a malformed hello: ${answered.reason}`, false); return; }
        if (answered.kind === "unmatched") {
          // No box: the hint names no secret this leaf stands under. The sender stands under another head, holds
          // no secret of this group, or the herm carried a hello from outside this channel.
          this.#refusePeer(from, via, "the hello names no PersonaGroup secret this leaf stands under — the sender stands under another KEL head, or holds none");
          return;
        }
        this.#siblings.set(at, { proving: { role: "responder", state: answered.state }, via });
        this.#sendVia(via, from, { t: "proof", p: answered.frame });
        return;
      }
      if (!slot?.proving) { this.#refuseRelay(from, via, `a ${String(p.step)} arrived for no exchange this leaf opened`, false); return; }
      if (p.step === "answer" && slot.proving.role === "initiator") {
        const { verdict, frame: finish } = await finishLeafPeerProof(self, slot.proving.state, p, from);
        if (!verdict.ok) { this.#refusePeer(from, via, verdict.reason); return; }
        if (finish) this.#sendVia(via, from, { t: "proof", p: finish });
        this.#open(from, verdict.session, via);
        return;
      }
      if (p.step === "finish" && slot.proving.role === "responder") {
        const verdict = await acceptLeafPeerProof(self, slot.proving.state, p, from);
        if (!verdict.ok) { this.#refusePeer(from, via, verdict.reason); return; }
        this.#open(from, verdict.session, via);
        return;
      }
      this.#refuseRelay(from, via, `a ${String(p.step)} arrived out of its exchange's order`, false);
      return;
    }

    if (frame.t === "seal") {
      const session = slot?.session;
      if (!session || !isLeafSessionFrame(frame.s)) { this.#refuseRelay(from, via, "a sealed frame arrived under a key that holds no proven session", false); return; }
      const opened = session.open(frame.s);
      if (!opened.ok) { this.#refuseRelay(from, via, `the herm carried a frame this session never sealed: ${opened.reason}`, true); return; }
      let body: SealedBody;
      try { body = cbor.decode(opened.plaintext) as SealedBody; } catch { this.#refusePeer(from, via, "a sealed frame opened torn", true); return; }
      if (body?.t === "close") {
        // The sibling closed its half and said why, inside the session the herm cannot speak in.
        this.#leave(at);
        this.#closing.set(at, session);
        // The head rolled: the sibling deposited the move before it closed, so this leaf pulls it now. Where the
        // move re-enrolled this leaf it joins the head's channel and says `here` there, and the pair proves again.
        if (body.why === "rolled") { void this.#catchUp(); return; }
        // A goodbye closes the sibling's every session, on every herm.
        for (const [slotKey] of this.#slotsOf(from)) this.#leave(slotKey);
        this.#surface({ suspect: "peer", peerKey: from, reason: body.why === "revoked"
          ? "the sibling closed its session: its own KEL revoked it"
          : "the sibling closed its session: its repo routes this leaf's peer id through another adapter" });
        return;
      }
      if (body?.t === "peer") {
        if (typeof body.peerId !== "string" || slot!.peerId) { this.#refusePeer(from, via, "a sibling named its peer id twice", true); return; }
        const peerId = siblingPeerIdOf(from);
        if (body.peerId !== peerId) { this.#refusePeer(from, via, "a sibling named a repo peer id its proven device key does not derive", true); return; }
        // A sibling already standing as a peer over another herm takes this session as a second path, and the
        // repo hears of it once.
        if (this.#keyOfPeer.get(peerId) === from) { slot!.peerId = peerId; this.#closing.delete(at); return; }
        if (this.#routes?.peers.includes(peerId)) {
          this.#refuseRoute(from, peerId, "the repo already holds this sibling's peer id through another adapter — one id names one carrier");
          return;
        }
        slot!.peerId = peerId;
        this.#keyOfPeer.set(peerId, from);
        this.#closing.delete(at);
        this.#announcing = peerId;
        try { this.emit("peer-candidate", { peerId, peerMetadata: body.peerMetadata ?? {} }); }
        finally { this.#announcing = null; }
        return;
      }
      if (body?.t === "msg" && body.m && typeof body.m === "object") {
        if (!slot!.peerId || body.m.senderId !== slot!.peerId) { this.#refusePeer(from, via, "a sibling spoke under a peer id it never named", true); return; }
        this.emit("message", { ...body.m, targetId: this.peerId } as Message);
        return;
      }
      this.#refusePeer(from, via, "a sealed frame carried nothing this channel speaks", true);
    }
  }

  /** A proof passed: the session stands over the herm at `via`, and the first thing it carries is the peer id this
   *  leaf's key derives. */
  #open(key: string, session: LeafPeerSession, via: number): void {
    const slotKey = slotOf(via, key);
    this.#siblings.set(slotKey, { session, via });
    const self = this.#self;
    if (!self) return;
    this.#sendSealed(slotKey, session, { t: "peer", peerId: siblingPeerIdOf(self.deviceKey), ...(this.peerMetadata ? { peerMetadata: this.peerMetadata } : {}) });
  }
}

/** A chain's identity, by its event cids in order — two reads of one KEL compare equal. */
function chainKey(kel: readonly PersonaKelEvent[]): string {
  return kel.map((e) => e.eventCid).join(",");
}

/**
 * STAND THE SIBLING CHANNEL on a vessel — the ONE composition both vessel shores call (isomorphism by
 * composition: only the seed custody differs, and it rides in as `sign` and `open`).
 *
 * It reads the face's persona-KEL off the vessel's own per-Nexus board through the one reader, stands this leaf
 * under it — the enrolment it was handed, every re-enrolment the KEL's rotations carry, the lease epoch the vessel
 * holds — and adds the adapter over a dial to EVERY pinned herm to the repo: siblings meet over whichever herms
 * stand, and every herm carries the leaf's successor drops. A pull lands on the same board, and the board's every
 * change stands the leaf again, so a sibling whose edge the moved head rolled past leaves the repo with its refusal
 * said.
 *
 * A vessel pins at least two herms under distinct gate keys, so one herm that withholds, floods or hangs is
 * tolerated through another. Fewer than two, or an address that pins no gate key, and the CHANNEL refuses to stand:
 * the adapter dials nothing, says why as `pins` on every dial and in `status()`, and the rest of the vessel boots.
 *
 * A peer this channel yields is a device of THIS vessel's own PersonaGroup, proven over the session. It holds
 * STANDING and nothing more: the vessel's share policy hands it to the PersonaGroup ring, which admits it to its
 * face's own planes and the public boards — never the vessel's @daemon, never another face's planes.
 */
export async function standSiblingChannel(opts: {
  readonly repo: Repo;
  /** The herms' pinned relay addresses, `ws://host:port#<gate key hex>`, at least two under distinct gate keys.
   *  The channel dials every one, and every one carries the drops. */
  readonly herms: readonly string[];
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
  /** How long a drop request waits on one herm before the leaf reads it as unanswered. */
  readonly dropDeadlineMs?: number;
  /** Delay before re-dialing a dropped herm. Paces a socket; decides nothing. */
  readonly retryInterval?: number;
  readonly onRefusal?: (refusal: SiblingRefusal) => void;
}): Promise<SiblingNetworkAdapter> {
  const deviceKey = opts.deviceKey.toLowerCase();
  const board = await materializeSharedLarDoc(opts.repo, personaKelBoardDocUrl(opts.nexusPubkey), "board:persona-kel");
  /** Every event the board holds for this face: the adapter folds them through the one reader. */
  const eventsNow = (): readonly PersonaKelEvent[] =>
    personaKelEventsFromBoard(board.doc()).filter((e) => e.prefix === opts.personaKelPrefix).sort((a, b) => a.seq - b.seq);
  let drops: PersonaKelDropHerm[] = [];
  let refusal: string | undefined;
  try {
    drops = opts.herms.map((address) => httpPersonaKelDropHerm(address, opts.dropDeadlineMs !== undefined ? { deadlineMs: opts.dropDeadlineMs } : {}));
    if (new Set(drops.map((d) => d.gatePubKey)).size < 2) {
      refusal = `the channel pins ${new Set(drops.map((d) => d.gatePubKey)).size} herm(s) under distinct gate keys and stands over at least two, so one herm that withholds, floods or hangs is tolerated through another`;
    }
  } catch (err) {
    refusal = `a pinned herm address reads no gate key, so the channel pins nothing it can dial: ${(err as Error).message}`;
  }
  const adapter = new SiblingNetworkAdapter({
    kel: eventsNow(),
    leaf: async (kel) => ({
      deviceKey, sign: opts.sign, kel, expectedEpoch: opts.expectedEpoch,
      standing: await leafStandingUnder({ kel, deviceKey, enrolment: opts.enrolment, open: opts.open }),
    }),
    transports: refusal === undefined ? opts.herms.map((address) => () => dialSiblingHerm({ address, deviceKey, sign: opts.sign })) : [],
    ...(refusal === undefined
      ? { drops: siblingKelDropsOf(drops, (events) => { board.change((draft) => { for (const e of events) writePersonaKelEvent(draft, e); }); }) }
      : { refusal }),
    ...(opts.retryInterval !== undefined ? { retryInterval: opts.retryInterval } : {}),
    ...(opts.onRefusal ? { onRefusal: opts.onRefusal } : {}),
  });
  if (refusal === undefined) board.on("change", () => { void adapter.relicense(eventsNow()); });
  opts.repo.networkSubsystem.addNetworkAdapter(adapter);
  adapter.bindRepo(opts.repo);
  return adapter;
}
