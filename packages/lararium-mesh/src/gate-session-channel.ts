/**
 * gate-session-channel — the sealed channel a verified dial leaves behind, on the gate's side and the dialer's.
 *
 * The gate attaches a session BEFORE its verdict leaves and opens the seat AFTER; a dialer that reads
 * `verified` may send application frame one in that interval. This seam holds the interval shut:
 *
 *   1. a SEATED channel (the gate's half) is pending at birth; its pump starts at once, opens each frame under
 *      the session's transport, joins the parts through the sealed-carriage reader and BUFFERS whole messages
 *      (at most `pendingBound`; one more closes "pending-overflow"). Nothing delivers, and nothing sends, before
 *      `open()`;
 *   2. `open()` releases the buffer in arrival order, so an immediate frame arrives exactly once, after open;
 *   3. a DIALED channel (the dialer's half) is open at birth: its verdict is already read.
 *
 * HOW IT CLOSES. Every close names its cause. A peer's sealed "control/close" (`peer-close`) or the socket's
 * end (`peer-gone`) lets the messages already whole deliver, in order, then reads null; a local close and every
 * fault (`frame-unopened`, `carriage-refused`, `pending-overflow`, `abandoned`, `ids-spent`) drops what stood
 * undelivered. A close cuts the socket and spends the reader; a local close on an open channel sends one
 * sealed "control/close" first. A close echoes nothing. A local close whose writer has spent every id sends no
 * control/close (it can get no id): the channel still closes "local" and cuts, and the peer reads "peer-gone".
 *
 * BACK-PRESSURE. Once open, the pump pulls the socket only while fewer than `queueBound` (16) whole messages stand
 * undelivered, and resumes as recv() drains below it, so a peer outrunning its reader waits on the socket and the
 * queue never outgrows the bound by more than the one message a pull completes. While pending, the pendingBound
 * law above stands instead: a peer that keeps sending into an unopened seat closes the channel. A bound has a
 * cost: while the queue stands full the pump reads nothing, so a peer's control/close, or the socket's end, is read
 * only once the queue drains below the bound. Until then the channel reads open.
 *
 * THE BYTE BOUND. Beside the count, whole messages held undelivered weigh at most `queueBytes` (32 MiB where none is
 * named): while pending, a message that lifts the buffered bytes past it closes "pending-overflow"; once open, the pump
 * pulls nothing while the queue holds that many bytes, and one message heavier than the bound still delivers alone. A
 * gate names each session's bounds through `channelSessionTable`'s `bounds`, so a stranger's seat holds far less than a
 * member's.
 *
 * Pure of clocks and timers: ids come from one sealedWriter, order from the socket's own, and a race pins on a
 * promise the caller holds. Frames after open ride the sealed application header of sealed-carriage.
 *
 * Called by the oracle reader and the browser adapter (`lar-ws-client-adapter`); the package barrel names it.
 *
 * Canon: operator house ruling "Frames after open" (stable-founding-road #/rulings).
 */
import type { GateSession, GateSessionTable, GateSocket } from "./face-gate.js";
import type { NoiseTransport } from "./noise-ik.js";
import { SealedIdsSpent, sealedReader, sealedWriter, type SealedKind, type SealedMessage } from "./sealed-carriage.js";

/** The socket beneath a channel: the gate's GateSocket and a dialer's DialSocket both fit (adapt DialSocket.close to cut). */
export interface ChannelSocket {
  send(frame: Uint8Array): void;
  recv(): Promise<Uint8Array | null>;
  cut(): void;
}

export const CHANNEL_CLOSE_REASONS = ["local", "peer-close", "peer-gone", "frame-unopened", "carriage-refused", "pending-overflow", "abandoned", "ids-spent"] as const;
export type ChannelCloseReason = (typeof CHANNEL_CLOSE_REASONS)[number];

/** A send on a channel that is not open: "unopened" while pending, else the reason it closed. */
export class GateChannelClosed extends Error {
  readonly reason: ChannelCloseReason | "unopened";
  constructor(reason: ChannelCloseReason | "unopened") {
    super(`gate-session-channel: ${reason}`);
    this.name = "GateChannelClosed";
    this.reason = reason;
  }
}

export interface GateSessionChannel {
  /** "pending" (gate side, seat taken, verdict not yet confirmed open) · "open" · "closed". */
  readonly state: "pending" | "open" | "closed";
  readonly closedBy: ChannelCloseReason | null;
  /** Seal and send one message of `kind` (never "control/close": close() owns it). Throws GateChannelClosed("unopened") while pending and GateChannelClosed(reason) once closed. */
  send(kind: Exclude<SealedKind, "control/close">, bytes: Uint8Array): void;
  /**
   * The next whole message in arrival order. It waits while pending: frames buffer and never deliver before open.
   * Messages already whole before a PEER close (or the socket's end) deliver in order, then null; a local close
   * or any fault drops them. A SEATED channel whose peer closed (or whose socket ended) while still pending, and
   * which holds undelivered messages, keeps a recv() waiting until open() or abandon() runs: a direct caller of
   * seatedChannel must do one of the two. channelSessionTable does: it abandons such a channel at open().
   */
  recv(): Promise<SealedMessage | null>;
  /** Close locally: send one sealed "control/close" (empty body) if open, then cut the socket. Idempotent. */
  close(): void;
}

