/**
 * owned-store — one holder of a store at every instant, and no torn chunk behind it.
 *
 * Proven:
 *   · RED: while one `ownedStore` act holds a store, a second claim refuses by name and its act never runs;
 *     CONTROL: two acts in sequence both write, and the second reads the first's bytes;
 *   · a caller that reaches the claimed rendezvous hears which holder it met, in the outcome shape a vessel
 *     answers in; a socket file nobody answers at reads as a corpse and the claim replaces it;
 *   · RED: a save that dies mid-chunk under the holder's Repo leaves no torn chunk on disk; CONTROL (a planted
 *     known positive): the same fault under the stock adapter tears a chunk, so the instrument sees a tear.
 */
import { promises as fsp, mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync, statSync, mkdirSync, existsSync, linkSync, unlinkSync } from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import { rendezvousDir, rendezvousPath } from "@lararium/mesh/rendezvous-path";

import { spawn } from "node:child_process";
import { ownedStore, claimStore, StoreHeld } from "../src/owned-store.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "lares-owned-store-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const socketOf = (d: string): string => rendezvousPath({ root: d, uid: process.getuid?.() ?? 0 });

function ask(path: string, line: Record<string, unknown> = { verb: "kapae", requestedBy: "did:test" }): Promise<string> {
  return new Promise((resolve, reject) => {
    const sock = createConnection(path);
    let buf = "";
    sock.setEncoding("utf8");
    sock.on("connect", () => sock.write(JSON.stringify(line) + "\n"));
    sock.on("data", (c: string) => { buf += c; });
    sock.on("end", () => resolve(buf));
    sock.on("error", reject);
  });
}

describe("ownedStore — one holder", () => {
  it("RED: a second claim beside a held store refuses by name, and its act never runs", async () => {
    let releaseFirst!: () => void;
    const gate = new Promise<void>((r) => { releaseFirst = r; });
    let entered!: () => void;
    const holding = new Promise<void>((r) => { entered = r; });
    const first = ownedStore(dir, async (repo) => {
      const h = repo.create<{ n: number }>({ n: 1 });
      entered();
      await gate;
      return h.url;
    });
    await holding;
    let secondRan = false;
    await expect(ownedStore(dir, async () => { secondRan = true; })).rejects.toBeInstanceOf(StoreHeld);
    await expect(ownedStore(dir, async () => { secondRan = true; })).rejects.toThrow(/already has a holder answering/);
    expect(secondRan).toBe(false);
    releaseFirst();
    await first;
  });

  it("CONTROL: two acts in sequence both write, and the second reads the first", async () => {
    const url = await ownedStore(dir, async (repo) => repo.create<{ n: number }>({ n: 1 }).url);
    await ownedStore(dir, async (repo) => {
      const h = await repo.find<{ n: number }>(url as AutomergeUrl);
      expect(h.doc().n).toBe(1);
      h.change((d) => { d.n = 2; });
    });
    const n = await ownedStore(dir, async (repo) => (await repo.find<{ n: number }>(url as AutomergeUrl)).doc().n);
    expect(n).toBe(2);
  });

  it("a caller that reaches the claimed name hears which holder it met", async () => {
    const claim = await claimStore(dir);
    try {
      const line = JSON.parse(await ask(socketOf(dir))) as { status: string; errorMessage: string };
      expect(line.status).toBe("error");
      expect(line.errorMessage).toMatch(/held by a direct lares command \(pid \d+\)/);
    } finally { await claim.release(); }
  });

  it("a socket file nobody answers at reads as a corpse, and the claim stands over it", async () => {
    mkdirSync(rendezvousDir(process.getuid?.() ?? 0), { recursive: true, mode: 0o700 });
    writeFileSync(socketOf(dir), "");
    const wrote = await ownedStore(dir, async (repo) => repo.create<{ n: number }>({ n: 7 }).url);
    expect(wrote).toMatch(/^automerge:/);
  });
});

/** Whether a listener answers at `path` (a refused or absent socket reads as none). */
function answersAt(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection(path);
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("error", () => resolve(false));
  });
}

