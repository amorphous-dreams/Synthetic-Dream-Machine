/**
 * owned-store — the one claim on a vessel's store, and the one opener outside the standing vessel.
 *
 * ONE STORE, ONE HOLDER, AT EVERY INSTANT. A standing vessel holds its store: the Repo its peers sync. A
 * command that wants the store while a vessel stands routes its verb through that vessel (`store-door`); with
 * no vessel standing, the command opens the store HERE, for the moment of its act, and no second opener may
 * stand beside it. A second Repo beside a holder writes bytes the holder's replica never sees and races the
 * holder's own saves.
 *
 * THE RENDEZVOUS NAME IS THE CLAIM. A vessel answers its operator's commands at one socket derived from its
 * store (`rendezvousPath`). Every holder binds that same name — the vessel BEFORE it opens its Repo, and holds it
 * as its verb socket for its whole life; the direct holder for its act's moment — so the claim and the door share
 * one address: whoever binds it holds the store. A second claimant finds the name answering and refuses by name;
 * a command routing toward the store reaches whichever holder stands and hears which holder it met. No lockfile
 * and no pid file stand beside the name — a lock that outlives its holder repeats the fault of a pointer that
 * outlives its document, while a socket nobody answers reads as a corpse.
 *
 * THE BIND IS EXCLUSIVE, AND NOTHING UNLINKS A NAME THAT ANSWERS.
 *   · A holder listens on a private staging name, then hard-links that socket onto the rendezvous name. `link`
 *     refuses a name that stands, so two claimants never both take it, and the kernel's own unlink of a closed
 *     listener's path lands on the staging name, never on the rendezvous name another holder may since hold.
 *   · A name that stands and answers refuses the claim. A name that stands and answers nobody is a corpse, and
 *     exactly one claimant reaps it: the reaper links the corpse's inode onto a grave named by that inode, and only
 *     the claimant whose grave link names the corpse's own inode unlinks the rendezvous name. A claimant that finds
 *     the grave already taken refuses, so two claimants reaping one corpse never both bind.
 *   · A release unlinks the rendezvous name only while that name still carries this holder's own inode.
 *
 * CRASH-ATOMIC WRITES. The holder's Repo persists through `DurableNodeFSStorageAdapter`, the adapter the
 * vessel itself writes through: a save that dies mid-chunk leaves the whole old chunk or the whole new one, and
 * a temp a dead writer strands beside them never reads back as a chunk.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { createConnection, type Socket } from "node:net";
import { randomUUID } from "node:crypto";
import { Repo } from "@automerge/automerge-repo";
import { rendezvousPath } from "@lararium/mesh/rendezvous-path";

import { DurableNodeFSStorageAdapter } from "./durable-storage-adapter.js";
import { claimName, NameHeld, letGo } from "./socket-claim.js";

/** The key under which a store keeps its own id — the one write a Repo makes on opening a fresh store. */
const STORE_ID_KEY = "storage-adapter-id";

/**
 * A claim on a store that another holder answers for. The claim opened nothing and wrote nothing.
 * Rides the house's one socket-claim primitive (M6) — see `socket-claim.ts` for the doctrine.
 */
export class StoreHeld extends NameHeld {}

/** A claim that met another claimant reaping a dead holder's name. Refusing is always safe; the reap ends at once. */
export class StoreReaping extends StoreHeld {}

/** Who holds a store: a standing vessel for its life, or a direct lares command for one act. */
export type StoreHolder = "vessel" | "direct";

export interface ClaimOptions {
  /** Who claims. A vessel answers callers that it holds the store; a direct command, that it holds one act. */
  readonly holder?: StoreHolder;
  /**
   * Wait out a DIRECT holder's act rather than refusing: the claim stands open on that holder's name and claims
   * again the moment the act ends. A standing vessel still refuses the claim. A booting vessel waits this way.
   */
  readonly awaitDirect?: boolean;
  /** Hears each wait on a direct holder, by its answer. */
  readonly onAwait?: (heldBy: string) => void;
}

/** A held claim on a store's rendezvous name. */
export interface StoreClaim {
  readonly socketPath: string;
  /** Who holds. */
  readonly holder: StoreHolder;
  /**
   * Answer every caller that reaches the name from here on (the vessel's verb channel takes its claim over). A
   * vessel's claim holds each caller that arrived before, and hands it over here with its invocation unread — a
   * parked caller's own socket `close` is the only abandonment this vessel trusts, never a wall-clock deadline;
   * a caller still connected at hand-over time is replayed unconditionally, however long the wait ran.
   * `onDrop` is kept for callers that still pass one; nothing causal drops a line here to report through it.
   */
  readonly serve: (onConnection: (sock: Socket) => void, onDrop?: (why: string) => void) => void;
  /** Answer every caller from here on with a refusal naming `why` (a vessel that stops serving verbs). */
  readonly refuse: (why: string) => void;
  /** Free the name for the next holder: unlink it while it still names this holder, then close. */
  readonly release: () => Promise<void>;
}

