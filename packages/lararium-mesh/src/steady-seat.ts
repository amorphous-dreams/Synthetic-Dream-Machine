/**
 * steady-seat — the core that holds a client's MCP seat across its child's sleep.
 *
 * The capability: a seat that keeps breathing while the surface behind it restarts. The client speaks to the seat for its
 * session's whole life; the surface runs as a child the seat asks its binding to spawn again each time it falls. The core
 * runs as a pure frame machine behind two ports: client frames in, child frames in and child-state events in; frames out, plus
 * `spawn`, `kill` and `exit` intents. It names no host, opens no stream and reads no clock, so one core serves every vessel.
 *
 *   it never exits on a child's death      only the client's close ends it
 *   it answers from its cache              the child's `initialize` answer and its whole tool list, while no child stands
 *   it replays the handshake itself        each new child reads the client's own `initialize` params, then `initialized`
 *   a call with no child standing          answers the tool error `hearth-sleeps` at once; nothing waits in the seat
 *   a call in flight at the death          answers the tool error `outcome-unknown: re-read before re-trying`; never sent again
 *   a new tool list                        draws one `notifications/tools/list_changed`; a mere respawn draws none
 *   it logs no payload and holds no key    a log names an event from `SeatLogEvent` and two counts, nothing of any frame
 *
 * IDEMPOTENT BY INTENT. The seat sends a client's request to one child, once. The handshake it replays reads as a pure
 * function of the client's `initialize` params, and the tool-list notice fires on a hash change alone.
 *
 * TWO ID SPACES. The seat issues its own ids toward the child (its handshake rides there beside the client's requests), and
 * its own ids toward the client for a request the child sends, so neither side's ids cross a respawn.
 *
 * RESPAWN PACING BELONGS TO THE BINDING. The core holds no clock: it emits `spawn` each time no child stands and the seat
 * stays open, and `standing` each time a child completes its handshake. A binding owns the timer between a `spawn` intent and
 * the spawn it performs, and reads `standing` as the sign to start its pacing over.
 *
 * WITH NO CHILD AND NO CACHE the seat still answers: `initialize` reads a plain answer naming the seat itself, and the tool
 * list reads empty. The first real list then hashes differently and draws the one `list_changed`.
 */
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";

/** One JSON-RPC message, already parsed: the binding owns the framing. */
export type SeatFrame = Record<string, unknown>;

export type SeatEvent =
  | { readonly type: "start" }
  | { readonly type: "client-frame"; readonly frame: unknown }
  | { readonly type: "client-closed" }
  /** The binding spawned a child and its streams stand open. */
  | { readonly type: "child-up" }
  | { readonly type: "child-frame"; readonly frame: unknown }
  /** The child fell, or a spawn failed: every frame it wrote has already arrived. */
  | { readonly type: "child-down" };

/** The whole vocabulary a log speaks. */
export type SeatLogEvent =
  | "start" | "child-up" | "child-standing" | "child-down" | "client-closed" | "frame-refused" | "answer-unowned"
  | "call-while-asleep" | "call-outcome-unknown" | "tools-changed" | "handshake-refused";

export type SeatEffect =
  | { readonly type: "to-client"; readonly frame: SeatFrame }
  | { readonly type: "to-child"; readonly frame: SeatFrame }
  /** A child stands wanted; the binding paces the spawn. */
  | { readonly type: "spawn" }
  | { readonly type: "kill" }
  /** The child completed its handshake and takes calls. */
  | { readonly type: "standing" }
  | { readonly type: "exit" }
  /** `generation` counts the children that came up; `pending` counts the client's requests in flight. */
  | { readonly type: "log"; readonly event: SeatLogEvent; readonly generation: number; readonly pending: number };

export interface SteadySeat { step(event: SeatEvent): SeatEffect[] }

export const HEARTH_SLEEPS = "hearth-sleeps: the vessel rests and this call never left the seat; re-try once it wakes";
export const OUTCOME_UNKNOWN = "outcome-unknown: re-read before re-trying";

const LIST_CHANGED = "notifications/tools/list_changed";
const SEAT_ERROR = -32000;

type Id = string | number;
type Owner =
  | { readonly kind: "client"; readonly id: Id; readonly method: string }
  | { readonly kind: "init" }
  | { readonly kind: "list"; readonly acc: unknown[] };