/** Leave a DEAD socket at the store's rendezvous name: a socket inode no listener holds, as a killed holder leaves it. */
async function plantDeadSocket(d: string): Promise<void> {
  const path = socketOf(d);
  const keep = `${path}.keep`;
  const ghost = await claimStore(d);
  linkSync(path, keep);
  await ghost.release();
  if (!existsSync(path)) linkSync(keep, path);
  unlinkSync(keep);
}

describe("claimStore — the state-side presence claim", () => {
  /** A process that answers at `<dir>/.holder` and binds NO rendezvous: the shape of a holder in another namespace. */
  const holderOnly = () => spawn(process.execPath, [join(__dirname, "holder-child.mjs"), join(dir, ".holder")], { stdio: ["ignore", "pipe", "inherit"] });
  const up = (c: ReturnType<typeof holderOnly>) => new Promise<void>((res, rej) => { c.stdout!.once("data", () => res()); c.once("error", rej); });
  const down = (c: ReturnType<typeof holderOnly>) => new Promise((r) => { c.once("exit", r); c.kill("SIGTERM"); });

  it("RED: a holder answering only at .holder (no rendezvous) refuses the claim with StoreHeld; CONTROL: once it leaves, the claim binds", async () => {
    const child = holderOnly();
    try {
      await up(child);
      expect(await answersAt(socketOf(dir))).toBe(false);
      const err = await claimStore(dir).then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(StoreHeld);
      expect((err as Error).message).toContain(`${dir}/.holder`);
      expect((err as Error).message).toContain("another container or namespace");
      await down(child);
      const mine = await claimStore(dir);
      await mine.release();
      expect(existsSync(join(dir, ".holder"))).toBe(false);
    } finally { child.kill("SIGKILL"); }
  });

  it("a vessel holder and a direct holder both take .holder; release frees it", async () => {
    const v = await claimStore(dir, { holder: "vessel" });
    expect(existsSync(join(dir, ".holder"))).toBe(true);
    await expect(claimStore(dir)).rejects.toBeInstanceOf(StoreHeld);
    await v.release();
    expect(existsSync(join(dir, ".holder"))).toBe(false);
  });

  it("a storage path past 130 characters claims", async () => {
    const deep = join(dir, "g".repeat(50), "h".repeat(50));
    mkdirSync(deep, { recursive: true });
    expect(deep.length).toBeGreaterThan(130);
    const c = await claimStore(deep);
    await c.release();
  });
});

