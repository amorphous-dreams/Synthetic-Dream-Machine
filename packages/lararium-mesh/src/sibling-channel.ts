/**
 * sibling-channel — leaves of one PersonaGroup sync through a herm, with no listening vessel among them.
 *
 * THE THRESHOLD AND ITS TWO FACES. A herm's relay stands between the leaves, and each side of it keeps its own
 * face (`api/pono/system-pattern-integrities#/threshold-pattern-integrities`):
 *   · OUTWARD — the herm's face: CARRIAGE of sealed frames. A leaf dials the herm's relay through the knock its
 *     pinned gate key derives, proves its device key there (the one gate, the one wire), and joins a channel
 *     named by an opaque tag (`siblingChannelTag`). The herm routes frames between the keys it proved on that
 *     channel and reads none of them: proof frames carry sealed boxes, session frames carry ciphertext.
 *   · INWARD — the siblings' face: the PROVEN SESSION. Two siblings run `leaf-peer-proof` end to end through the
 *     herm, and the proof binds a session (`LeafPeerSession`) that seals every later frame. Nothing the herm knows
 *     enters it: the herm's stamp of a sender key only has to AGREE with the proven edge, never stand in for it.
 * Nothing of the inward face rides the outward one: the herm holds no session key, no edge in the clear, no
 * PersonaGroup id, and no document byte.
 *
 * WHO STARTS AN EXCHANGE. A leaf that joins says `here` to the channel. A leaf that hears `here` from a key it
 * holds no standing session with re-proves: the lower device key initiates, the higher answers `here` back to
 * it, so each pair runs exactly one exchange.
 *
 * AUTOMERGE RIDES ONLY THE SESSION. `SiblingNetworkAdapter` takes the automerge-repo `NetworkAdapter` shape. A
 * sibling becomes a peer (`peer-candidate`) only once its proof passed AND it named its repo peer id inside the
 * sealed session; every sync message is CBOR sealed under that session. `provenKeyOf(peerId)` names the device
 * key a peer proved — the proof source a PersonaGroup ring reads.
 *
 * DIVERGENCE SURFACES. An impostor's proof, an edge the KEL head rolled past, a frame the herm injected, replayed
 * or reordered, a sealed frame from a key that proved nothing, a sibling naming another peer's id: each one reaches
 * `onRefusal` (and every `onRefused` listener) with its reason. None drops in silence.
 *
 * NO CLOCK in any decision: freshness is a nonce, licensing is KEL event order, frame order is a hash chain. The
 * transport's re-dial delay paces a socket and decides nothing.
 *
 * Platform-blind: the dial uses the global `WebSocket` (every browser, Node 22+).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/identity-slot-policy#/the-leaf-taxonomy
 */

import { NetworkAdapter, cbor, type Message, type PeerId, type PeerMetadata, type Repo } from "@automerge/automerge-repo";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, utf8Bytes } from "./crypto.js";
import { MEMBERSHIP_RELAY_DOMAIN, SIBLING_CHANNEL_INFO } from "./domains.js";
import { runPeerHandshake, isLarSessionMsg, mkLarSessionMsg } from "./auth-wire.js";
import { knockedUrl, pinnedRelayAddress } from "./gate-knock.js";
import {
  startLeafPeerProof, answerLeafPeerProof, finishLeafPeerProof, acceptLeafPeerProof, isLeafSessionFrame,
  type LeafPeerSelf, type LeafPeerState, type LeafPeerFrame, type LeafPeerSession, type LeafSessionFrame,
} from "./leaf-peer-proof.js";
import type { PersonaKelEvent } from "./persona-kel.js";
import { personaKelChainForPrefix } from "./persona-kel-board.js";
import { materializeSharedLarDoc, personaKelBoardDocUrl } from "./deterministic-doc.js";

const KEY_RE = /^[0-9a-f]{64}$/;

/** The session kind a leaf joins a channel under. Body: `{ channel }`. */
export const SIBLING_JOIN_KIND = "sibling/join";
/** The session kind a sibling frame rides. Leaf → herm: `{ to, frame }` (`to` null for the whole channel).
 *  Herm → leaf: `{ from, frame }`, `from` STAMPED with the key the herm proved for the sender. */
