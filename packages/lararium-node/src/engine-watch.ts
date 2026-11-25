/**
 * engine-watch — whether this isolate's Automerge engine still stands, and what a dead one tells every caller.
 *
 * ONE ENGINE PER ISOLATE. The Node binding of `@automerge/automerge` instantiates one wasm module when it loads, and every
 * document and Repo in that isolate shares it. When an allocation fails inside it (`rust_oom` under `panic=abort`) the trap
 * surfaces as `RuntimeError: unreachable`, the binding marks itself terminated, and every later call throws
 * `Module terminated`; upstream also reports the poisoned instance as "recursive use of an object detected which would
 * lead to unsafe aliasing in rust" (automerge #896, automerge-repo #330). Nothing in-process re-instantiates the module:
 * only a fresh process brings a fresh engine.
 *
 * So the watch reads those three signatures as ONE FALL, from whichever path meets it first (the Repo's inbound-message
 * error, the receipt ledger's write, a storage save), and keeps the FIRST trap: a later error can mask the one that
 * killed the engine. From the fall on, the daemon names it everywhere a caller looks: health answers 503 with the cause
 * (`readiness-face`), every verb refuses `engine-terminated` before any handler runs (`uds-channel`), and a read the dead
 * engine cannot serve says so rather than answering empty.
 *
 * THE LAST SETTLED WAVE (the nalu's glitch-freedom, lar:///ha.ka.ba/lares/api/pono/nalu): the watch remembers the heads
 * and time of the last write that settled durably before the fall. Nothing after a fall reads a half-applied wave: a read
 * answers from what settled (the receipt ledger's cache holds only facts whose flush landed), names those heads, or
 * refuses.
 *
 * THE DOCUMENT IN FLIGHT. The Repo handles each inbound message synchronously inside the network subsystem's `message`
 * emit (`tapInboundDocs` wraps it), so a trap met there knows the document that message named: the fall carries it as
 * `inFlight`, and the next boot's probe reads it (`engine-fall`). The Repo's storage source logs a load or save it could
 * not finish under the document's own id ("Error loading document <id> from storage"), so a trap logged there names that
 * document too. A trap met anywhere else (the ledger's write) names none, and says so with null.
 *
 * NO RESTART LOOP. A restart may re-trap while it loads the same documents (CatColab #1461), so the watch itself never
 * restarts anything. The vessel's entry answers the fall (`engine-fall`): it flushes what it can and exits once, so the
 * supervisor raises a fresh process with a fresh engine; a second fall inside the house's restart count keeps it down.
 *
 * WHAT IT DOES NOT SEE (the residual, named): the daemon island runs as a `worker_threads` Worker with its own isolate and
 * so its own wasm engine (`open-daemon-vm.ts`), and INGEST executes there. This watch reads the MAIN isolate's engine only.
 * Its FIRST SYMPTOM: health keeps answering 200 when the worker's engine dies, since the main engine still stands. A worker
 * engine that dies writes no outcome; the main side then reads every wait it holds as `committed` through the receipt, by
 * id, and never as done. Carrying the worker's fall here needs a new island-protocol message (the worker taps
 * its own Repo logger and posts the fall); that rides with the bulkhead rung, which moves the engine into a supervised
 * process anyway.
 */

import { ingestWaveRefusal } from "@lararium/mesh/ingest-wave-budget";

/** The refusal every write verb answers once the engine has fallen. */
export const ENGINE_TERMINATED = "engine-terminated";

/** The three signatures of a dead engine. */
export type EngineFatalCause = "module-terminated" | "wasm-unreachable" | "unsafe-aliasing";
/** Which path met the fall first: the Repo's own logged error (the network path), or the receipt ledger's write. */
export type EnginePath = "repo" | "ledger";

/** The last write that settled durably before the fall: its document heads and when it landed. */
export interface EngineSettled {
  readonly at: string;
  readonly heads: readonly string[];
}

/** The fall, as every caller reads it. */
export interface EngineFall {
  readonly cause: EngineFatalCause;
  readonly path: EnginePath;
  /** When the watch heard the first trap (ISO, wall clock: a display for the operator, never a decision). */
  readonly since: string;
  /** The first trap's own first line, for the log. */
  readonly detail: string;
  readonly lastSettled: EngineSettled | null;
  /** The document the Repo was handling when the trap struck (`tapInboundDocs`), or null where the watch cannot know it. */
  readonly inFlight: string | null;
}

export interface EngineWatch {
  /** The fall, or null while the engine stands. */
  fallen(): EngineFall | null;
  /** Read one error met on `path`; true where it carries a fatal signature (the first one sets the fall). */
  note(error: unknown, path: EnginePath): boolean;
  /** A write settled durably with these heads; ignored after the fall. */
  settled(heads: readonly string[]): void;
  /** Hear the fall once, when it happens. */
  onFall(listener: (fall: EngineFall) => void): () => void;
  /** Run `work` with `documentId` named as the document in flight: a fall it meets carries that id as `inFlight`. */
  carrying<T>(documentId: string, work: () => T): T;
}

