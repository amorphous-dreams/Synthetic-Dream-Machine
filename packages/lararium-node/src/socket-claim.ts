/**
 * socket-claim — the house's one OS-native primitive for "exactly one holder on a name, with no
 * lockfile and no pid file standing beside it."
 *
 * Extracted from `owned-store.ts`'s `claimStore`/`bindClaim` (where the doctrine is spelled out at
 * length) so every exclusive-holder-by-name claim in this house rides ONE implementation instead of
 * a parallel re-derivation — `owned-store.ts`'s own rendezvous socket, and `reality-tunnel/lock.ts`'s
 * settings.json write-lock (which carried a hand-rolled pid-file lock with a pid-reuse hole and a
 * pid-namespace hole — see M6) among them.
 *
 * THE RENDEZVOUS NAME IS THE CLAIM. A holder binds a private staging socket, then hard-links that
 * socket onto the claimed name (`link` refuses a name that already stands). A second claimant finds
 * the name answering and refuses by name; a name that stands but nobody answers reads as a corpse,
 * and exactly one claimant reaps it (grave-by-inode, dead-holder evidence over a bounded patience,
 * never a bare timeout). No pid is ever read: the kernel's own listener state decides live vs dead,
 * so neither pid reuse nor a pid namespace split (a container, the WSL/Windows share) can lie.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/socket-claim
 */

import { createConnection, createServer, type Server, type Socket } from "node:net";
import { chmodSync, closeSync, existsSync, linkSync, lstatSync, mkdirSync, openSync, unlinkSync, type Stats } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

/** A claim on `path` that another holder answers for. The claim opened nothing and wrote nothing. */
export class NameHeld extends Error {}

/** A claim that met another claimant reaping a dead holder's name. Refusing is always safe. */
export class NameReaping extends NameHeld {}

/** A name that cannot fit `sun_path` and has no anchor to shorten it. Never truncated, never a pid file. */
export class NameTooLong extends Error {}

/** Bytes of `sun_path` a claim's own path may use: 107 usable, less the staging suffix `.<pid>.<8 hex>.<uid>` bindName appends. */
const CLAIM_PATH_BUDGET = 107 - 24;

/**
 * Name `name` under `dir` through an open descriptor on `dir` — `/proc/self/fd/<fd>/<name>` — so a claim under
 * a deep directory fits `sun_path` (108 bytes): `listen`, `link` and `connect` all work through that spelling.
 * The descriptor stays open until `release()`; release the claim FIRST, then the anchor. Where `/proc/self/fd`
 * does not stand, the absolute path serves while it fits; past the budget this throws {@link NameTooLong}.
 */
export function anchoredName(dir: string, name: string): { path: string; release(): void } {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  let fd = -1;
  try { fd = openSync(dir, "r"); } catch { /* no anchor; the absolute path decides below */ }
  if (fd >= 0) {
    const via = `/proc/self/fd/${fd}`;
    if (existsSync(via)) {
      let closed = false;
      return { path: `${via}/${name}`, release() { if (!closed) { closed = true; try { closeSync(fd); } catch { /* gone */ } } } };
    }
    try { closeSync(fd); } catch { /* gone */ }
  }
  const abs = join(dir, name);
  if (Buffer.byteLength(abs) > CLAIM_PATH_BUDGET) {
    throw new NameTooLong(`${abs} is ${Buffer.byteLength(abs)} bytes; a socket name past ${CLAIM_PATH_BUDGET} cannot bind here and /proc/self/fd does not stand to shorten it`);
  }
  return { path: abs, release() { /* nothing opened */ } };
}

/** A held claim on a name. */
export interface ClaimedName {
  readonly path: string;
  /** The listening server bound at `path`. Attach connection handling before or after claiming;
   *  `onConnection` (if passed to {@link claimName}) is already wired by the time this resolves. */
  readonly server: Server;
  /** Free the name for the next holder: unlink it only while it still carries this holder's own
   *  inode, then close the server. Safe to call more than once (idempotent). */
  readonly release: () => Promise<void>;
}

/**
 * What a claimant says when it meets ANOTHER claimant's grave over the corpse it would reap. The grave's path
 * rides each word, so a hearer names what stands on disk.
 *   · `waits`: the grave stands taken and nothing answers at the name; this claimant gives the earlier one its
 *     patience.
 *   · `cleared`: the corpse or the grave moved within that patience; the earlier claimant finished, and this
 *     one steps back to claim again.
 *   · `took-over`: the patience ran out with the corpse and the grave unmoved; the earlier claimant reads as
 *     dead, and this one has removed its grave. It reaps next.
 */
export interface ReapWord {
  readonly kind: "waits" | "cleared" | "took-over";
  readonly grave: string;
}

export interface ClaimNameOptions {
  /** Handle each connection reaching this holder. Default: accept and end at once (a pure presence
   *  lock — the use `reality-tunnel/lock.ts`'s settings.json write-lock makes of this primitive). */
  readonly onConnection?: (sock: Socket) => void;
  /** Build the refusal thrown when another holder answers. Default names `path` alone. */
  readonly refuse?: () => NameHeld;
  /** Wait out the current holder rather than refusing: retries once the name goes quiet (the
   *  holder released, or a corpse got reaped), forever. Default false (refuse at once). */
  readonly await?: boolean;
  /** Milliseconds one look waits while a holder still answers, under `await`. Default 50. Pacing only: no look
   *  decides anything by elapsed time. */
  readonly pollMs?: number;
  /** The wait one look takes against a live holder, under `await`. Default: a timer of `pollMs`. A port, so a
   *  test counts looks and reads no clock. */
  readonly pace?: (pollMs: number) => Promise<void>;
  /** Hears each reading this claim takes of another claimant's grave ({@link ReapWord}). A hearer that throws
   *  changes nothing of the claim. */
  readonly onReap?: (word: ReapWord) => void;
}