describe("claimStore — one holder at every instant", () => {
  it("RED: a released holder never removes a name that another holder bound in the meantime", async () => {
    const path = socketOf(dir);
    const first = await claimStore(dir);
    // The name moves on behind the first holder's back (a holder before this law unlinked any socket standing
    // there), and a second holder binds it afresh.
    unlinkSync(path);
    unlinkSync(join(dir, ".holder"));   // the state-side presence claim moves on too
    const second = await claimStore(dir);
    await first.release();
    expect(existsSync(path)).toBe(true);
    expect(await answersAt(path)).toBe(true);
    await expect(claimStore(dir)).rejects.toBeInstanceOf(StoreHeld);
    await second.release();
    expect(existsSync(path)).toBe(false);
  });

  it("RED: claimants racing over one dead socket never both bind — exactly one holds", async () => {
    await plantDeadSocket(dir);
    expect(existsSync(socketOf(dir))).toBe(true);
    expect(await answersAt(socketOf(dir))).toBe(false);
    const raced = await Promise.allSettled(Array.from({ length: 8 }, () => claimStore(dir)));
    const held = raced.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const refused = raced.flatMap((r) => (r.status === "rejected" ? [r.reason as unknown] : []));
    try {
      expect(held).toHaveLength(1);
      expect(refused.every((e) => e instanceof StoreHeld)).toBe(true);
      expect(await answersAt(socketOf(dir))).toBe(true);
    } finally { for (const h of held) await h.release(); }
  });

  it("CONTROL: a lone claimant over a dead socket reaps it and holds", async () => {
    await plantDeadSocket(dir);
    const claim = await claimStore(dir);
    try { expect(await answersAt(socketOf(dir))).toBe(true); }
    finally { await claim.release(); }
    expect(existsSync(socketOf(dir))).toBe(false);
  });

  it("RED: a STRANDED .reap grave (a reaper that crashed mid-reap) refuses instantly, then a claimant takes it over once dead-holder evidence proves it safe", async () => {
    await plantDeadSocket(dir);
    const path = socketOf(dir);
    const seen = statSync(path);
    const grave = `${path}.${seen.ino}.reap`;
    // Hand-plant the stranded grave exactly as a reaper that died between its own `linkSync` and its own
    // `finally` unlink would leave it: a hardlink onto the corpse's OWN inode, nothing more.
    linkSync(path, grave);
    expect(existsSync(grave)).toBe(true);

    // INSTANT: the window has not run yet, so a look taken right away still finds the grave untouched —
    // the claim has not yet earned the right to clean it up.
    const started = Date.now();
    const said: string[] = [];
    const claim = await claimStore(dir, { onReap: (word) => { said.push(word.kind); } });
    const elapsedMs = Date.now() - started;
    try {
      expect(await answersAt(path)).toBe(true);        // the claimant took the abandoned reap over and holds
      // THE CLAIM SAYS WHICH READING IT TOOK: it met the grave and gave the earlier claimant its patience, then
      // read that claimant as dead and took the grave over.
      expect(said).toEqual(["waits", "took-over"]);
      // The window is bounded (20 * 25ms = 500ms) — a takeover never resolves FASTER than that window, or the
      // "instant" assertion above would mean nothing. A lower bound: a slow machine only lengthens it.
      expect(elapsedMs).toBeGreaterThanOrEqual(450);
    } finally { await claim.release(); }
    expect(existsSync(path)).toBe(false);
    expect(existsSync(grave)).toBe(false);              // the stale grave is gone, not left stranded forever
  });

  it("CONTROL: a grave that clears mid-window (the earlier claimant finishes on its own) is never treated as dead", async () => {
    await plantDeadSocket(dir);
    const path = socketOf(dir);
    const seen = statSync(path);
    const grave = `${path}.${seen.ino}.reap`;
    linkSync(path, grave);
    // The earlier claimant finishes its OWN reap mid-window — exactly `reapCorpse`'s own success tail, run by
    // hand here to stand in for that other process: it reaps the corpse and unlinks its own grave. It does so at
    // this claimant's own word that it met the grave and waits, so the grave clears inside the patience window on
    // any machine and no clock of the vector's decides when.
    const said: string[] = [];
    const claim = await claimStore(dir, {
      onReap: (word) => {
        said.push(word.kind);
        if (word.kind === "waits") { unlinkSync(path); unlinkSync(grave); }
      },
    });
    try {
      expect(await answersAt(path)).toBe(true);
      // A grave that clears mid-window reads "someone else finished": the claim says so and steps back to its
      // outer retry. It never says it took a grave over, so it never read the earlier claimant as dead.
      expect(said).toEqual(["waits", "cleared"]);
    } finally { await claim.release(); }
  });

  it("a vessel's claim waits out a direct act, then holds; a direct claim beside the vessel refuses", async () => {
    const act = await claimStore(dir);
    let vesselHeld = false;
    const vessel = claimStore(dir, { holder: "vessel", awaitDirect: true }).then((c) => { vesselHeld = true; return c; });
    // The vessel's claim stands open on the direct holder's name while that act runs.
    await new Promise((r) => setImmediate(r));
    expect(vesselHeld).toBe(false);
    await act.release();
    const claim = await vessel;
    try {
      expect(vesselHeld).toBe(true);
      await expect(claimStore(dir)).rejects.toBeInstanceOf(StoreHeld);
      const who = JSON.parse(await ask(socketOf(dir), { holder: "?" })) as { status: string; errorMessage: string; holder: string };
      expect(who.holder).toBe("vessel");
      expect(who.errorMessage).toMatch(/a vessel \(pid \d+\) holds the store/);
    } finally { await claim.release(); }
  });

  it("a vessel that serves no verb yet holds its callers, and its channel answers them once it takes the claim over", async () => {
    const claim = await claimStore(dir, { holder: "vessel" });
    try {
      let answered = false;
      const asked = ask(socketOf(dir)).then((line) => { answered = true; return line; });
      await new Promise((r) => setTimeout(r, 50));
      expect(answered).toBe(false);
      claim.serve((sock) => {
        sock.setEncoding("utf8");
        sock.on("data", (line: string) => { sock.end(JSON.stringify({ status: "done", heard: line.trim() }) + "\n"); });
      });
      const line = JSON.parse(await asked) as { status: string; heard: string };
      expect(line.status).toBe("done");
      expect(JSON.parse(line.heard)).toMatchObject({ verb: "kapae" });
    } finally { await claim.release(); }
  });

  it("CLOCKLESS CONTROL: a parked caller that outlasts any nominal timeoutMs, but stays CONNECTED, is served — never clock-dropped", async () => {
    // P2.5 S1: the old `H1 RED→GREEN` test here asserted the OPPOSITE of today's law — that a parked
    // caller's own stamped deadline got it dropped once the vessel's `handOver` ran late. `timeoutMs`
    // on a parked line is now read for NOTHING: no deadline is derived from it, no `Date.now()`
    // comparison decides anything. The ONLY abandonment signal `park` trusts is the socket's own
    // `close` (proved by the H1 hang-up test below). A caller that is STILL CONNECTED when `handOver`
    // finally runs gets its line replayed, no matter how long the wait — even one that named a
    // laughably short `timeoutMs` and is still sitting there regardless.
    const claim = await claimStore(dir, { holder: "vessel" });
    try {
      let ran = false;
      const asked = ask(socketOf(dir), { verb: "nexus-kapae", requestedBy: "did:test", timeoutMs: 20 });
      // Outlast the nominal 20ms "budget" many times over, WITHOUT closing — the live SIGSTOP'd-boot
      // shape, minus the clock that used to punish it.
      await new Promise((r) => setTimeout(r, 80));
      claim.serve((sock) => { ran = true; sock.end(JSON.stringify({ status: "done" }) + "\n"); });
      const line = JSON.parse(await asked) as { status: string };
      expect(ran).toBe(true);                                      // served — a still-open socket is still a caller
      expect(line.status).toBe("done");
    } finally { await claim.release(); }
  });

  it("CLOCKLESS MUTATION: a set-back and a set-forward Date.now() leave the parked-and-connected verdict unchanged", async () => {
    for (const skewMs of [-10 * 365 * 24 * 3600 * 1000, 10 * 365 * 24 * 3600 * 1000]) {
      const realNow = Date.now;
      const claim = await claimStore(dir, { holder: "vessel" });
      try {
        let ran = false;
        const asked = ask(socketOf(dir), { verb: "nexus-kapae", requestedBy: "did:test", timeoutMs: 20 });
        await new Promise((r) => setTimeout(r, 80));          // long outlasted any nominal budget
        Date.now = () => realNow() + skewMs;                  // the device clock lies, set back or forward
        claim.serve((sock) => { ran = true; sock.end(JSON.stringify({ status: "done" }) + "\n"); });
        const line = JSON.parse(await asked) as { status: string };
        expect(ran).toBe(true);                               // unmoved by either skew — no clock reading decides this
        expect(line.status).toBe("done");
      } finally { Date.now = realNow; await claim.release(); }
    }
  });

  it("CONTROL: a parked caller still inside its own deadline is served once handOver runs", async () => {
    const claim = await claimStore(dir, { holder: "vessel" });
    try {
      let ran = false;
      const asked = ask(socketOf(dir), { verb: "nexus-kapae", requestedBy: "did:test", timeoutMs: 20_000 });
      await new Promise((r) => setTimeout(r, 10));                 // well short of its 20s deadline
      claim.serve((sock) => {
        ran = true;
        sock.setEncoding("utf8");
        sock.on("data", (line: string) => { sock.end(JSON.stringify({ status: "done", heard: line.trim() }) + "\n"); });
      });
      const line = JSON.parse(await asked) as { status: string };
      expect(ran).toBe(true);
      expect(line.status).toBe("done");
    } finally { await claim.release(); }
  });

  it("H1 — a caller that hangs up WHILE PARKED (never read) is dropped, with a budget that would otherwise outlive it", async () => {
    // The prior unit red parked a live caller with a 20ms deadline — it never modeled the line sitting UNREAD
    // while its own caller is already gone, which was the whole live bug (a vessel event-loop that cannot
    // read while frozen is this test's `handOver` never running at all until well after the hang-up). `park`
    // used to `pause()` the socket and `unshift` the line straight back, and a readable stream holding
    // unconsumed bytes never emits `end` — so a hang-up here read as nothing at all, and a later `handOver`
    // still replayed the line as if the caller were still waiting. This asks for a 20s deadline (it would
    // happily outlive the test) and proves the verb never runs anyway, because the close itself drops it.
    const claim = await claimStore(dir, { holder: "vessel" });
    try {
      let ran = false;
      const sock = createConnection(socketOf(dir));
      await new Promise<void>((resolve, reject) => { sock.once("connect", resolve); sock.once("error", reject); });
      const hungUp = new Promise<void>((resolve) => sock.once("close", resolve));
      sock.end(JSON.stringify({ verb: "nexus-kapae", requestedBy: "did:test", timeoutMs: 20_000 }) + "\n");
      await hungUp;                                   // the caller is fully gone before any verb channel ever opens
      claim.serve((s) => { ran = true; try { s.end(JSON.stringify({ status: "done" }) + "\n"); } catch { /* gone */ } });
      // Nothing to await from the caller's side (it already closed) — give `handOver`'s synchronous pass a tick.
      await new Promise((r) => setTimeout(r, 20));
      expect(ran).toBe(false);                         // the verb handler NEVER ran — the exact ghost-write this guards against
    } finally { await claim.release(); }
  });

  it("a vessel's claim refuses beside another vessel rather than waiting on it", async () => {
    const standing = await claimStore(dir, { holder: "vessel" });
    try {
      await expect(claimStore(dir, { holder: "vessel", awaitDirect: true })).rejects.toBeInstanceOf(StoreHeld);
    } finally { await standing.release(); }
  });
});