/** THE ISOLATE'S OWN WATCH: one engine per isolate, so one watch, read by health, the verb socket and the vessel's own
 *  island asks (`askIslandVerb`). A suite stands its own with `createEngineWatch`. */
export const ISOLATE_ENGINE: EngineWatch = {
  fallen: () => isolate().fallen(), note: (e, p) => isolate().note(e, p), settled: (h) => isolate().settled(h), onFall: (l) => isolate().onFall(l),
  carrying: (d, w) => isolate().carrying(d, w),
};
let isolateWatch: EngineWatch | null = null;
function isolate(): EngineWatch { return (isolateWatch ??= createEngineWatch()); }

/** The one hand act a fall names. */
export const ENGINE_HAND_ACT =
  "restart the vessel once (`lares vessel stop`, then `lares vessel stand`); if its load traps again, stop: `lares vessel read` "
  + "names the resting falls and held ids with the engine down; preserve the hearth (copy it aside), then repair "
  + "(`lares vessel read vessel` probes, `lares vessel lay --apply --yes` lays a torn document again) or restore from the keep onto a new house (founding runbook 11a: "
  + "`lares up --workspace house-backup=<keep checkout>`, then `lares import /lar/workspaces/house-backup/house --apply` per face)";

const MODULE_TERMINATED = /\bModule terminated\b/;
const UNSAFE_ALIASING = /recursive use of an object detected which would lead to unsafe aliasing/;

function oneCause(error: Error): EngineFatalCause | null {
  const text = `${error.message}`;
  if (MODULE_TERMINATED.test(text)) return "module-terminated";
  if (UNSAFE_ALIASING.test(text)) return "unsafe-aliasing";
  // A wasm trap raises WebAssembly.RuntimeError; a plain Error that happens to say "unreachable" (a network fault) does not.
  const isTrap = (typeof WebAssembly !== "undefined" && error instanceof WebAssembly.RuntimeError) || error.name === "RuntimeError";
  if (isTrap && /\bunreachable\b/.test(text)) return "wasm-unreachable";
  return null;
}

/** The fatal signature an error carries, read through its `cause` chain; null for an ordinary fault or a non-error. */
export function engineFatalCauseOf(error: unknown): EngineFatalCause | null {
  let at: unknown = error;
  for (let depth = 0; depth < 8 && at instanceof Error; depth++) {
    const cause = oneCause(at);
    if (cause !== null) return cause;
    at = at.cause;
  }
  return null;
}

/** A fresh watch. `clock` stamps the fall and each settled wave for display; no decision reads it. */
export function createEngineWatch(clock: () => Date = () => new Date()): EngineWatch {
  let fall: EngineFall | null = null;
  let lastSettled: EngineSettled | null = null;
  let inFlight: string | null = null;
  const listeners = new Set<(fall: EngineFall) => void>();
  return {
    fallen: () => fall,
    note: (error, path) => {
      const cause = engineFatalCauseOf(error);
      if (cause === null) return false;
      if (fall !== null) return true;
      const detail = error instanceof Error ? error.message.split("\n")[0]! : String(error);
      fall = { cause, path, since: clock().toISOString(), detail, lastSettled, inFlight };
      for (const listener of listeners) {
        try { listener(fall); } catch { /* a listener's fault never hides the fall */ }
      }
      return true;
    },
    settled: (heads) => {
      if (fall !== null) return;
      lastSettled = { at: clock().toISOString(), heads: [...heads] };
    },
    onFall: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    carrying: (documentId, work) => {
      const outer = inFlight;
      inFlight = documentId;
      try { return work(); } finally { inFlight = outer; }
    },
  };
}

/**
 * NAME THE DOCUMENT IN FLIGHT on every inbound message: wrap the Repo's network subsystem `emit`, so each `message` it hands
 * the Repo runs inside `watch.carrying(documentId)`. The Repo catches a handler's throw and logs it (`tapRepoLogs`) inside
 * that same synchronous emit, so a trap read there names the message's document. A message naming a HELD document (one a
 * resting fall names in flight, `engine-fall`) never reaches the Repo: a peer's sync would hand the engine its changes as
 * surely as the storage would. Every other event passes untouched. Idempotent per emitter. Answers the emitter.
 */
