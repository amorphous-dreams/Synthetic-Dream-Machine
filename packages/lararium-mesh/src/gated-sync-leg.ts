/**
 * gated-sync-leg — one sync leg of a Repo, read through a gate.
 *
 * A Repo's share policy answers per peer ID, and a peer names its own ID. A leg binds the decision to the
 * CARRIER instead: every message that crosses one adapter, in either direction, passes one gate, whatever ID
 * the far end claims. The leg wraps any network adapter (a MessagePort toward an island, a socket toward a
 * hearth), so one mechanism serves a session's scoped document view and a canon document that crosses one way.
 *
 * The invariants:
 *   · THE GATE DECIDES EVERY MESSAGE. Nothing crosses the leg unjudged, in either direction, and a message
 *     the leg cannot read as a message refuses before any gate sees it.
 *   · A PEER STANDS ONLY WHEN ADMITTED. The gate admits each peer ID; a message from, or toward, any other ID
 *     refuses. A far end that announces an ID the gate refuses takes the whole leg down.
 *   · A WRITE READS FROM THE BYTES. `carriesChanges` decodes a sync message and counts the changes it holds;
 *     bytes that fail to decode read as a write, so a torn message never slips past a read-only bound.
 *   · A REFUSED FETCH ANSWERS `doc-unavailable`. The far end's `find` then settles as it does for a document
 *     nobody holds, and learns nothing about whether one stands.
 *   · A MESSAGE PAST THE BYTE BOUND REFUSES UNREAD. The leg measures an inbound message before any gate
 *     decodes it, so the far end cannot buy the owner's time with one oversized payload.
 *   · THE FAR END'S STORAGE CLAIM STOPS AT THE LEG where the gate says so. A leg toward an ephemeral replica
 *     announces its peer as ephemeral, with no storage ID.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/session-contract#/the-document-view
 */
import { NetworkAdapter } from "@automerge/automerge-repo";
import type { Message, NetworkAdapterInterface, PeerId, PeerMetadata } from "@automerge/automerge-repo";
import { decodeSyncMessage } from "@automerge/automerge";

/** A message as a gate reads it. */
export interface LegMessage {
  readonly type:        string;
  readonly senderId:    string;
  readonly targetId:    string;
  readonly documentId?: string;
  readonly data?:       Uint8Array;
}

export type LegVerdict =
  | { readonly pass: true }
  | { readonly pass: false; readonly reason: string; readonly answerUnavailable?: boolean };

export const LEG_PASS: LegVerdict = Object.freeze({ pass: true });

/** The decisions one leg asks. Each stays synchronous: a leg never queues a message behind a promise. */
export interface SyncLegGate {
  /** May this peer ID stand on the leg? */
  admitPeer(peerId: string): boolean;
  /** A message the far end sent toward this Repo. */
  inbound(message: LegMessage): LegVerdict;
  /** A message this Repo sends toward the far end. */
  outbound(message: LegMessage): LegVerdict;
  /** True when the far end holds an ephemeral replica: its peer then announces with no storage ID. */
  readonly farEndEphemeral?: boolean;
}

/** One refused crossing, as a sink reads it. `withheld` marks a message this Repo offered and the gate kept
 *  back: the owner's own restraint, never the far end's fault. */
export interface LegRefusal {
  readonly direction:   "inbound" | "outbound" | "peer";
  readonly reason:      string;
  readonly type:        string;
  readonly peerId:      string;
  readonly documentId?: string;
}
export type LegRefusalSink = (refusal: LegRefusal) => void;

/** Does this sync or request message carry changes? Bytes that fail to decode read as a write. */
export function carriesChanges(message: LegMessage): boolean {
  if (message.type !== "sync" && message.type !== "request") return false;
  if (!(message.data instanceof Uint8Array)) return true;
  try { return decodeSyncMessage(message.data).changes.length > 0; } catch { return true; }
}

function readLegMessage(raw: unknown): LegMessage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { type, senderId, targetId, documentId, data } = raw as Record<string, unknown>;
  if (typeof type !== "string" || typeof senderId !== "string" || typeof targetId !== "string") return null;
  if (documentId !== undefined && typeof documentId !== "string") return null;
  if (data !== undefined && !(data instanceof Uint8Array)) return null;
  return {
    type, senderId, targetId,
    ...(documentId !== undefined ? { documentId } : {}),
    ...(data !== undefined ? { data } : {}),
  };
}

/**
 * A network adapter that passes its inner adapter's traffic through a gate. Hand it to a Repo in the inner
 * adapter's place; the Repo never sees the inner one.
 */
/** The most bytes one inbound message may carry before the leg refuses it unread. */
export const LEG_MAX_INBOUND_BYTES = 64 * 1024 * 1024;

export class GatedSyncLeg extends NetworkAdapter {
  readonly #inner:     NetworkAdapterInterface;
  readonly #gate:      SyncLegGate;
  readonly #onRefusal: LegRefusalSink | null;
  readonly #maxInboundBytes: number;
  readonly #admitted = new Set<string>();
  #down = false;