/** The gate's half: pending at birth; its pump starts at once and buffers whole messages. */
export interface SeatedChannel extends GateSessionChannel { open(): void; abandon(): void }

interface ChannelArgs {
  readonly transport: NoiseTransport;
  readonly socket: ChannelSocket;
  readonly bounds?: Parameters<typeof sealedReader>[0];
  /** The first message id; 0 where none is named. A vector of the id bound names its own. */
  readonly firstId?: number;
  /** BACK-PRESSURE. Once open, the pump stops pulling the socket while this many whole messages stand undelivered, and resumes as recv() drains below it. At least 1; 16 where none is named. */
  readonly queueBound?: number;
  /** THE BYTE BOUND on whole messages held undelivered: past it while pending closes "pending-overflow"; once open the pump waits at it. At least 1; 32 MiB where none is named. */
  readonly queueBytes?: number;
  /** Called once when the pump ends, whatever ended it. A vector's handshake; no caller needs it. */
  readonly settled?: () => void;
}

const PENDING_BOUND = 16;
const QUEUE_BOUND = 16;
const QUEUE_BYTES = 32 * 1024 * 1024;

/** What one seated session may hold: the reader's reassembly bounds, and the channel's own message queue. */
export interface GateChannelBounds {
  /** Messages begun and unfinished at once (`sealedReader`). */
  readonly concurrent?:   number;
  /** Declared bytes summed over messages in flight (`sealedReader`). */
  readonly bufferBytes?:  number;
  /** The most bytes one message holds (`sealedReader`). */
  readonly messageBytes?: number;
  /** Whole messages buffered before open; one more closes "pending-overflow". */
  readonly pendingBound?: number;
  /** Whole messages queued after open before the pump waits. */
  readonly queueBound?:   number;
  /** Bytes of whole messages held undelivered (see the byte bound above). */
  readonly queueBytes?:   number;
}

function channelOver(args: ChannelArgs, born: "pending" | "open", pendingBound: number): SeatedChannel {
  const { transport, socket } = args;
  const queueBound = args.queueBound ?? QUEUE_BOUND;
  if (!Number.isInteger(queueBound) || queueBound < 1) throw new RangeError("gate-session-channel: queueBound names a count of at least one");
  const queueBytes = args.queueBytes ?? QUEUE_BYTES;
  if (!Number.isInteger(queueBytes) || queueBytes < 1) throw new RangeError("gate-session-channel: queueBytes names a count of at least one");
  const reader = sealedReader(args.bounds);
  const writer = sealedWriter(args.firstId ?? 0);
  const queue: SealedMessage[] = [];
  let queued = 0;                                        // bytes of the whole messages `queue` holds
  const take = (): SealedMessage | undefined => { const next = queue.shift(); if (next !== undefined) queued -= next.bytes.length; return next; };
  const full = (): boolean => queue.length >= queueBound || (queue.length > 0 && queued >= queueBytes);
  const waiters: Array<(message: SealedMessage | null) => void> = [];
  let state: "pending" | "open" | "closed" = born;
  let closedBy: ChannelCloseReason | null = null;
  let opened = born === "open";
  let resume: (() => void) | null = null;
  const wake = (): void => { const go = resume; resume = null; go?.(); };

  const flush = (): void => {
    while (waiters.length > 0) {
      const next = opened ? take() : undefined;
      if (next !== undefined) { waiters.shift()!(next); if (!full()) wake(); continue; }
      // Nothing to hand over: a closed channel with nothing deliverable reads null; otherwise the waiter stands.
      if (state === "closed" && (queue.length === 0)) { waiters.shift()!(null); continue; }
      break;
    }
  };

  const close = (reason: ChannelCloseReason, opts: { drop: boolean; notify?: boolean }): void => {
    if (state === "closed") return;
    const wasOpen = state === "open";
    state = "closed";
    closedBy = reason;
    if (opts.drop) { queue.length = 0; queued = 0; }
    if (opts.notify && wasOpen) {
      try { for (const part of writer.parts("control/close", new Uint8Array(0))) socket.send(transport.send.seal(part)); } catch { /* the socket is gone */ }
    }
    reader.close();
    try { socket.cut(); } catch { /* already gone */ }
    flush();
    wake();
  };

  void (async () => {
    try {
    for (;;) {
      // Back-pressure: an open channel whose queue stands full pulls nothing until recv() drains it (or a close ends the pump).
      while (opened && (state as string) !== "closed" && full()) await new Promise<void>((resolve) => { resume = resolve; });
      // A pump woken by close() ends here: it never awaits recv() on a socket the close has cut.
      if ((state as string) === "closed") return;
      let frame: Uint8Array | null;
      try { frame = await socket.recv(); } catch { frame = null; }
      if ((state as string) === "closed") return;
      if (frame === null) return close("peer-gone", { drop: false });
      let plain: Uint8Array;
      try { plain = transport.receive.open(frame); } catch { return close("frame-unopened", { drop: true }); }
      const read = reader.push(plain);
      if (read === null) continue;
      if ("refusal" in read) return close("carriage-refused", { drop: true });
      if (read.kind === "control/close") return close("peer-close", { drop: false });
      if (!opened && (queue.length >= pendingBound || queued + read.bytes.length > queueBytes)) return close("pending-overflow", { drop: true });
      queue.push(read);
      queued += read.bytes.length;
      flush();
    }
    } finally { args.settled?.(); }
  })();

  return {
    get state() { return state; },
    get closedBy() { return closedBy; },
    send(kind, bytes) {
      if (state === "pending") throw new GateChannelClosed("unopened");
      if (state === "closed") throw new GateChannelClosed(closedBy!);
      if ((kind as string) === "control/close") throw new TypeError("gate-session-channel: close() owns control/close");
      let parts: Uint8Array[];
      try {
        parts = writer.parts(kind, bytes);
      } catch (error) {
        if (error instanceof SealedIdsSpent) {
          close("ids-spent", { drop: true });
          throw new GateChannelClosed("ids-spent");
        }
        throw error;
      }
      try {
        for (const part of parts) socket.send(transport.send.seal(part));
      } catch {
        close("peer-gone", { drop: false });
        throw new GateChannelClosed("peer-gone");
      }
    },
    recv() {
      if (opened) {
        const next = take();
        if (next !== undefined) { if (!full()) wake(); return Promise.resolve(next); }
      }
      if (state === "closed" && queue.length === 0) return Promise.resolve(null);
      return new Promise((resolve) => { waiters.push(resolve); });
    },
    close() { close("local", { drop: true, notify: true }); },
    open() {
      opened = true;
      if (state === "pending") state = "open";
      flush();
      wake();
    },
    abandon() {
      close("abandoned", { drop: true });
      queue.length = 0;
      queued = 0;
      flush();
    },
  };
}

