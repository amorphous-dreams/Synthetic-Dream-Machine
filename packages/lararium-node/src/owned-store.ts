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

import { createConnection, createServer, type Server, type Socket } from "node:net";
import { chmodSync, linkSync, lstatSync, mkdirSync, unlinkSync, type Stats } from "node:fs";
import { randomUUID } from "node:crypto";
import { Repo } from "@automerge/automerge-repo";
import { rendezvousDir, rendezvousPath } from "@lararium/mesh/rendezvous-path";

import { DurableNodeFSStorageAdapter } from "./durable-storage-adapter.js";

/** The key under which a store keeps its own id — the one write a Repo makes on opening a fresh store. */
const STORE_ID_KEY = "storage-adapter-id";

/** A claim on a store that another holder answers for. The claim opened nothing and wrote nothing. */
export class StoreHeld extends Error {}

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
   * vessel's claim holds each caller that arrived before, and hands it over here with its invocation unread —
   * EXCEPT a parked caller whose own deadline has already passed, which is refused by name instead of replayed;
   * `onDrop`, when given, hears that refusal's message once per dropped caller.
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

/**
 * Whether something answers at `path`. Only a refused or absent socket reads as no answer — a corpse, never a
 * holder; any other connect fault (a listener's full backlog) reads as a holder, so no claimant reaps a live name.
 */
function answers(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection(path);
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("error", (err: NodeJS.ErrnoException) => resolve(!(err.code === "ECONNREFUSED" || err.code === "ENOENT")));
  });
}

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

/** Resolve once the holder at `path` lets go: its release closes the connection, and so does its death. */
function letGo(path: string): Promise<void> {
  return new Promise((resolve) => {
    const sock = createConnection(path);
    sock.once("error", () => resolve());
    sock.once("close", () => resolve());
  });
}

function listen(server: Server, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error): void => { server.off("listening", onListening); reject(err); };
    const onListening = (): void => { server.off("error", onError); resolve(); };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(path);
  });
}

const statOf = (path: string): Stats | null => {
  try { return lstatSync(path); } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
};
const sameInode = (a: Stats | null, b: Stats | null): boolean => a !== null && b !== null && a.ino === b.ino && a.dev === b.dev;
const unlinkIfPresent = (path: string): void => {
  try { unlinkSync(path); } catch (err) { if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err; }
};

/** How many stability looks a claimant gives a CONTENDED grave before it reads the earlier claimant as dead —
 *  gathering the DEAD-HOLDER EVIDENCE a takeover needs, never a bare timeout. */
const GRAVE_DEAD_PATIENCE = 20;
const GRAVE_DEAD_INTERVAL_MS = 25;

/**
 * Reap the corpse `seen` standing at `path`, as the one claimant that reaps that inode. The grave's name derives
 * from the corpse's inode, so every claimant that judged THIS corpse races for one grave name and `link` hands it
 * to exactly one. Only that claimant, and only when its grave carries the corpse's own inode, unlinks `path`: no
 * other hand removes a name that carries that inode, so the unlink removes the corpse and nothing else.
 *
 * A GRAVE ANOTHER CLAIMANT ALREADY HOLDS REFUSES — UNTIL INODE AND DEAD-HOLDER EVIDENCE PROVE A TAKEOVER SAFE.
 * `link` hands the grave name to exactly one claimant; meeting it already taken could mean a live reaper mid-flight
 * (refuse and let the retry re-read), or a reaper that crashed between its own `link` and its own `finally` unlink
 * (a stranded grave that would otherwise block every future claim on this corpse forever — the one failure mode a
 * lock that outlives its holder always risks). The inode evidence is immediate: if `path` no longer names `seen`'s
 * inode, this grave blocks nothing anymore, whoever holds it. The dead-holder evidence takes a bounded patience: only
 * after `path` keeps naming the SAME unanswering inode, and the grave keeps standing, for the WHOLE window, does
 * this claimant conclude nobody is finishing that reap — and only then does it clear the stale grave and retry.
 */