const object = (x: unknown): x is SeatFrame => typeof x === "object" && x !== null && !Array.isArray(x);
const isId = (x: unknown): x is Id => typeof x === "string" || (typeof x === "number" && Number.isFinite(x));
const key = (id: Id): string => `${typeof id}:${String(id)}`;
const toolError = (id: Id, text: string): SeatFrame => ({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }], isError: true } });
const rpcError = (id: Id, message: string): SeatFrame => ({ jsonrpc: "2.0", id, error: { code: SEAT_ERROR, message } });

/** A tool list's hash, blind to the order the child lists in. */
export function toolListHash(tools: readonly unknown[]): string {
  return sha256HexBytesSync(canonicalJsonBytes(tools.map((t) => sha256HexBytesSync(canonicalJsonBytes(t))).sort()));
}

export function steadySeat(): SteadySeat {
  let closed = false, generation = 0, nextId = 0;
  let child: "none" | "up" | "standing" = "none";
  let handshaking = false;
  /** The client's own `initialize` params, replayed to every child. */
  let clientInit: unknown | undefined;
  let clientHasInit = false, clientReady = false;
  let initResult: SeatFrame | null = null;
  let tools: { readonly list: readonly unknown[]; readonly hash: string } | null = null;
  const owners = new Map<number, Owner>();
  /** A client request's id -> the id it rides under toward the child. */
  const clientIds = new Map<string, number>();
  /** The seat's id toward the client -> the child's own id for a request it sent, and the reverse. */
  const childAsks = new Map<string, Id>(), askIds = new Map<string, string>();
  const initWaiters: Id[] = [], listWaiters: Id[] = [];

  let out: SeatEffect[] = [];
  const pending = (): number => [...owners.values()].filter((o) => o.kind === "client").length;
  const log = (event: SeatLogEvent): void => { out.push({ type: "log", event, generation, pending: pending() }); };
  const client = (frame: SeatFrame): void => { out.push({ type: "to-client", frame }); };
  const send = (frame: SeatFrame): void => { out.push({ type: "to-child", frame }); };
  const ask = (owner: Owner, method: string, params?: unknown): number => {
    const id = nextId++;
    owners.set(id, owner);
    send({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) });
    return id;
  };

  /** The answer the client reads for `initialize`: the child's own, with the seat's vow to send `list_changed` added. */
  const initAnswer = (): SeatFrame => {
    const base: SeatFrame = initResult ?? {
      protocolVersion: object(clientInit) && typeof clientInit["protocolVersion"] === "string" ? clientInit["protocolVersion"] : "2025-06-18",
      capabilities: {}, serverInfo: { name: "steady-seat", version: "0" },
    };
    const caps = object(base["capabilities"]) ? base["capabilities"] : {};
    return { ...base, capabilities: { ...caps, tools: { ...(object(caps["tools"]) ? caps["tools"] : {}), listChanged: true } } };
  };
  const answerList = (id: Id): void => {
    tools ??= { list: [], hash: toolListHash([]) };
    client({ jsonrpc: "2.0", id, result: { tools: tools.list } });
  };
  const handshake = (): void => {
    handshaking = true;
    ask({ kind: "init" }, "initialize", clientInit);
  };
  const listed = (list: readonly unknown[]): void => {
    const prior = tools, hash = toolListHash(list);
    tools = { list, hash };
    if (child === "up") { child = "standing"; handshaking = false; log("child-standing"); out.push({ type: "standing" }); }
    for (const id of listWaiters.splice(0)) answerList(id);
    if (prior !== null && prior.hash !== hash) {
      log("tools-changed");
      if (clientReady) client({ jsonrpc: "2.0", method: LIST_CHANGED });
    }
  };

  function fromClient(frame: unknown): void {
    if (!object(frame)) { log("frame-refused"); return; }
    const method = frame["method"], id = frame["id"];
    if (typeof method !== "string") {
      // An answer to a request the child sent: it returns to that child alone.
      if (!isId(id)) { log("frame-refused"); return; }
      const childId = childAsks.get(key(id));
      if (childId === undefined || child === "none") { log("answer-unowned"); return; }
      childAsks.delete(key(id)); askIds.delete(key(childId));
      send({ ...frame, id: childId });
      return;
    }
    if (!isId(id)) {
      if (id !== undefined) { log("frame-refused"); return; }
      if (method === "notifications/initialized") { clientReady = true; return; }
      if (child !== "standing") return;
      if (method === "notifications/cancelled" && object(frame["params"]) && isId(frame["params"]["requestId"])) {
        const rides = clientIds.get(key(frame["params"]["requestId"]));
        if (rides !== undefined) send({ ...frame, params: { ...frame["params"], requestId: rides } });
        return;
      }
      send(frame);
      return;
    }
    if (method === "ping") { client({ jsonrpc: "2.0", id, result: {} }); return; }
    if (method === "initialize") {
      clientInit = frame["params"]; clientHasInit = true;
      if (initResult !== null || child === "none") { client({ jsonrpc: "2.0", id, result: initAnswer() }); return; }
      initWaiters.push(id);
      if (!handshaking) handshake();
      return;
    }
    if (method === "tools/list") {
      if (tools !== null || child !== "up" || !handshaking) { answerList(id); return; }
      listWaiters.push(id);
      return;
    }
    if (child !== "standing") {
      log("call-while-asleep");
      client(method === "tools/call" ? toolError(id, HEARTH_SLEEPS) : rpcError(id, HEARTH_SLEEPS));
      return;
    }
    const rides = nextId++;
    owners.set(rides, { kind: "client", id, method });
    clientIds.set(key(id), rides);
    send({ ...frame, id: rides });
  }

  function fromChild(frame: unknown): void {
    if (child === "none") return;
    if (!object(frame)) { log("frame-refused"); return; }
    const method = frame["method"], id = frame["id"];
    if (typeof method === "string") {
      if (isId(id)) {
        // A request the child sends the client rides under the seat's own id, so a later child's ids never meet it.
        const outward = `seat-${nextId++}`;
        childAsks.set(key(outward), id); askIds.set(key(id), outward);
        client({ ...frame, id: outward });
        return;
      }
      if (method === LIST_CHANGED) { if (child === "standing") ask({ kind: "list", acc: [] }, "tools/list"); return; }
      if (method === "notifications/cancelled" && object(frame["params"]) && isId(frame["params"]["requestId"])) {
        const outward = askIds.get(key(frame["params"]["requestId"]));
        if (outward !== undefined) client({ ...frame, params: { ...frame["params"], requestId: outward } });
        return;
      }
      client(frame);
      return;
    }
    const owner = typeof id === "number" ? owners.get(id) : undefined;
    if (owner === undefined) { log("answer-unowned"); return; }
    owners.delete(id as number);
    if (owner.kind === "client") {
      clientIds.delete(key(owner.id));
      client({ ...frame, id: owner.id });
      return;
    }
    if (owner.kind === "init") {
      if (!object(frame["result"])) { log("handshake-refused"); out.push({ type: "kill" }); return; }
      initResult = frame["result"];
      for (const waiter of initWaiters.splice(0)) client({ jsonrpc: "2.0", id: waiter, result: initAnswer() });
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      ask({ kind: "list", acc: [] }, "tools/list");
      return;
    }
    // A child that lists no tools at all (an error answer) reads as an empty list.
    const result = object(frame["result"]) ? frame["result"] : {};
    if (Array.isArray(result["tools"])) owner.acc.push(...result["tools"]);
    if (typeof result["nextCursor"] === "string" && result["nextCursor"].length > 0) { ask(owner, "tools/list", { cursor: result["nextCursor"] }); return; }
    listed(owner.acc);
  }

  function childDown(): void {
    for (const owner of owners.values()) {
      if (owner.kind !== "client") continue;
      client(owner.method === "tools/call" ? toolError(owner.id, OUTCOME_UNKNOWN) : rpcError(owner.id, OUTCOME_UNKNOWN));
      log("call-outcome-unknown");
    }
    owners.clear(); clientIds.clear(); childAsks.clear(); askIds.clear();
    child = "none"; handshaking = false;
    for (const waiter of initWaiters.splice(0)) client({ jsonrpc: "2.0", id: waiter, result: initAnswer() });
    for (const waiter of listWaiters.splice(0)) answerList(waiter);
    log("child-down");
    if (!closed) out.push({ type: "spawn" });
  }

  return {
    step(event) {
      out = [];
      switch (event.type) {
        case "start": log("start"); out.push({ type: "spawn" }); break;
        case "client-frame": if (!closed) fromClient(event.frame); break;
        case "child-frame": if (!closed) fromChild(event.frame); break;
        case "child-up":
          if (closed) { out.push({ type: "kill" }); break; }
          generation++; child = "up"; handshaking = false;
          log("child-up");
          if (clientHasInit) handshake();
          break;
        case "child-down": childDown(); break;
        case "client-closed":
          closed = true;
          log("client-closed");
          out.push({ type: "kill" }, { type: "exit" });
          break;
      }
      return out;
    },
  };
}
