/**
 * host-task — hand the running stretch back to the host's task queue.
 *
 * A long stretch of work on one island (a drain, a reconcile queue, a bulk LOAD) shares its thread with
 * everything else that island answers: a message from the vessel, an operator's invocation, a socket.
 * Those arrive as HOST TASKS, and a chain of promises never lets one in — a microtask runs before the
 * host looks at its queue again. `yieldToHost()` resolves on a later host task, so whatever the host
 * already holds takes its slice first.
 *
 * It paces and decides nothing: no duration is read, no deadline is kept, and work that yields still
 * runs. The seat is chosen from what the host offers, in this order:
 *   - `setImmediate` (Node, its workers included): the check phase, after the poll phase that delivers
 *     pending I/O and port messages;
 *   - `scheduler.yield` (a browser or worker that implements it): a continuation the host schedules;
 *   - `MessageChannel` (every other browser worker): a port message is a host task;
 *   - a zero-delay timer where none of those stands.
 *
 * Dependency-free, so a module that may reach mesh by subpath alone can import it.
 */

/** Resolves on a later host task. */
export type HostTaskYield = () => Promise<void>;

/** The host surface `selectHostTaskYield` reads; `globalThis` satisfies it. */
export interface HostTaskScope {
  setImmediate?: (fn: () => void) => unknown;
  scheduler?: { yield?: () => Promise<void> };
  MessageChannel?: new () => {
    port1: { onmessage: ((ev: unknown) => void) | null };
    port2: { postMessage(message: unknown): void };
  };
  setTimeout?: (fn: () => void, ms: number) => unknown;
}

/** Which seat `selectHostTaskYield` chose. */
export type HostTaskSeat = "setImmediate" | "scheduler.yield" | "MessageChannel" | "setTimeout";

/** Name the seat a scope offers, by the order the module header states. */
export function hostTaskSeatOf(scope: HostTaskScope): HostTaskSeat {
  if (typeof scope.setImmediate === "function") return "setImmediate";
  if (typeof scope.scheduler?.yield === "function") return "scheduler.yield";
  if (typeof scope.MessageChannel === "function") return "MessageChannel";
  return "setTimeout";
}

/** Build the yield for one scope. The scope is read once, here; each call then takes one host task. */
export function selectHostTaskYield(scope: HostTaskScope): HostTaskYield {
  const seat = hostTaskSeatOf(scope);
  if (seat === "setImmediate") {
    const setImmediate = scope.setImmediate!;
    return () => new Promise<void>((resolve) => { setImmediate(() => resolve()); });
  }
  if (seat === "scheduler.yield") {
    const scheduler = scope.scheduler!;
    return () => scheduler.yield!();
  }
  if (seat === "MessageChannel") {
    // One channel serves every yield: each post is one host task, and the waiters resolve in order.
    const channel = new scope.MessageChannel!();
    const waiting: Array<() => void> = [];
    channel.port1.onmessage = () => { waiting.shift()?.(); };
    return () => new Promise<void>((resolve) => { waiting.push(resolve); channel.port2.postMessage(0); });
  }
  const setTimeout = scope.setTimeout;
  if (typeof setTimeout !== "function") throw new Error("host-task: this host offers no task queue (no setImmediate, scheduler.yield, MessageChannel or setTimeout)");
  return () => new Promise<void>((resolve) => { setTimeout(() => resolve(), 0); });
}

let _yield: HostTaskYield | null = null;

/** Resolve on a later host task of THIS host. The seat is chosen at the first call. */
export function yieldToHost(): Promise<void> {
  if (!_yield) _yield = selectHostTaskYield(globalThis as unknown as HostTaskScope);
  return _yield();
}