export const SIBLING_FRAME_KIND = "sibling/frame";

/**
 * The channel a PersonaGroup's leaves meet on: HMAC-SHA256 of the group's id under `SIBLING_CHANNEL_INFO`. Every
 * sibling derives it alone; the herm routes on it and reads no group id out of it.
 */
export function siblingChannelTag(personaGroupDocIdHex: string): string {
  return hex(hmac(sha256, utf8Bytes(SIBLING_CHANNEL_INFO), utf8Bytes(personaGroupDocIdHex.toLowerCase())));
}

/** What a sibling frame carries, inside the herm's `{ frame }`. Only `here` and the proof's outer fields read
 *  in the clear; everything a sibling says after the proof rides `seal`. */
export type SiblingWireFrame =
  | { readonly t: "here" }
  | { readonly t: "proof"; readonly p: LeafPeerFrame }
  | { readonly t: "seal";  readonly s: LeafSessionFrame };

/** The herm-facing half: frames out to a proven key (or the whole channel), frames in stamped with the sender's
 *  proven key. The herm's relay stands behind it; a test may stand any relay it likes. */
export interface SiblingTransport {
  send(to: string | null, frame: SiblingWireFrame): void;
  onFrame(listener: (from: string, frame: unknown) => void): () => void;
  /** Fires once when the transport drops. */
  onClose(listener: () => void): () => void;
  close(): void;
}

/** A refusal the adapter surfaces: whose key, and why. */
export interface SiblingRefusal {
  readonly peerKey: string;
  readonly reason:  string;
}

/**
 * Dial a herm's relay as a leaf: open the knock the pinned gate key derives, prove this leaf's device key through
 * the one handshake (`runPeerHandshake` against the relay's audience, the verdict read only under the pin), and
 * join `channel`. Resolves the transport, or rejects with the reason the handshake gave — a herm that meets a
 * leaf with silence rejects "no answer".
 *
 * @param address the herm's pinned relay address, `ws://host:port#<gate key hex>`.
 */