const uidOf = (): number => process.getuid?.() ?? 0;

/** How many looks a waiting claim gives a reap in flight before it names the grave a dead reaper left. */
const REAP_PATIENCE = 200;

/**
 * Whether something answers at `path`. Only a refused or absent socket reads as no answer — a
 * corpse, never a holder; any other connect fault (a listener's full backlog) reads as a holder,
 * so no claimant reaps a live name.
 */
export function answers(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection(path);
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("error", (err: NodeJS.ErrnoException) => resolve(!(err.code === "ECONNREFUSED" || err.code === "ENOENT")));
  });
}

/** Resolve once the holder at `path` lets go: its release closes the connection, and so does its death. */
export function letGo(path: string): Promise<void> {
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

/** How many stability looks a claimant gives a CONTENDED grave before it reads the earlier claimant as dead. */
const GRAVE_DEAD_PATIENCE = 20;
const GRAVE_DEAD_INTERVAL_MS = 25;

/**
 * Reap the corpse `seen` standing at `path`, as the one claimant that reaps that inode. See
 * `owned-store.ts`'s original doctrine comment (carried over verbatim in spirit): the grave's name
 * derives from the corpse's own inode, so every claimant racing this corpse contends for ONE grave
 * name, and only the claimant whose grave still carries that inode unlinks `path`.
 */
async function reapCorpse(path: string, seen: Stats, refuse: () => NameHeld, onReap?: (word: ReapWord) => void): Promise<void> {
  const grave = `${path}.${seen.ino}.reap`;
  const say = (kind: ReapWord["kind"]): void => { try { onReap?.({ kind, grave }); } catch { /* a hearer never moves the claim */ } };
  for (;;) {
    try { linkSync(path, grave); break; }
    catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return;
      if (code !== "EEXIST") throw err;

      if (!sameInode(statOf(path), seen)) return;
      if (await answers(path)) throw refuse();

      say("waits");
      let stranded = true;
      for (let i = 0; i < GRAVE_DEAD_PATIENCE; i++) {
        await new Promise((r) => setTimeout(r, GRAVE_DEAD_INTERVAL_MS));
        if (!sameInode(statOf(path), seen)) { stranded = false; break; }
        if (await answers(path)) throw refuse();
        if (!sameInode(statOf(grave), seen)) { stranded = false; break; }
      }
      if (!stranded) { say("cleared"); return; }

      unlinkIfPresent(grave);
      say("took-over");
    }
  }
  try {
    if (sameInode(statOf(grave), seen) && sameInode(statOf(path), seen)) unlinkIfPresent(path);
  } finally { unlinkIfPresent(grave); }
}

/**
 * Claim `path`: bind it exclusively, or refuse by name when a holder already answers there (or,
 * with `opts.await`, wait out that holder and retry). A socket file nobody answers at reads as a
 * corpse, and exactly one racing claimant replaces it.
 */
export async function claimName(path: string, opts: ClaimNameOptions = {}): Promise<ClaimedName> {
  const refuse = opts.refuse ?? (() => new NameHeld(`${path} already has a holder answering — nothing claimed`));
  const pollMs = opts.pollMs ?? 50;
  const pace = opts.pace ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let reaping = 0;
  for (;;) {
    try { return await bindName(path, opts, refuse); }
    catch (err) {
      if (!(err instanceof NameHeld) || !opts.await) throw err;
      if (!(await answers(path))) {
        if (err instanceof NameReaping && ++reaping > REAP_PATIENCE) throw err;
        await new Promise((r) => setTimeout(r, 5));
        continue;
      }
      reaping = 0;
      // ONE WAIT PER LOOK. A holder hangs up on every caller at once, so a closed connection alone says nothing:
      // a look that returned on the hang-up would bind, link and connect again at the kernel's own speed for as
      // long as the holder worked. The look ends early only when the name stopped answering.
      const paced = pace(pollMs);
      await Promise.race([letGo(path), paced]);
      if (await answers(path)) await paced;
    }
  }
}

async function bindName(path: string, opts: ClaimNameOptions, refuse: () => NameHeld): Promise<ClaimedName> {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const server = createServer(opts.onConnection ?? ((sock) => { try { sock.end(); } catch { /* gone */ } }));
  const open = new Set<Socket>();
  server.on("connection", (sock) => { open.add(sock); sock.on("close", () => open.delete(sock)); });

  const staging = `${path}.${process.pid}.${randomUUID().slice(0, 8)}.${uidOf()}`;
  await listen(server, staging);
  const close = (): Promise<void> => new Promise((resolve) => {
    for (const sock of open) sock.destroy();
    server.close(() => resolve());
  });
  let own: Stats | null;
  try {
    try { chmodSync(staging, 0o600); } catch { /* best-effort */ }
    own = statOf(staging);
    for (;;) {
      try { linkSync(staging, path); break; }
      catch (err) { if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err; }
      const seen = statOf(path);
      if (seen === null) continue;
      if (await answers(path)) throw refuse();
      await reapCorpse(path, seen, refuse, opts.onReap);
    }
  } catch (err) {
    await close();
    throw err;
  } finally {
    unlinkIfPresent(staging);
  }

  const dropIfOurs = (): void => {
    try { if (sameInode(statOf(path), own)) unlinkSync(path); } catch { /* gone already */ }
  };
  process.once("exit", dropIfOurs);
  let released: Promise<void> | null = null;
  return {
    path,
    server,
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