const uid = (): number => process.getuid?.() ?? 0;

/** How many looks a waiting claim gives a reap in flight before it names the grave a dead reaper left. */
const REAP_PATIENCE = 200;

/** Ask the holder at `path` who it holds as; null when nothing answers or the answer names no holder. */
function heldAs(path: string): Promise<{ holder: StoreHolder | null; message: string } | null> {
  return new Promise((resolve) => {
    const sock = createConnection(path);
    let buf = "";
    sock.setEncoding("utf8");
    sock.once("connect", () => sock.write(JSON.stringify({ holder: "?" }) + "\n"));
    sock.on("data", (c: string) => {
      buf += c;
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      sock.destroy();
      try {
        const line = JSON.parse(buf.slice(0, nl)) as { holder?: unknown; errorMessage?: unknown };
        const holder = line.holder === "direct" || line.holder === "vessel" ? line.holder : null;
        resolve({ holder, message: typeof line.errorMessage === "string" ? line.errorMessage : "" });
      } catch { resolve({ holder: null, message: "" }); }
    });
    sock.once("error", () => resolve(null));
    sock.once("close", () => resolve(null));
  });
}

/**
 * Claim the store at `storageDir`: bind its rendezvous name, or refuse by name when a holder answers there. A
 * socket file nobody answers at reads as a corpse, and exactly one racing claimant replaces it.
 */
export async function claimStore(storageDir: string, opts: ClaimOptions = {}): Promise<StoreClaim> {
  const holder = opts.holder ?? "direct";
  const refuse = (): StoreHeld => new StoreHeld(
    `the store at ${storageDir} already has a holder answering at ${rendezvousPath({ root: storageDir, uid: uid() })} — a standing vessel, or another lares command mid-act; nothing opened`,
  );
  // A reap another claimant holds ends within its own two unlinks; one that never ends names a reaper that died
  // between them, and the claim refuses naming its grave rather than waiting on a hand that is gone.
  let reaping = 0;
  for (;;) {
    try { return await bindClaim(storageDir, holder, refuse); }
    catch (err) {
      if (!(err instanceof StoreHeld) || !opts.awaitDirect) throw err;
      const socketPath = rendezvousPath({ root: storageDir, uid: uid() });
      const met = await heldAs(socketPath);
      if (met === null) {
        // Nothing answers: the holder let go this instant, or a claimant reaps a dead holder's name.
        if (err instanceof StoreReaping && ++reaping > REAP_PATIENCE) throw err;
        await new Promise((r) => setTimeout(r, 5));
        continue;
      }
      if (met.holder !== "direct") throw err;
      reaping = 0;
      opts.onAwait?.(met.message);
      await letGo(socketPath);
    }
  }
}