/** The gate's half: pending at birth; at most `pendingBound` (16 where none is named) whole messages buffer; one more closes "pending-overflow" and cuts. */
export function seatedChannel(args: ChannelArgs & { readonly pendingBound?: number }): SeatedChannel {
  return channelOver(args, "pending", args.pendingBound ?? PENDING_BOUND);
}

/** The dialer's half: open at birth, its verdict already read. */
export function dialedChannel(args: ChannelArgs): GateSessionChannel {
  const { open: _open, abandon: _abandon, ...channel } = Object.getOwnPropertyDescriptors(channelOver(args, "open", PENDING_BOUND));
  return Object.defineProperties({}, channel) as GateSessionChannel;
}

/**
 * A GateSessionTable for makeFaceGate: attach seats a pending channel over the attached socket and the session's
 * transport; open() opens it and hands it, with the frozen session, to onOpen exactly once; abandon() abandons
 * it. A throw from onOpen closes the channel "local" and rethrows (the gate then cuts). A channel already closed
 * when open() runs (the peer closed or the socket ended while the seat stood pending) goes to onOpen never: open()
 * abandons it and throws GateChannelClosed(reason), and the gate reads silence "session-unopened" and cuts. Whatever
 * the peer had sent before it left is dropped with it.
 */
export function channelSessionTable(
  onOpen: (channel: GateSessionChannel, session: GateSession) => void,
  opts?: {
    readonly pendingBound?: number;
    /** The bounds one session's channel holds to, named off the session the gate seats (its class, its tier). */
    readonly bounds?: (session: GateSession) => GateChannelBounds;
  },
): GateSessionTable {
  return {
    attach(socket: GateSocket, session: GateSession) {
      const named = opts?.bounds?.(session) ?? {};
      const reader = {
        ...(named.concurrent !== undefined ? { concurrent: named.concurrent } : {}),
        ...(named.bufferBytes !== undefined ? { bufferBytes: named.bufferBytes } : {}),
        ...(named.messageBytes !== undefined ? { messageBytes: named.messageBytes } : {}),
      };
      const pendingBound = named.pendingBound ?? opts?.pendingBound;
      const channel = seatedChannel({
        transport: session.transport, socket, bounds: reader,
        ...(pendingBound !== undefined ? { pendingBound } : {}),
        ...(named.queueBound !== undefined ? { queueBound: named.queueBound } : {}),
        ...(named.queueBytes !== undefined ? { queueBytes: named.queueBytes } : {}),
      });
      let handed = false;
      return {
        open() {
          if (handed) return;
          handed = true;
          // A session that closed while its seat stood pending is dead: hand nothing to onOpen. The throw makes the gate
          // abandon the seat, cut the socket and read silence "session-unopened" (face-gate step 9), never "attached".
          if (channel.state === "closed") { const reason = channel.closedBy!; channel.abandon(); throw new GateChannelClosed(reason); }
          channel.open();
          try { onOpen(channel, session); } catch (error) { channel.close(); throw error; }
        },
        abandon() { channel.abandon(); },
      };
    },
  };
}
