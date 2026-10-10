/**
 * owned-store — the one opener of a vessel's store outside the standing vessel.
 *
 * ONE STORE, ONE HOLDER, AT EVERY INSTANT. A standing vessel holds its store: the Repo its peers sync. A
 * command that wants the store while a vessel stands routes its verb through that vessel (`store-door`); with
 * no vessel standing, the command opens the store HERE, for the moment of its act, and no second opener may
 * stand beside it. A second Repo beside a holder writes bytes the holder's replica never sees and races the
 * holder's own saves.
 *
 * THE RENDEZVOUS NAME IS THE CLAIM. A vessel answers its operator's commands at one socket derived from its
 * store (`rendezvousPath`). The direct holder binds that same name for its moment, so the claim and the door
 * share one address: whoever binds it holds the store. A second claimant finds the name answering and refuses
 * by name; a command routing toward a vessel reaches the direct holder instead and hears which holder it met.
 * No lockfile and no pid file stand beside the name — a lock that outlives its holder repeats the fault of a
 * pointer that outlives its document, while a socket nobody answers reads as a corpse.
 *
 * CRASH-ATOMIC WRITES. The holder's Repo persists through `DurableNodeFSStorageAdapter`, the adapter the
 * vessel itself writes through: a save that dies mid-chunk leaves the whole old chunk or the whole new one,
 * never a torn length-prefix for the next opener's automerge to choke on.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { createConnection, createServer, type Server } from "node:net";
import { chmodSync, mkdirSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Repo } from "@automerge/automerge-repo";
import { rendezvousDir, rendezvousPath } from "@lararium/mesh/rendezvous-path";

import { DurableNodeFSStorageAdapter } from "./durable-storage-adapter.js";

/** The key under which a store keeps its own id — the one write a Repo makes on opening a fresh store. */
const STORE_ID_KEY = "storage-adapter-id";

/** A claim on a store that another holder answers for. The claim opened nothing and wrote nothing. */
export class StoreHeld extends Error {}

/** A held claim on a store's rendezvous name; `release` frees the name for the next holder. */
export interface StoreClaim {
  readonly socketPath: string;
  readonly release: () => Promise<void>;
}

const uid = (): number => process.getuid?.() ?? 0;

/** Whether something answers at `path`. A refused or absent socket reads as no answer — a corpse, never a holder. */
function answers(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection(path);
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("error", () => resolve(false));
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

/**
 * Claim the store at `storageDir` for one act: bind its rendezvous name, or refuse by name when a holder
 * answers there. A socket file nobody answers at reads as a corpse, and the claim replaces it; a name that a racing
 * claimant takes between the two reads refuses.
 */
export async function claimStore(storageDir: string): Promise<StoreClaim> {
  const socketPath = rendezvousPath({ root: storageDir, uid: uid() });
  mkdirSync(rendezvousDir(uid()), { recursive: true, mode: 0o700 });
  const held = `the store at ${storageDir} stays held by a direct lares command (pid ${process.pid}) for one act — run again when it ends`;
  const server = createServer((sock) => {
    // Every caller that meets this name hears which holder it met, in the outcome shape a vessel answers in.
    sock.setEncoding("utf8");
    sock.on("data", () => { try { sock.end(JSON.stringify({ status: "error", errorMessage: held }) + "\n"); } catch { /* gone */ } });
    sock.on("error", () => { /* a caller that left mid-answer owes nothing */ });
  });
  const refuse = (): StoreHeld => new StoreHeld(
    `the store at ${storageDir} already has a holder answering at ${socketPath} — a standing vessel, or another lares command mid-act; nothing opened`,
  );
  try {
    await listen(server, socketPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") throw err;
    if (await answers(socketPath)) throw refuse();
    try { unlinkSync(socketPath); } catch { /* another claimant cleared the corpse first */ }
    try { await listen(server, socketPath); }
    catch (again) {
      if ((again as NodeJS.ErrnoException).code === "EADDRINUSE") throw refuse();
      throw again;
    }
  }
  try { chmodSync(socketPath, 0o600); } catch { /* the 0700 rendezvous dir already gates presence */ }
  return {
    socketPath,
    release: () => new Promise<void>((resolve) => { server.close(() => resolve()); }),
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