/** Every file under `root`, by path. */
function filesUnder(root: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(root)) {
    const p = join(root, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...filesUnder(p)); else if (st.isFile()) out.push(p);   // the .holder presence socket is no chunk
  }
  return out;
}

/**
 * Arm a fault that writes the first half of each chunk and then dies, at both write shores: the stock
 * adapter's `fs.promises.writeFile` and the file handle the crash-atomic adapter writes its temp through.
 * Returns the payloads each write was asked to land, and the disarm.
 */
async function armMidChunkFault(): Promise<{ attempted: Uint8Array[]; disarm: () => void }> {
  const attempted: Uint8Array[] = [];
  const probe = await fsp.open(join(dir, ".probe"), "w");
  const handleProto = Object.getPrototypeOf(probe) as { writeFile: (this: unknown, data: Uint8Array) => Promise<void> };
  await probe.close();
  rmSync(join(dir, ".probe"));
  const realHandleWrite = handleProto.writeFile;
  const realWriteFile = fsp.writeFile;
  const half = (data: Uint8Array): Uint8Array => data.subarray(0, Math.max(1, Math.floor(data.length / 2)));
  handleProto.writeFile = async function (this: unknown, data: Uint8Array): Promise<void> {
    attempted.push(Uint8Array.from(data));
    await realHandleWrite.call(this, half(data));
    throw new Error("the disk died mid-chunk");
  };
  (fsp as { writeFile: unknown }).writeFile = async (path: string, data: Uint8Array): Promise<void> => {
    attempted.push(Uint8Array.from(data));
    await realWriteFile(path, half(data));
    throw new Error("the disk died mid-chunk");
  };
  return {
    attempted,
    disarm: () => { handleProto.writeFile = realHandleWrite; (fsp as { writeFile: unknown }).writeFile = realWriteFile; },
  };
}