async function reapCorpse(path: string, seen: Stats, refuse: () => StoreHeld): Promise<void> {
  const grave = `${path}.${seen.ino}.reap`;
  for (;;) {
    try { linkSync(path, grave); break; }
    catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return;                       // the corpse went already; look again
      if (code !== "EEXIST") throw err;

      // INODE EVIDENCE, FIRST: has `path` moved on from the corpse this grave names? Then the grave, whoever
      // holds it, blocks nothing here — step back to the outer retry, which re-reads `path`'s CURRENT state.
      if (!sameInode(statOf(path), seen)) return;
      if (await answers(path)) throw refuse();              // a live holder bound it while this claimant looked

      // DEAD-HOLDER EVIDENCE: watch the SAME contended grave across a bounded patience window. Any sign of
      // progress — the inode moves on, the name starts answering, or the grave itself clears — means another
      // hand is live and finishing; step back rather than race it.
      let stranded = true;
      for (let i = 0; i < GRAVE_DEAD_PATIENCE; i++) {
        await new Promise((r) => setTimeout(r, GRAVE_DEAD_INTERVAL_MS));
        if (!sameInode(statOf(path), seen)) { stranded = false; break; }
        if (await answers(path)) throw refuse();
        if (!sameInode(statOf(grave), seen)) { stranded = false; break; }   // the earlier claimant finished and left
      }
      if (!stranded) return;                                 // let the outer retry re-read the current state

      // The window closed with the SAME unanswering corpse and the SAME untouched grave throughout — the
      // claimant that made it is gone. The grave already names this exact corpse's inode; clearing it and
      // retrying `link` is this claimant taking the abandoned reap over, never a different corpse's grave.
      unlinkIfPresent(grave);
    }
  }
  try {
    // BOTH NAMES, RIGHT BEFORE THE UNLINK. The grave's own inode proves THIS claimant still owns the reap; the
    // RENDEZVOUS NAME's inode proves the corpse this reap targeted still stands there. Between this claimant's
    // last look and this instant, a fresh holder could have bound `path` afresh (claiming a name a stale corpse
    // just vacated) — checking the grave alone would then unlink that LIVE successor's name, never the corpse
    // this reap was ever about.
    if (sameInode(statOf(grave), seen) && sameInode(statOf(path), seen)) unlinkIfPresent(path);
  } finally { unlinkIfPresent(grave); }
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
  mkdirSync(rendezvousDir(uid()), { recursive: true, mode: 0o700 });
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
  // A PARKED CALLER CARRIES ITS OWN DEADLINE, and a dropped deadline is NEVER a quiet thing. The caller's first
  // line names its own absolute `deadlineAt` (same-host epoch ms, `local-connector.ts`'s `invokeLocal`) — never
  // this read's own clock, which would stamp a fresh deadline no matter how long the line sat unread before this
  // vessel even opened a channel to read it. A line with no `deadlineAt` (an older caller, or this door's own
  // `{holder:"?"}` probe) falls back to this read's own clock plus `timeoutMs`/the default, exactly as before. A
  // park that replayed a line past its deadline would run a verb the caller's own process already gave up on —
  // a ghost write the operator has no way to know ran. So `handOver` checks EVERY parked line's deadline before
  // ever replaying one: past it, the line is refused by name instead. The socket's own `close` is read too — now
  // that it actually fires on a hang-up — and drops the line the instant it does, with no need to wait out the
  // deadline at all.
  const DEFAULT_PARK_DEADLINE_MS = 30_000;
  interface ParkedLine {
    readonly verb: string;
    readonly deadline: number;
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
      let parsed: { holder?: unknown; verb?: unknown; timeoutMs?: unknown; deadlineAt?: unknown } = {};
      try { parsed = JSON.parse(buf.subarray(0, nl).toString("utf8")) as typeof parsed; } catch { /* a non-JSON line reads as a verb line with no budget named */ }
      if (parsed.holder === "?") {
        sock.off("data", onData);
        try { sock.end(heldBy(`a vessel (pid ${process.pid}) holds the store at ${storageDir}`)); } catch { /* gone */ }
        return;
      }
      const askedMs = typeof parsed.timeoutMs === "number" && parsed.timeoutMs > 0 ? parsed.timeoutMs : DEFAULT_PARK_DEADLINE_MS;
      const deadline = typeof parsed.deadlineAt === "number" && parsed.deadlineAt > 0 ? parsed.deadlineAt : Date.now() + askedMs;
      parked.set(sock, {
        verb: typeof parsed.verb === "string" ? parsed.verb : "?",
        deadline,
        take: () => { sock.off("data", onData); return buf; },
      });
    };
    sock.on("data", onData);
    sock.on("close", () => { sock.off("data", onData); parked.delete(sock); });
  };
  let onConnection: (sock: Socket) => void = holder === "direct"
    ? answerHeld(`the store at ${storageDir} stays held by a direct lares command (pid ${process.pid}) for one act — run again when it ends`)
    : park;
  const handOver = (next: (sock: Socket) => void, onDrop?: (why: string) => void): void => {
    onConnection = next;
    for (const [sock, line] of parked) {
      parked.delete(sock);
      if (Date.now() >= line.deadline) {
        const why = `the store at ${storageDir} dropped a parked "${line.verb}" invocation — its own deadline passed while this vessel still had no verb channel open, so the caller gave up before it could ever run; refusing it now rather than running it unannounced`;
        try { sock.end(heldBy(why)); } catch { /* the caller is already gone — exactly the case this guards */ }
        onDrop?.(why);
        continue;
      }
      const read = line.take();
      if (read.length > 0) sock.unshift(read);
      next(sock);
      sock.resume();
    }
  };
  const open = new Set<Socket>();
  const server = createServer((sock) => {
    open.add(sock);
    sock.on("close", () => open.delete(sock));
    sock.on("error", () => { /* a caller that left mid-answer owes nothing */ });
    onConnection(sock);
  });

  // The staging name stays private to this holder; the kernel's unlink at close lands here, never on the rendezvous.
  const staging = `${socketPath}.${process.pid}.${randomUUID().slice(0, 8)}`;
  await listen(server, staging);
  const close = (): Promise<void> => new Promise((resolve) => {
    for (const sock of open) sock.destroy();
    server.close(() => resolve());
  });
  let own: Stats | null;
  try {
    try { chmodSync(staging, 0o600); } catch { /* the 0700 rendezvous dir already gates presence */ }
    own = statOf(staging);
    for (;;) {
      try { linkSync(staging, socketPath); break; }
      catch (err) { if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err; }
      const seen = statOf(socketPath);
      if (seen === null) continue;                       // the name went between the link and the look
      if (await answers(socketPath)) throw refuse();
      await reapCorpse(socketPath, seen, refuse);
    }
  } catch (err) {
    await close();
    throw err;
  } finally {
    unlinkIfPresent(staging);
  }

  // DROP ONLY WHAT IS STILL OURS. The release, and a process that exits without one, unlink the name only while
  // it carries this holder's inode. While this holder listens no other hand removes that name, so the check holds.
  const dropIfOurs = (): void => {
    try { if (sameInode(statOf(socketPath), own)) unlinkSync(socketPath); } catch { /* gone already */ }
  };
  process.once("exit", dropIfOurs);
  let released: Promise<void> | null = null;
  return {
    socketPath,
    holder,
    serve: handOver,
    refuse: (why) => { handOver(answerHeld(why)); },
    release: () => {
      released ??= (async () => {
        process.off("exit", dropIfOurs);
        dropIfOurs();
        await close();
      })();
      return released;
    },
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
