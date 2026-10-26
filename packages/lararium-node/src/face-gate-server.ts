/**
 * face-gate-server — THE GATE'S SERVER SIDE: the knock dispatcher, the WebSocket beneath each `GateSocket`, and the
 * session table every verified dial seats through.
 *
 * A vessel stands one `FaceGate` per (Nexus, route) (`@lararium/mesh` `makeFaceGate`). This module stands them behind
 * ONE upgrade door:
 *
 *   · THE KNOCK DISPATCHER. Each stood gate answers on exactly one pathname, `<route>/<knock>`, the knock its own
 *     bundle derives (`gateKnock`). `handleUpgrade` claims an upgrade whose pathname names a stood gate and leaves
 *     every other alone (it returns false, and the vessel's dispatcher destroys that socket before any 101). Two
 *     Nexuses, or two tiers, on one route stand two paths, and a flight written to one pin decrypts at no other.
 *   · THE FIRST FLIGHT rides the upgrade's `Sec-WebSocket-Protocol` (`readGateFlightHeader`): the fixed name, then
 *     the flight as one token. A claimed upgrade whose header reads no flight, or whose flight decrypts under no bundle of the stood gate
 *     (`FaceGate.preflight`, one decryption before the upgrade; `accept` decrypts the same bytes once more), gets its socket
 *     destroyed before any 101. The 101 selects `GATE_PROTOCOL` alone and never echoes the token. No compression rides the socket, and
 *     no frame outweighs a Noise message.
 *   · THE GATE SOCKET (`wsGateSocket`). Binary frames alone carry the gate's sealed frames; a text frame cuts the
 *     socket. Frames wait in a queue for the gate (and, after the seat, its channel) to read them, bounded TWICE:
 *     at the soft bound (a frame count, or a byte count) the socket PAUSES and a read below both resumes it; past
 *     the hard bound (eight times the count, four times the bytes) the socket is CUT. The pause holds back what
 *     the kernel has not yet handed over, but `ws` still emits the frames it already parsed from the current
 *     chunk, so the hard bound is what caps a flood of tiny frames: one socket's queue never outgrows it.
 *     `cut` terminates with no close frame, no code and no reason.
 *   · THE SERVER'S OWN BOUNDS. At most `maxSockets` sockets stand upgraded at once; a knock past it is destroyed
 *     before any 101. A socket the gate turns away as `pending-full` is cut at once rather than at its lapse, and a
 *     gate whose accept throws has its socket cut.
 *   · THE HEARTBEAT. Every `heartbeatMs` the server pings each socket it upgraded on the real WebSocket, and cuts one
 *     that answered no ping since the last: a half-open peer holds no place past two beats. Every `ws` client and
 *     every browser answers a ping by itself.
 *   · THE SESSION TABLE (`gateSessionRegistry`). Every verified dial seats a sealed channel
 *     (`channelSessionTable`), pending until its verdict left; the registry hands each opened channel with its frozen
 *     session to the composer, and keeps the channels it opened so a refold can close the ones whose standing no
 *     longer holds (`drop`), and a stand-down can close them all. Each seat holds to its class's bounds
 *     (`gateChannelBoundsFor`): a stranger's far tighter than a member's. Strangers hold at most `maxStrangers` seats
 *     at once (`GATE_SERVER_MAX_STRANGERS`); one past it draws the silence a refused table draws, and a member still
 *     seats.
 *   · THE DEADLINE (`timerGateDeadlines`). One lapse per accept, drawn uniform in [base, 2·base), so how long a gate
 *     stays quiet says nothing of which check failed. The gate reads no clock; this source does.
 *
 * WHAT THE COMPOSER BINDS (slice D): for each (Nexus, route) it derives the bundle, stands `makeFaceGate` with its
 * rings, sorter and `registry.table`, and calls `server.stand({ gate, pin })`; it registers each answered path on the
 * vessel's dispatcher with `server.handleUpgrade` as the handler, or hands the server the raw `upgrade` event. What
 * reaches it afterwards is `onOpen(channel, session)`: a sealed channel and the class, face, profile and standing the
 * gate proved. No vessel key, no card and no proof frame crosses here.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-gate-exchange; train-w-launch#/slices (row C).
 */
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { randomInt } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import {
  GATE_PROTOCOL, NOISE_MAX_MESSAGE_BYTES, channelSessionTable, gateKnock, readGateBundlePin, readGateFlightHeader,
  type FaceGate, type GateBundlePin, type GateChannelBounds, type GateDeadlines, type GateFlightRefusal, type GateOutcome, type GateSeat, type GateSession,
  type GateSessionChannel, type GateSessionTable, type GateSocket,
} from "@lararium/mesh";