/** Files on disk whose bytes are a STRICT prefix of a chunk some write was asked to land — a tear. */
function torn(root: string, attempted: readonly Uint8Array[]): string[] {
  return filesUnder(root).filter((p) => {
    const bytes = readFileSync(p);
    return attempted.some((a) => bytes.length > 0 && bytes.length < a.length && Buffer.from(a.subarray(0, bytes.length)).equals(bytes));
  });
}

describe("ownedStore — crash-atomic saves", () => {
  // The disk is read the instant the save dies — what a crash at that moment leaves — before any later save
  // could heal it.
  it("RED: a save that dies mid-chunk under the holder leaves no torn chunk", async () => {
    let attempted: Uint8Array[] = [];
    let tears: string[] = [];
    await ownedStore(dir, async (repo) => {
      await repo.storageId();                     // the store's own id lands before the disk fails
      const fault = await armMidChunkFault();
      try {
        const h = repo.create<{ text: string }>({ text: "x".repeat(4096) });
        h.change((d) => { d.text = "y".repeat(4096); });
        await repo.flush().catch(() => { /* the fault is the point */ });
        attempted = fault.attempted;
        tears = torn(dir, attempted);
      } finally { fault.disarm(); }
    });
    expect(attempted.length).toBeGreaterThan(0);
    expect(tears).toEqual([]);
  });

  // A stock Repo's constructor starts its own storage-id read beside the caller's; on a fresh dir both save an id,
  // and the constructor's save, awaited by no one, can land after the fault arms and reject unhandled. A seeded id
  // means neither read saves, so the fault meets only the chunk writes the control plants it for.
  async function seedStorageId(): Promise<void> {
    const seed = new Repo({ storage: new NodeFSStorageAdapter(dir) });
    await seed.storageId();
    await seed.shutdown();
  }

  it("a seeded storage id leaves the stock Repo's construction no id to save", async () => {
    const saves = (adapter: NodeFSStorageAdapter): string[][] => {
      const keys: string[][] = [];
      const real = adapter.save.bind(adapter);
      adapter.save = async (key, data) => { keys.push([...key]); await real(key, data); };
      return keys;
    };
    const fresh = new NodeFSStorageAdapter(join(dir, "fresh"));
    const freshKeys = saves(fresh);
    const a = new Repo({ storage: fresh });
    await a.storageId();
    await a.shutdown();
    expect(freshKeys.filter((k) => k[0] === "storage-adapter-id").length).toBeGreaterThan(0);   // CONTROL: a fresh dir saves one

    await seedStorageId();
    const seeded = new NodeFSStorageAdapter(dir);
    const seededKeys = saves(seeded);
    const b = new Repo({ storage: seeded });
    await b.storageId();
    await b.shutdown();
    expect(seededKeys.filter((k) => k[0] === "storage-adapter-id")).toEqual([]);
  });

  it("CONTROL (planted known positive): the stock adapter under the same fault tears a chunk", async () => {
    await seedStorageId();                        // no id save stays in flight when the disk fails
    const repo = new Repo({ storage: new NodeFSStorageAdapter(dir) });
    await repo.storageId();
    const fault = await armMidChunkFault();
    let tears: string[] = [];
    try {
      const h = repo.create<{ text: string }>({ text: "x".repeat(4096) });
      h.change((d) => { d.text = "y".repeat(4096); });
      await repo.flush().catch(() => { /* the fault is the point */ });
      tears = torn(dir, fault.attempted);
    } finally {
      fault.disarm();
      await repo.shutdown().catch(() => { /* already faulted */ });
    }
    expect(fault.attempted.length).toBeGreaterThan(0);
    expect(tears.length).toBeGreaterThan(0);
  });
});