export function dialSiblingHerm(opts: {
  readonly address: string;
  readonly deviceKey: string;
  readonly sign: (bytes: Uint8Array) => Promise<string> | string;
  readonly channel: string;
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
        ws.send(JSON.stringify(mkLarSessionMsg(SIBLING_JOIN_KIND, { channel: opts.channel })));
        resolve({
          send: (to, frame) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            try { ws.send(JSON.stringify(mkLarSessionMsg(SIBLING_FRAME_KIND, { to, frame }))); } catch { /* closed */ }
          },
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
  /** The repo peer id it named inside the session. */
  peerId?: PeerId;
}

export interface SiblingNetworkAdapterOptions {
  /** Stand the herm-facing transport. Called on connect and again after a drop. */
  readonly transport: () => Promise<SiblingTransport>;
  /** This leaf: its device key and signer, its own edge, and its PersonaGroup's KEL as it carries it. */
  readonly self: LeafPeerSelf;
  /** Hears every refusal, as `onRefused` listeners do. */
  readonly onRefusal?: (refusal: SiblingRefusal) => void;
  /** Delay before re-dialing a dropped herm. Paces a socket; decides nothing. */
  readonly retryInterval?: number;
}

type SealedBody =
  | { readonly t: "peer"; readonly peerId: string; readonly peerMetadata?: PeerMetadata }
  | { readonly t: "msg";  readonly m: Message };

/**
 * The automerge-repo network adapter over a PersonaGroup's sibling channel. Sync messages ride only sessions a
 * leaf-peer proof admitted; see the module header for the threshold it keeps.
 */
export class SiblingNetworkAdapter extends NetworkAdapter {
  #self: LeafPeerSelf;
  readonly #opts: SiblingNetworkAdapterOptions;
  #transport: SiblingTransport | null = null;
  #unsubs: Array<() => void> = [];
  readonly #siblings = new Map<string, SiblingSlot>();
  readonly #keyOfPeer = new Map<PeerId, string>();
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
    this.#self = opts.self;
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

  send(message: Message): void {
    const key = this.#keyOfPeer.get(message.targetId);
    const session = key ? this.#siblings.get(key)?.session : undefined;
    if (!key || !session || session.refusal !== null) return;
    this.#sendSealed(key, session, { t: "msg", m: message });
  }

  /**
   * Re-judge every standing session against a KEL this leaf now carries. A sibling whose edge the moved head
   * rolled past leaves, and its refusal surfaces; the KEL also licenses every exchange from here on.
   */
  async relicense(kel: readonly PersonaKelEvent[]): Promise<void> {
    this.#self = { ...this.#self, kel };
    for (const [key, slot] of this.#siblings) {
      const session = slot.session;
      if (!session) continue;
      if (!(await session.relicense(kel, this.#self.expectedEpoch))) this.#refuse(key, session.refusal ?? "the edge no longer licenses");
    }
  }

  async #dial(): Promise<void> {
    if (this.#stopped || this.#transport) return;
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

  #refuse(key: string, reason: string): void {
    this.#leave(key);
    const refusal: SiblingRefusal = { peerKey: key, reason };
    for (const l of [this.#opts.onRefusal, ...this.#refusalListeners]) {
      try { l?.(refusal); } catch { /* a listener's throw never hides the refusal from another */ }
    }
  }

  #sendSealed(key: string, session: LeafPeerSession, body: SealedBody): void {
    const frame = session.seal(cbor.encode(body));
    this.#transport?.send(key, { t: "seal", s: frame });
  }

  async #onFrame(from: string, raw: unknown): Promise<void> {
    if (from === this.#self.deviceKey.toLowerCase()) return;
    const frame = raw as Partial<{ t: string; p: LeafPeerFrame; s: unknown }> | null;
    if (!frame || typeof frame.t !== "string") return;
    const transport = this.#transport;
    if (!transport) return;

    if (frame.t === "here") {
      // A sibling (re)joined: whatever stood with it is gone on its side, so it goes here too, and the pair
      // re-proves — the lower key initiates, the higher says `here` back so the lower one does.
      if (this.#siblings.has(from)) this.#leave(from);
      if (this.#self.deviceKey.toLowerCase() < from) {
        const { frame: hello, state } = startLeafPeerProof();
        this.#siblings.set(from, { proving: { role: "initiator", state } });
        transport.send(from, { t: "proof", p: hello });
      } else {
        transport.send(from, { t: "here" });
      }
      return;
    }

    if (frame.t === "proof" && frame.p && typeof frame.p === "object") {
      const p = frame.p;
      if (p.step === "hello") {
        const answered = await answerLeafPeerProof(this.#self, p);
        if ("error" in answered) { this.#refuse(from, answered.error); return; }
        if (this.#siblings.get(from)?.session) this.#leave(from);
        this.#siblings.set(from, { proving: { role: "responder", state: answered.state } });
        transport.send(from, { t: "proof", p: answered.frame });
        return;
      }
      const slot = this.#siblings.get(from);
      if (!slot?.proving) { this.#refuse(from, `a ${String(p.step)} arrived for no exchange this leaf opened`); return; }
      if (p.step === "answer" && slot.proving.role === "initiator") {
        const { verdict, frame: finish } = await finishLeafPeerProof(this.#self, slot.proving.state, p, from);
        if (!verdict.ok) { this.#refuse(from, verdict.reason); return; }
        if (finish) transport.send(from, { t: "proof", p: finish });
        this.#open(from, verdict.session);
        return;
      }
      if (p.step === "finish" && slot.proving.role === "responder") {
        const verdict = await acceptLeafPeerProof(this.#self, slot.proving.state, p, from);
        if (!verdict.ok) { this.#refuse(from, verdict.reason); return; }
        this.#open(from, verdict.session);
        return;
      }
      this.#refuse(from, `a ${String(p.step)} arrived out of its exchange's order`);
      return;
    }

    if (frame.t === "seal") {
      const slot = this.#siblings.get(from);
      const session = slot?.session;
      if (!session || !isLeafSessionFrame(frame.s)) { this.#refuse(from, "a sealed frame arrived from a key that holds no proven session"); return; }
      const opened = session.open(frame.s);
      if (!opened.ok) { this.#refuse(from, opened.reason); return; }
      let body: SealedBody;
      try { body = cbor.decode(opened.plaintext) as SealedBody; } catch { this.#refuse(from, "a sealed frame opened torn"); return; }
      if (body?.t === "peer") {
        if (typeof body.peerId !== "string" || slot!.peerId) { this.#refuse(from, "a sibling named its peer id twice"); return; }
        const peerId = body.peerId as PeerId;
        const holder = this.#keyOfPeer.get(peerId);
        if (holder && holder !== from) { this.#refuse(from, "a sibling named a peer id another proven key holds"); return; }
        slot!.peerId = peerId;
        this.#keyOfPeer.set(peerId, from);
        this.emit("peer-candidate", { peerId, peerMetadata: body.peerMetadata ?? {} });
        return;
      }
      if (body?.t === "msg" && body.m && typeof body.m === "object") {
        if (!slot!.peerId || body.m.senderId !== slot!.peerId) { this.#refuse(from, "a sibling spoke under a peer id it never named"); return; }
        this.emit("message", body.m);
        return;
      }
      this.#refuse(from, "a sealed frame carried nothing this channel speaks");
    }
  }

  /** A proof passed: the session stands, and the first thing it carries is this repo's own peer id. */
  #open(key: string, session: LeafPeerSession): void {
    const slot: SiblingSlot = { session };
    this.#siblings.set(key, slot);
    if (!this.peerId) return;
    this.#sendSealed(key, session, { t: "peer", peerId: this.peerId, ...(this.peerMetadata ? { peerMetadata: this.peerMetadata } : {}) });
  }
}

/**
 * STAND THE SIBLING CHANNEL on a vessel — the ONE composition both vessel shores call (isomorphism by
 * composition: only the seed custody differs, and it rides in as `sign`).
 *
 * It reads the face's persona-KEL off the vessel's own per-Nexus board, stands the adapter over a dial to the
 * pinned herm, and adds it to the repo. The board's every change re-licenses the standing sessions, so a sibling
 * whose edge the moved head rolled past leaves the repo with its refusal said. A malformed herm address throws
 * here, at boot: a vessel told to meet its siblings through a herm it cannot pin has been told nothing it can do.
 *
 * A peer this channel yields is a device of THIS vessel's own PersonaGroup, proven over the session — the
 * fleet, which syncs whole the way a same-operator peer does; it never joins a vessel's relay ring.
 */
export async function standSiblingChannel(opts: {
  readonly repo: Repo;
  /** The herm's pinned relay address, `ws://host:port#<gate key hex>`. */
  readonly hermAddress: string;
  /** The island whose persona-KEL board this vessel reads. */
  readonly nexusPubkey: string;
  readonly personaKelPrefix: string;
  readonly personaGroupDocIdHex: string;
  /** This vessel's device key, its signer, and the edge its PersonaGroup's root signed for it. */
  readonly deviceKey: string;
  readonly sign: (bytes: Uint8Array) => Promise<string> | string;
  readonly edge: LeafPeerSelf["edge"];
  readonly onRefusal?: (refusal: SiblingRefusal) => void;
}): Promise<SiblingNetworkAdapter> {
  pinnedRelayAddress(opts.hermAddress);
  const board = await materializeSharedLarDoc(opts.repo, personaKelBoardDocUrl(opts.nexusPubkey), "board:persona-kel");
  const chainNow = (): readonly PersonaKelEvent[] => personaKelChainForPrefix(board.doc(), opts.personaKelPrefix) ?? [];
  const channel = siblingChannelTag(opts.personaGroupDocIdHex);
  const adapter = new SiblingNetworkAdapter({
    self: { deviceKey: opts.deviceKey.toLowerCase(), sign: opts.sign, edge: opts.edge, kel: chainNow() },
    transport: () => dialSiblingHerm({ address: opts.hermAddress, deviceKey: opts.deviceKey, sign: opts.sign, channel }),
    ...(opts.onRefusal ? { onRefusal: opts.onRefusal } : {}),
  });
  board.on("change", () => { void adapter.relicense(chainNow()); });
  opts.repo.networkSubsystem.addNetworkAdapter(adapter);
  return adapter;
}