// ── The gate socket ─────────────────────────────────────────────────────────────────────────────

/** How many frames wait unread before the socket pauses; eight times as many cut it. */
export const GATE_SOCKET_QUEUE_BOUND = 32;
/** How many bytes wait unread before the socket pauses; four times as many cut it. */
export const GATE_SOCKET_BYTE_BOUND = 1 << 20;
/** How many sockets one server holds upgraded at once. */
export const GATE_SERVER_MAX_SOCKETS = 1024;
/** How many STRANGER sessions one registry holds seated at once; members seat past it. */
export const GATE_SERVER_MAX_STRANGERS = 256;
/** How often the server pings each socket it upgraded; a socket that answered no ping since the last beat is cut. */
export const GATE_SERVER_HEARTBEAT_MS = 30_000;

/**
 * THE BOUNDS ONE SEAT HOLDS TO, by the class its gate sorted. A STRANGER reaches the public shelf alone, so its channel
 * holds a message of at most 4 MiB, two in reassembly, and 4 MiB queued. A seat that stands on an admit, a contract or a
 * grant keeps room for a large Automerge sync message (house ruling "Frames after open"), with its queue held to 16 MiB
 * where the module ceiling would let sixteen whole messages wait.
 */
export const GATE_STRANGER_CHANNEL_BOUNDS: GateChannelBounds = Object.freeze({
  concurrent: 2, bufferBytes: 4 << 20, messageBytes: 4 << 20, pendingBound: 4, queueBound: 8, queueBytes: 4 << 20,
});
export const GATE_MEMBER_CHANNEL_BOUNDS: GateChannelBounds = Object.freeze({
  concurrent: 4, bufferBytes: 16 << 20, messageBytes: 16 << 20, queueBytes: 16 << 20,
});
/** The bounds a session's channel holds to: a stranger's, or a member's for every other class. */
export function gateChannelBoundsFor(session: Pick<GateSession, "class">): GateChannelBounds {
  return session.class === "stranger" ? GATE_STRANGER_CHANNEL_BOUNDS : GATE_MEMBER_CHANNEL_BOUNDS;
}

/** The largest deadline base: twice it stays a timer Node keeps (`2^31 - 1` ms), and its draw a range `randomInt` takes. */
export const GATE_DEADLINE_MAX_BASE_MS = 2 ** 30 - 1;

/** The slice of a `ws` socket this adapter reads: its events, its flow control, its send and its terminate. */
export interface GateWire {
  readonly readyState: number;
  on(event: "message", listener: (data: unknown, isBinary: boolean) => void): unknown;
  on(event: "close" | "error", listener: (...args: unknown[]) => void): unknown;
  send(data: Uint8Array, opts: { binary: true }): void;
  pause(): void;
  resume(): void;
  terminate(): void;
}

const OPEN = 1;