  constructor(inner: NetworkAdapterInterface, gate: SyncLegGate, onRefusal?: LegRefusalSink, opts: { maxInboundBytes?: number } = {}) {
    super();
    this.#inner = inner;
    this.#gate = gate;
    this.#onRefusal = onRefusal ?? null;
    this.#maxInboundBytes = opts.maxInboundBytes ?? LEG_MAX_INBOUND_BYTES;

    inner.on("peer-candidate", ({ peerId, peerMetadata }) => {
      if (this.#down) return;
      if (!gate.admitPeer(peerId)) {
        this.#refuse({ direction: "peer", reason: "peer-not-admitted", type: "arrive", peerId });
        this.disconnect();                                  // an unadmitted announcement ends the leg
        return;
      }
      this.#admitted.add(peerId);
      const metadata: PeerMetadata = gate.farEndEphemeral ? { isEphemeral: true } : peerMetadata;
      this.emit("peer-candidate", { peerId, peerMetadata: metadata });
    });
    inner.on("peer-disconnected", (payload) => {
      if (!this.#admitted.delete(payload.peerId)) return;
      this.emit("peer-disconnected", payload);
    });
    inner.on("close", () => { this.emit("close"); });
    inner.on("message", (raw) => { this.#receive(raw); });
  }

  /** True once the leg stands down. A leg that stood down carries nothing in either direction. */
  get down(): boolean { return this.#down; }

  isReady(): boolean { return this.#inner.isReady(); }
  whenReady(): Promise<void> { return this.#inner.whenReady(); }

  connect(peerId: PeerId, peerMetadata?: PeerMetadata): void {
    this.peerId = peerId;
    if (peerMetadata !== undefined) this.peerMetadata = peerMetadata;
    this.#inner.connect(peerId, peerMetadata);
  }

  send(message: Message): void {
    if (this.#down) return;
    const read = readLegMessage(message);
    if (!read) return;
    const refusal = this.#judge(read, read.targetId, "outbound");
    if (refusal) { this.#refuse(refusal); return; }
    this.#inner.send(message);
  }

  disconnect(): void {
    if (this.#down) return;
    this.#down = true;
    for (const peerId of this.#admitted) this.emit("peer-disconnected", { peerId: peerId as PeerId });
    this.#admitted.clear();
    this.#inner.disconnect();
  }

  #receive(raw: Message): void {
    if (this.#down) return;
    const read = readLegMessage(raw);
    if (!read) {
      this.#refuse({ direction: "inbound", reason: "malformed-message", type: "?", peerId: "?" });
      return;
    }
    if (read.data !== undefined && read.data.byteLength > this.#maxInboundBytes) {
      this.#refuse({
        direction: "inbound", reason: "message-too-large", type: read.type, peerId: read.senderId,
        ...(read.documentId !== undefined ? { documentId: read.documentId } : {}),
      });
      return;
    }
    const refusal = this.#judge(read, read.senderId, "inbound");
    if (!refusal) { this.emit("message", raw); return; }
    this.#refuse(refusal);
    if (refusal.answer && read.documentId !== undefined && this.peerId !== undefined) {
      this.#inner.send({
        type: "doc-unavailable", senderId: this.peerId, targetId: read.senderId as PeerId, documentId: read.documentId,
      } as Message);
    }
  }

  #judge(read: LegMessage, farPeer: string, direction: "inbound" | "outbound"): (LegRefusal & { answer?: boolean }) | null {
    const named = {
      direction, type: read.type, peerId: farPeer,
      ...(read.documentId !== undefined ? { documentId: read.documentId } : {}),
    };
    if (!this.#admitted.has(farPeer)) return { ...named, reason: "peer-not-admitted" };
    const verdict = direction === "inbound" ? this.#gate.inbound(read) : this.#gate.outbound(read);
    if (verdict.pass) return null;
    return { ...named, reason: verdict.reason, ...(verdict.answerUnavailable ? { answer: true } : {}) };
  }

  #refuse(refusal: LegRefusal): void {
    if (!this.#onRefusal) return;
    const { direction, reason, type, peerId, documentId } = refusal;
    this.#onRefusal(Object.freeze({ direction, reason, type, peerId, ...(documentId !== undefined ? { documentId } : {}) }));
  }
}

/**
 * A network adapter over one MessagePort that survives whatever the far end posts. It speaks the same wire a
 * stock message-channel adapter speaks (`arrive`, `welcome`, `leave`, then Repo messages), so a stock Repo
 * stands on the far port. Its own listener never throws: a value that fails to read as a message passes on
 * unread, for the leg to refuse by name. A throw inside a port listener escapes dispatch and can end the
 * owner's process, and the owner never stakes its life on what an island posts.
 *
 * It serves a `GatedSyncLeg` alone and stays out of any Repo's hands bare.
 */
export class PortSyncAdapter extends NetworkAdapter {
  readonly #port: MessagePort;
  #remote: string | null = null;
  #ready = false;
  #stopped = false;
  #resolveReady: (() => void) | null = null;
  readonly #readyPromise: Promise<void>;
  readonly #onMessage = (event: Event): void => {
    if (this.#stopped) return;
    try { this.#read((event as MessageEvent).data); } catch { /* a listener never throws */ }
  };
  // A PORT THAT CLOSES TAKES ITS PEER (road `P26`): a worker that ended, or a side that closed its port, posts no `leave`, so
  // the port's own close is the fact the house's arrival table reads.
  readonly #onClose = (): void => {
    if (this.#stopped || this.#remote === null) return;
    const peerId = this.#remote as PeerId;
    this.#remote = null;
    this.emit("peer-disconnected", { peerId });
  };

  constructor(port: MessagePort) {
    super();
    this.#port = port;
    this.#readyPromise = new Promise((resolve) => { this.#resolveReady = resolve; });
  }

  isReady(): boolean { return this.#ready; }
  whenReady(): Promise<void> { return this.#readyPromise; }

  connect(peerId: PeerId, peerMetadata?: PeerMetadata): void {
    this.peerId = peerId;
    if (peerMetadata !== undefined) this.peerMetadata = peerMetadata;
    this.#port.addEventListener("message", this.#onMessage);
    this.#port.addEventListener("close", this.#onClose);
    this.#port.start();
    this.#port.postMessage({ senderId: peerId, type: "arrive", peerMetadata });
    this.#ready = true;                                    // a port needs no dial: it stands ready at once
    this.#resolveReady?.();
  }

  send(message: Message): void {
    if (this.#stopped) return;
    if (message.data instanceof Uint8Array) {
      const data = message.data.buffer.slice(message.data.byteOffset, message.data.byteOffset + message.data.byteLength) as ArrayBuffer;
      this.#port.postMessage({ ...message, data }, [data]);
    } else {
      this.#port.postMessage(message);
    }
  }

  disconnect(): void {
    if (this.#stopped) return;
    this.#stopped = true;
    this.#port.removeEventListener("message", this.#onMessage);
    this.#port.removeEventListener("close", this.#onClose);
    if (this.peerId !== undefined) {
      try { this.#port.postMessage({ type: "leave", senderId: this.peerId }); } catch { /* the port already closed */ }
    }
    if (this.#remote !== null) this.emit("peer-disconnected", { peerId: this.#remote as PeerId });
    this.#remote = null;
    this.emit("close");
  }

  #read(raw: unknown): void {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) { this.emit("message", raw as Message); return; }
    const message = raw as Record<string, unknown>;
    const { type, senderId, targetId } = message;
    if (targetId !== undefined && targetId !== this.peerId) return;      // addressed to another peer: dropped
    if ((type === "arrive" || type === "welcome") && typeof senderId === "string") {
      const claimed = message["peerMetadata"];
      const peerMetadata: PeerMetadata = typeof claimed === "object" && claimed !== null ? claimed as PeerMetadata : {};
      if (type === "arrive") {
        this.#port.postMessage({ type: "welcome", senderId: this.peerId, peerMetadata: this.peerMetadata, targetId: senderId });
      }
      this.#remote = senderId;
      this.emit("peer-candidate", { peerId: senderId as PeerId, peerMetadata });
      return;
    }
    if (type === "leave") {
      if (this.#remote !== null && senderId === this.#remote) {
        const peerId = this.#remote as PeerId;
        this.#remote = null;
        this.emit("peer-disconnected", { peerId });
      }
      return;
    }
    const data = message["data"];
    this.emit("message", (data instanceof ArrayBuffer ? { ...message, data: new Uint8Array(data) } : message) as unknown as Message);
  }
}

/**
 * The gate for documents that cross ONE way through a leg, toward this Repo and never from it or the reverse.
 * `receiveOnly` names documents this Repo reads from the far end and never writes toward it; `sendOnly` names
 * documents this Repo serves and never accepts a change for. Every other document crosses as `otherwise` says.
 *
 * A leaf wears it toward its hearth with the hearth's canon as `receiveOnly`; the hearth wears it toward its
 * leaves with the same canon as `sendOnly`. Canon then crosses hearth to leaf alone, from both ends.
 */
export function oneWayDocumentsGate(opts: {
  readonly receiveOnly?: ReadonlySet<string>;
  readonly sendOnly?:    ReadonlySet<string>;
  readonly admitPeer?:   (peerId: string) => boolean;
}): SyncLegGate {
  const receiveOnly = opts.receiveOnly ?? new Set<string>();
  const sendOnly    = opts.sendOnly ?? new Set<string>();
  const writes = (message: LegMessage): boolean => message.type === "ephemeral" || carriesChanges(message);
  return {
    admitPeer: opts.admitPeer ?? (() => true),
    inbound(message) {
      if (message.documentId !== undefined && sendOnly.has(message.documentId) && writes(message)) {
        return { pass: false, reason: "one-way-document" };
      }
      return LEG_PASS;
    },
    outbound(message) {
      if (message.documentId !== undefined && receiveOnly.has(message.documentId) && writes(message)) {
        return { pass: false, reason: "one-way-document" };
      }
      return LEG_PASS;
    },
  };
}