async function bindClaim(storageDir: string, holder: StoreHolder, refuse: () => StoreHeld): Promise<StoreClaim> {
  const socketPath = rendezvousPath({ root: storageDir, uid: uid() });
  const heldBy = (why: string): string => JSON.stringify({ status: "error", errorMessage: why, holder }) + "\n";
  const answerHeld = (why: string) => (sock: Socket): void => {
    // Every caller that meets this name hears which holder it met, in the outcome shape a vessel answers in.
    sock.setEncoding("utf8");
    sock.on("data", () => { try { sock.end(heldBy(why)); } catch { /* gone */ } });
  };
  // A VESSEL THAT SERVES NO VERB YET HOLDS ITS CALLERS. A caller's invocation waits, unread past its first line, for
  // the verb channel that takes this claim over (`serve`); a claimant asking who holds hears at once.
  //
  // A PARKED CALLER NEVER PAUSES. `pause()` right after the first line, with the whole line `unshift`ed straight
  // back, read as only `["line"]` on a peer that hangs up while parked: the unshifted bytes sit in the readable
  // buffer unconsumed, and a readable stream holding unconsumed bytes never emits `end` — so `close` never fired,
  // `parked.delete` never ran, and the vessel replayed the line on thaw long after the caller gave up and told its
  // own operator "failed" (`pause-eof.mjs` isolates exactly this). So `park` instead keeps consuming every byte
  // that arrives into its OWN buffer — the socket stays exactly as able to notice its own EOF as an unparked one
  // — and only hands that buffer back (via `unshift`, once) at the moment a real verb channel takes the socket
  // over.
  //
  // A PARKED CALLER'S ABANDONMENT IS CAUSAL, NEVER A CLOCK READING. A park once carried the caller's own
  // absolute `deadlineAt` (same-host epoch ms) and dropped a line whose stamp had passed by the TIME this
  // vessel finally opened a channel to read it — a wall-clock comparison across however long the line sat
  // unread, and one either side's own device clock could move. No deadline rides the wire now, and none is
  // read here. The ONLY abandonment signal a park trusts is the socket's own `close`: a caller that hung up
  // while parked drops its line the instant that event fires, no matter how long it sat — causal evidence,
  // not a stamped instant. A caller still connected when `handOver` runs gets its line replayed, however
  // long the wait: a live socket is still a live caller who has not told this vessel otherwise.
  interface ParkedLine {
    readonly verb: string;
    /** Detach this park's own listener and hand back every byte it read, for the real handler to `unshift`. */
    readonly take: () => Buffer;
  }
  const parked = new Map<Socket, ParkedLine>();
  const park = (sock: Socket): void => {
    let buf = Buffer.alloc(0);
    let lineRead = false;
    const onData = (chunk: Buffer): void => {
      buf = Buffer.concat([buf, chunk]);
      if (lineRead) return;                   // the verb line parsed already; later bytes ride along for the real handler
      const nl = buf.indexOf(0x0a);
      if (nl === -1) return;
      lineRead = true;
      let parsed: { holder?: unknown; verb?: unknown } = {};
      try { parsed = JSON.parse(buf.subarray(0, nl).toString("utf8")) as typeof parsed; } catch { /* a non-JSON line reads as a verb line with no verb named */ }
      if (parsed.holder === "?") {
        sock.off("data", onData);
        try { sock.end(heldBy(`a vessel (pid ${process.pid}) holds the store at ${storageDir}`)); } catch { /* gone */ }
        return;
      }
      parked.set(sock, {
        verb: typeof parsed.verb === "string" ? parsed.verb : "?",
        take: () => { sock.off("data", onData); return buf; },
      });
    };
    sock.on("data", onData);
    sock.on("close", () => { sock.off("data", onData); parked.delete(sock); });
  };
  let onConnection: (sock: Socket) => void = holder === "direct"
    ? answerHeld(`the store at ${storageDir} stays held by a direct lares command (pid ${process.pid}) for one act — run again when it ends`)
    : park;
  const handOver = (next: (sock: Socket) => void, _onDrop?: (why: string) => void): void => {
    onConnection = next;
    for (const [sock, line] of parked) {
      parked.delete(sock);
      // A `close` already fired would have removed this entry via the listener above — reaching this line
      // AT ALL is itself the causal evidence the caller is still there. Replay unconditionally.
      const read = line.take();
      if (read.length > 0) sock.unshift(read);
      next(sock);
      sock.resume();
    }
  };
  // The generic socket-claim primitive (M6) carries the bind/link/reap/dropIfOurs mechanics; this
  // holder supplies only its own connection protocol (park/answerHeld/handOver, above) and its own
  // refusal text. `refuse` is store-flavored (StoreHeld), so every `instanceof StoreHeld` check
  // downstream keeps reading true — StoreHeld extends NameHeld.
  const claimed = await claimName(socketPath, {
    onConnection: (sock) => {
      sock.on("error", () => { /* a caller that left mid-answer owes nothing */ });
      onConnection(sock);
    },
    refuse,
  });

  return {
    socketPath,
    holder,
    serve: handOver,
    refuse: (why) => { handOver(answerHeld(why)); },
    release: claimed.release,
  };
}

/**
 * Hold the store at `storageDir` for the length of `act`: claim its name, open the one Repo on the
 * crash-atomic adapter, run the act against it, then shut the Repo (every save flushed) and free the name.
 * A standing vessel or a second direct holder refuses with {@link StoreHeld} before anything opens.
 */
export async function ownedStore<T>(storageDir: string, act: (repo: Repo) => Promise<T>): Promise<T> {
  const claim = await claimStore(storageDir);
  try {
    const storage = new DurableNodeFSStorageAdapter(storageDir);
    // NO WRITE OUTLIVES THE CLAIM. A Repo opening a store with no id mints one and saves it unawaited, so that
    // save could land after the act returns and the name stands free. The holder seats the id first; the Repo then
    // reads it and writes nothing of its own accord.
    if (!(await storage.load([STORE_ID_KEY]))) await storage.save([STORE_ID_KEY], new TextEncoder().encode(randomUUID()));
    const repo = new Repo({ storage });
    let done = false;
    try {
      const out = await act(repo);
      done = true;
      return out;
    } finally {
      // An act that failed keeps its own fault; a shutdown that fails after a clean act surfaces as the fault.
      await repo.shutdown().catch((err: unknown) => { if (done) throw err; });
    }
  } finally {
    await claim.release();
  }
}