function bytesOf(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return Uint8Array.from(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
  if (Array.isArray(data) && data.every((part) => part instanceof Uint8Array)) return Uint8Array.from(Buffer.concat(data as Uint8Array[]));
  return null;
}

/**
 * One `ws` socket as a gate reads it: the flight its upgrade carried, binary frames in arrival order through a
 * bounded queue, a send that throws once the socket stands closed, and a cut with no close frame.
 */
export function wsGateSocket(ws: GateWire, flight: { readonly knock: string; readonly message1: Uint8Array }, bound = GATE_SOCKET_QUEUE_BOUND, byteBound = GATE_SOCKET_BYTE_BOUND): GateSocket {
  if (!Number.isInteger(bound) || bound < 1) throw new RangeError("face-gate-server: the queue bound names a count of at least one");
  if (!Number.isInteger(byteBound) || byteBound < 1) throw new RangeError("face-gate-server: the byte bound names a count of at least one");
  const queue: Uint8Array[] = [];
  let held = 0;
  const waiters: Array<(frame: Uint8Array | null) => void> = [];
  let ended = false;
  let paused = false;
  const end = (): void => {
    if (ended) return;
    ended = true;
    queue.length = 0;
    held = 0;
    for (const waiter of waiters.splice(0)) waiter(null);
  };
  const cut = (): void => {
    end();
    try { ws.terminate(); } catch { /* already gone */ }
  };
  ws.on("message", (data, isBinary) => {
    if (ended) return;
    const frame = isBinary ? bytesOf(data) : null;
    // A sealed frame rides binary alone: a text frame, or one that reads as no bytes, cuts the socket.
    if (frame === null) { cut(); return; }
    const waiter = waiters.shift();
    if (waiter !== undefined) { waiter(frame); return; }
    queue.push(frame);
    held += frame.length;
    // Past the hard bound the peer flooded through the pause: cut it.
    if (queue.length > bound * 8 || held > byteBound * 4) { cut(); return; }
    if ((queue.length >= bound || held >= byteBound) && !paused) { paused = true; try { ws.pause(); } catch { /* already gone */ } }
  });
  ws.on("close", end);
  ws.on("error", end);
  return Object.freeze({
    flight: Object.freeze({ knock: flight.knock, message1: Uint8Array.from(flight.message1) }),
    send(frame: Uint8Array): void {
      if (ended || ws.readyState !== OPEN) throw new Error("face-gate-server: the socket stands closed");
      ws.send(frame, { binary: true });
    },
    recv(): Promise<Uint8Array | null> {
      const next = queue.shift();
      if (next !== undefined) {
        held -= next.length;
        if (paused && queue.length < bound && held < byteBound) { paused = false; try { ws.resume(); } catch { /* already gone */ } }
        return Promise.resolve(next);
      }
      if (ended) return Promise.resolve(null);
      return new Promise((resolve) => { waiters.push(resolve); });
    },
    cut,
  });
}

// ── The deadline ────────────────────────────────────────────────────────────────────────────────

/** The process timer as a gate's deadline source: one lapse per accept, uniform in [base, 2·base). */
export function timerGateDeadlines(opts: {
  readonly baseMs?: number;
  readonly random?: (min: number, max: number) => number;
  readonly setTimer?: (lapse: () => void, ms: number) => unknown;
  readonly clearTimer?: (timer: unknown) => void;
} = {}): GateDeadlines {
  const base = opts.baseMs ?? 5_000;
  if (!Number.isSafeInteger(base) || base < 1 || base > GATE_DEADLINE_MAX_BASE_MS) {
    throw new RangeError(`face-gate-server: the deadline's base names a whole number of milliseconds from one to ${GATE_DEADLINE_MAX_BASE_MS}`);
  }
  const random = opts.random ?? randomInt;
  const setTimer = opts.setTimer ?? ((lapse: () => void, ms: number) => setTimeout(lapse, ms));
  const clearTimer = opts.clearTimer ?? ((timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>));
  return {
    draw(lapse) {
      const timer = setTimer(lapse, base + random(0, base));
      let live = true;
      return { cancel() { if (live) { live = false; clearTimer(timer); } } };
    },
  };
}

// ── The session table ───────────────────────────────────────────────────────────────────────────

/** One seated session the registry opened: the sealed channel and what the gate proved. */
export interface SeatedGateSession {
  readonly channel: GateSessionChannel;
  readonly session: GateSession;
}

export interface GateSessionRegistry {
  /** The table every gate this vessel stands seats through. */
  readonly table: GateSessionTable;
  /** The sessions opened and not yet closed, in the order they opened. */
  live(): readonly SeatedGateSession[];
  /** Close every live session `which` names (a refold whose standing no longer holds); answers how many it closed. */
  drop(which: (session: GateSession) => boolean): number;
  /** Close every live session. */
  close(): void;
}

/**
 * The session table over `channelSessionTable`: a verified dial seats a pending sealed channel; once the gate's
 * verdict left and the seat opens, `onOpen` takes the channel and the frozen session exactly once. A throw from
 * `onOpen` closes the channel and the gate cuts the socket.
 */
export function gateSessionRegistry(
  onOpen: (channel: GateSessionChannel, session: GateSession) => void,
  opts: {
    /** How many stranger sessions stand seated at once (`GATE_SERVER_MAX_STRANGERS`). */
    readonly maxStrangers?: number;
    /** The bounds each seat holds to (`gateChannelBoundsFor`). */
    readonly bounds?: (session: GateSession) => GateChannelBounds;
  } = {},
): GateSessionRegistry {
  const maxStrangers = opts.maxStrangers ?? GATE_SERVER_MAX_STRANGERS;
  if (!Number.isInteger(maxStrangers) || maxStrangers < 0) throw new RangeError("face-gate-server: the stranger bound names a count");
  const opened: SeatedGateSession[] = [];
  let closed = false;
  // Stranger seats taken and not yet opened or abandoned: the cap reads them beside the open ones.
  let pendingStrangers = 0;
  const prune = (): void => {
    for (let at = opened.length - 1; at >= 0; at--) if (opened[at]!.channel.state === "closed") opened.splice(at, 1);
  };
  const strangersSeated = (): number => { prune(); return pendingStrangers + opened.filter((o) => o.session.class === "stranger").length; };
  const channels = channelSessionTable((channel, session) => {
    // A seat that opens after the registry closed reaches nobody: its channel closes and the gate cuts the socket.
    if (closed) { channel.close(); throw new Error("face-gate-server: the session registry stands closed"); }
    const seated = Object.freeze({ channel, session });
    opened.push(seated);
    try { onOpen(channel, session); } catch (error) {
      const at = opened.indexOf(seated);
      if (at >= 0) opened.splice(at, 1);
      throw error;
    }
  }, { bounds: opts.bounds ?? gateChannelBoundsFor });
  // THE STRANGER CAP, read at attach, before any verdict leaves: a table that throws draws the dialer silence.
  const table: GateSessionTable = {
    attach(socket, session) {
      if (session.class !== "stranger") return channels.attach(socket, session);
      if (strangersSeated() >= maxStrangers) throw new Error("face-gate-server: the stranger seats stand full");
      pendingStrangers++;
      let pending = true;
      const settle = (): void => { if (pending) { pending = false; pendingStrangers--; } };
      const held = (seat: GateSeat): GateSeat => ({
        open() { settle(); seat.open(); },
        abandon() { settle(); seat.abandon(); },
      });
      let seat: ReturnType<GateSessionTable["attach"]>;
      try { seat = channels.attach(socket, session); } catch (error) { settle(); throw error; }
      return seat instanceof Promise ? seat.then(held, (error: unknown) => { settle(); throw error; }) : held(seat);
    },
  };
  return {
    table,
    live() { prune(); return Object.freeze([...opened]); },
    drop(which) {
      prune();
      let dropped = 0;
      for (const { channel, session } of [...opened]) {
        // A reading that throws cannot say the standing holds: that session closes too.
        let goes: boolean;
        try { goes = which(session); } catch { goes = true; }
        if (!goes) continue;
        channel.close();
        dropped++;
      }
      prune();
      return dropped;
    },
    close() {
      closed = true;
      for (const { channel } of opened.splice(0)) channel.close();
    },
  };
}

// ── The knock dispatcher ────────────────────────────────────────────────────────────────────────

/** Where a stood gate answers. */
export interface StoodGate {
  /** The exact upgrade pathname: `<route>/<knock>`. */
  readonly path: string;
  /** Stop answering on this path; a socket already accepted runs on. Idempotent. */
  unstand(): void;
}

/** Why a claimed upgrade drew no gate, for the vessel's own log. Nothing of it crosses the wire. */
export type GateUpgradeRefusal = GateFlightRefusal | "server-closed" | "server-full" | "flight-undecrypted";

export interface FaceGateServerOptions {
  /** How many frames wait unread per socket before it pauses. */
  readonly queueBound?: number;
  /** How many bytes wait unread per socket before it pauses. */
  readonly byteBound?: number;
  /** How many sockets stand upgraded at once. */
  readonly maxSockets?: number;
  /** How often the server pings each socket (`GATE_SERVER_HEARTBEAT_MS`); one that answered no ping since is cut. */
  readonly heartbeatMs?: number;
  /** What each accepted socket came to, by the path it knocked on. */
  readonly onOutcome?: (path: string, outcome: GateOutcome) => void;
  /** A claimed upgrade destroyed before any 101, and why. */
  readonly onRefuse?: (path: string, refusal: GateUpgradeRefusal) => void;
}

export interface FaceGateServer {
  /** Stand `gate` on the path its pin's knock names. A second gate on a path already stood throws. */
  stand(entry: { readonly gate: FaceGate; readonly pin: GateBundlePin }): StoodGate;
  /** Claim an upgrade whose pathname names a stood gate; false (the socket untouched) for every other. */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean;
  /** The pathnames stood now. */
  paths(): readonly string[];
  /** Stand every gate down and cut every socket this server upgraded. */
  close(): void;
}

/** The exact pathname a gate answers on: its pin's route, then its knock. */
export function gatePath(pin: GateBundlePin): string {
  const read = readGateBundlePin(pin);
  if (!("pin" in read)) throw new RangeError(`face-gate-server: the pin does not read (${read.refusal})`);
  return `${read.pin.route}/${gateKnock(read.pin)}`;
}

export function faceGateServer(opts: FaceGateServerOptions = {}): FaceGateServer {
  const bound = opts.queueBound ?? GATE_SOCKET_QUEUE_BOUND;
  if (!Number.isInteger(bound) || bound < 1) throw new RangeError("face-gate-server: the queue bound names a count of at least one");
  const byteBound = opts.byteBound ?? GATE_SOCKET_BYTE_BOUND;
  if (!Number.isInteger(byteBound) || byteBound < 1) throw new RangeError("face-gate-server: the byte bound names a count of at least one");
  const maxSockets = opts.maxSockets ?? GATE_SERVER_MAX_SOCKETS;
  if (!Number.isInteger(maxSockets) || maxSockets < 1) throw new RangeError("face-gate-server: the socket bound names a count of at least one");
  const heartbeatMs = opts.heartbeatMs ?? GATE_SERVER_HEARTBEAT_MS;
  if (!Number.isSafeInteger(heartbeatMs) || heartbeatMs < 1 || heartbeatMs > GATE_DEADLINE_MAX_BASE_MS) throw new RangeError("face-gate-server: the heartbeat names a whole number of milliseconds");
  const gates = new Map<string, { readonly gate: FaceGate; readonly knock: string }>();
  // Paths this server once stood: a knock on one after the close is claimed and destroyed by name.
  const once = new Set<string>();
  const sockets = new Set<WebSocket>();
  // THE HEARTBEAT: each socket answered a ping since the last beat, or the beat cuts it. The timer stands while a
  // socket does, and never holds the process open.
  const answered = new WeakMap<WebSocket, boolean>();
  let beat: ReturnType<typeof setInterval> | null = null;
  const beatOnce = (): void => {
    for (const ws of sockets) {
      if (answered.get(ws) !== true) { try { ws.terminate(); } catch { /* already gone */ } sockets.delete(ws); continue; }
      answered.set(ws, false);
      try { ws.ping(); } catch { /* the close event takes it */ }
    }
    if (sockets.size === 0 && beat !== null) { clearInterval(beat); beat = null; }
  };
  const follow = (ws: WebSocket): void => {
    answered.set(ws, true);
    ws.on("pong", () => { answered.set(ws, true); });
    if (beat === null) { beat = setInterval(beatOnce, heartbeatMs); beat.unref?.(); }
  };
  // Upgrades claimed and not yet handed a socket: they count against the bound too.
  let upgrading = 0;
  let closed = false;
  const wss = new WebSocketServer({
    noServer: true, clientTracking: false, perMessageDeflate: false, maxPayload: NOISE_MAX_MESSAGE_BYTES,
    // The 101 selects the gate's one protocol and never the token beside it.
    handleProtocols: (protocols) => (protocols.has(GATE_PROTOCOL) ? GATE_PROTOCOL : false),
  });
  const refuse = (path: string, refusal: GateUpgradeRefusal): void => { try { opts.onRefuse?.(path, refusal); } catch { /* a log never decides */ } };

  return {
    stand({ gate, pin }) {
      if (closed) throw new Error("face-gate-server: the server stands closed");
      const path = gatePath(pin);
      if (gates.has(path)) throw new Error(`face-gate-server: a gate already stands on ${path}`);
      const entry = Object.freeze({ gate, knock: gateKnock(pin) });
      gates.set(path, entry);
      once.add(path);
      return Object.freeze({
        path,
        unstand() { if (gates.get(path) === entry) gates.delete(path); },
      });
    },
    handleUpgrade(req, socket, head) {
      let path: string;
      try { path = new URL(req.url ?? "/", "http://gate.invalid").pathname; } catch { return false; }
      if (closed) {
        if (!once.has(path)) return false;
        refuse(path, "server-closed"); socket.destroy(); return true;
      }
      const stood = gates.get(path);
      if (stood === undefined) return false;
      if (sockets.size + upgrading >= maxSockets) { refuse(path, "server-full"); socket.destroy(); return true; }
      const header = req.headers["sec-websocket-protocol"];
      const flight = readGateFlightHeader(Array.isArray(header) ? header.join(", ") : header);
      if (!flight.ok) { refuse(path, flight.refusal); socket.destroy(); return true; }
      // The flight decrypts under this gate's bundle BEFORE any 101: a token that opens nothing draws the same
      // destroyed socket the other pre-upgrade refusals draw. Bounded by size (one fixed-length flight) and work
      // (one decryption), never by time; `accept` decrypts the same bytes once more.
      if (!stood.gate.preflight(flight.message1)) { refuse(path, "flight-undecrypted"); socket.destroy(); return true; }
      upgrading++;
      let settled = false;
      const settle = (): void => { if (!settled) { settled = true; upgrading--; } };
      socket.once("close", settle);
      wss.handleUpgrade(req, socket, head, (ws) => {
        settle();
        if (closed) { ws.terminate(); return; }
        sockets.add(ws);
        follow(ws);
        ws.once("close", () => sockets.delete(ws));
        const gateSocket = wsGateSocket(ws as unknown as GateWire, { knock: stood.knock, message1: flight.message1 }, bound, byteBound);
        let accepting: Promise<GateOutcome>;
        try { accepting = Promise.resolve(stood.gate.accept(gateSocket)); } catch (error) { accepting = Promise.reject(error); }
        accepting.then((outcome) => {
          // A socket the gate turned away for want of a pending place holds nothing for it: cut it now.
          if (outcome.outcome === "silence" && outcome.reason === "pending-full") gateSocket.cut();
          try { opts.onOutcome?.(path, outcome); } catch { /* a log never decides */ }
        }, () => {
          // A gate whose accept threw reads as silence: its socket is cut, never left open.
          gateSocket.cut();
        });
      });
      return true;
    },
    paths() { return Object.freeze([...gates.keys()]); },
    close() {
      if (closed) return;
      closed = true;
      gates.clear();
      for (const ws of sockets) { try { ws.terminate(); } catch { /* already gone */ } }
      sockets.clear();
      if (beat !== null) { clearInterval(beat); beat = null; }
      wss.close();
    },
  };
}