export function tapInboundDocs<T extends object>(
  emitter: T, watch: EngineWatch = ISOLATE_ENGINE, held: readonly string[] = [],
  log: (line: string) => void = (line) => console.warn(`[lararium] ${line}`),
): T {
  if (TAPPED.has(emitter)) return emitter;
  TAPPED.add(emitter);
  const holds = new Set(held);
  const named = new Set<string>();
  const target = emitter as unknown as { emit: (event: string, ...args: unknown[]) => boolean };
  const emit = target.emit.bind(emitter);
  target.emit = (event: string, ...args: unknown[]): boolean => {
    const documentId = event === "message" ? (args[0] as { documentId?: unknown } | undefined)?.documentId : undefined;
    if (typeof documentId === "string" && holds.has(documentId)) {
      // A peer that ASKS hears the document unavailable at once, by name, never a silence it must wait out.
      const asked = args[0] as { type?: unknown; senderId?: unknown };
      const send = (emitter as { send?: (message: unknown) => void }).send;
      if (asked.type === "request" && typeof asked.senderId === "string" && typeof send === "function") {
        send.call(emitter, { type: "doc-unavailable", documentId, targetId: asked.senderId });
      }
      if (!named.has(documentId)) { named.add(documentId); log(`engine fall: ${documentId} held back from inbound sync (a resting fall names it in flight): none of it reaches the engine, and a peer that asks hears it unavailable`); }
      return false;
    }
    return typeof documentId === "string" && documentId !== ""
      ? watch.carrying(documentId, () => emit(event, ...args))
      : emit(event, ...args);
  };
  return emitter;
}
const TAPPED = new WeakSet<object>();

/** What a caller hears from a fallen engine: the code, the cause, the last settled wave and the hand act. */
export function engineTerminatedRefusal(fall: EngineFall): { readonly message: string; readonly refusal: typeof ENGINE_TERMINATED } {
  const settled = fall.lastSettled
    ? `the last settled write landed at ${fall.lastSettled.at} (heads ${fall.lastSettled.heads.map((h) => h.slice(0, 12)).join(", ") || "none"})`
    : "no write settled in this boot before it";
  return {
    refusal: ENGINE_TERMINATED,
    message: `${ENGINE_TERMINATED}: this vessel's Automerge engine stopped (${fall.cause}, met on the ${fall.path} path at ${fall.since}); `
      + `${settled}; nothing ran. Hand act: ${ENGINE_HAND_ACT}.`,
  };
}

/** The answer health gives for a fall (`readiness-face`). */
export function engineFallBody(fall: EngineFall): Record<string, unknown> {
  return { status: ENGINE_TERMINATED, cause: fall.cause, path: fall.path, since: fall.since, lastSettled: fall.lastSettled, inFlight: fall.inFlight, hand: ENGINE_HAND_ACT };
}

/** The logger shape automerge-repo's `setLoggerFactory` takes. */
export interface RepoLogger {
  debug(message: unknown, ...args: unknown[]): void;
  info(message: unknown, ...args: unknown[]): void;
  warn(message: unknown, ...args: unknown[]): void;
  error(message: unknown, ...args: unknown[]): void;
}

/**
 * A logger factory for automerge-repo (`setLoggerFactory`) that prints as the stock one does and hands every logged
 * error's arguments to the watch: the Repo catches an inbound message's throw and logs it ("error handling inbound
 * message"), so its logger offers the one place the network path's trap surfaces. `.debug` stays silent here, as the stock
 * factory leaves it to `DEBUG=automerge-repo:*`.
 */
/** The storage source's own line for a load or save it could not finish, naming the document. */
const STORAGE_DOC = /^Error (?:loading|saving) document (\S+) (?:from|to) storage\b/;

export function tapRepoLogs(watch: EngineWatch, print: (...args: unknown[]) => void = (...a) => console.error(...a)): (namespace: string) => RepoLogger {
  return (namespace) => {
    const prefix = `[${namespace}]`;
    return {
      debug: () => {},
      info: (message, ...args) => console.info(prefix, message, ...args),
      warn: (message, ...args) => console.warn(prefix, message, ...args),
      error: (message, ...args) => {
        const named = typeof message === "string" ? STORAGE_DOC.exec(message)?.[1] : undefined;
        const noteAll = (): void => { for (const arg of [message, ...args]) watch.note(arg, "repo"); };
        if (named !== undefined) watch.carrying(named, noteAll); else noteAll();
        print(prefix, message, ...args);
      },
    };
  };
}

/**
 * THE GATE EVERY ISLAND ASK MEETS, whichever road it rides (the verb socket, `askIslandVerb`, a wiki island's ask): a fallen
 * engine refuses `engine-terminated`, and an INGEST past one document's wave budget refuses `ingest-wave-over-budget`, each
 * before anything places. Null where the ask may go.
 */
export function islandAskRefusal(verb: string, args: unknown, engine: EngineWatch = ISOLATE_ENGINE): { readonly message: string; readonly refusal: string } | null {
  const fall = engine.fallen();
  if (fall) return engineTerminatedRefusal(fall);
  const overweight = ingestWaveRefusal(verb, args);
  return overweight ? { message: overweight.message, refusal: overweight.reason } : null;
}
